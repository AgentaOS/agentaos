import type { Command } from 'commander';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const quote = {
	direction: 'upgrade',
	currency: 'eur',
	dueTodayMinor: 1234,
	dueTodayVatMinor: 239,
	effectiveAt: '2026-09-03T10:00:00.000Z',
	nextInvoiceMinor: 4900,
	nextInvoiceVatMinor: 1176,
	nextInvoiceAt: '2026-10-03T10:45:13.000Z',
	prorationDate: 1788434542,
};

const previewPlanChange = vi.fn(async () => quote);
const changePlan = vi.fn(async () => ({
	direction: 'upgrade',
	applied: true,
	status: 'active',
	unitAmountMinor: 4900,
	currency: 'eur',
}));

vi.mock('@agentaos/pay', () => ({
	AgentaOS: class {
		subscriptions = { previewPlanChange, changePlan };
	},
}));

vi.mock('../lib/ensure-session.js', async (importOriginal) => ({
	...(await importOriginal<typeof import('../lib/ensure-session.js')>()),
	ensureSession: async () => ({ ok: true, token: 't', serverUrl: 'https://api.example.com' }),
}));

vi.mock('../lib/org.js', () => ({
	fetchOrg: async () => ({ id: 'org_1', name: 'Acme' }),
}));

function exitOverrideAll(command: Command): Command {
	command.exitOverride();
	for (const subcommand of command.commands) exitOverrideAll(subcommand);
	return command;
}

/**
 * Fresh command tree per run. The command objects are module singletons and
 * commander keeps parsed option values on them, so a `--dry-run` from one run
 * would leak into the next.
 */
async function run(args: string[]): Promise<string> {
	vi.resetModules();
	const { buildProgram } = await import('../cli/index.js');
	const lines: string[] = [];
	const stdout = vi.spyOn(console, 'log').mockImplementation((line: string) => {
		lines.push(String(line));
	});
	process.exitCode = 0;
	try {
		await exitOverrideAll(buildProgram()).parseAsync(args, { from: 'user' });
	} finally {
		stdout.mockRestore();
	}
	return lines.join('\n');
}

describe('agenta subscriptions change-plan', () => {
	beforeEach(() => {
		previewPlanChange.mockClear();
		changePlan.mockClear();
	});

	it('--dry-run quotes and applies nothing', async () => {
		const out = await run([
			'subscriptions',
			'change-plan',
			'sub_1',
			'--to',
			'link_2',
			'--dry-run',
			'--json',
		]);
		expect(previewPlanChange).toHaveBeenCalledWith('sub_1', 'link_2');
		expect(changePlan).not.toHaveBeenCalled();
		expect(JSON.parse(out)).toMatchObject({
			applied: false,
			direction: 'upgrade',
			dueTodayMinor: 1234,
		});
	});

	// The apply must carry the quote's prorationDate, otherwise the charge can
	// drift from what the merchant was shown.
	it('applies with the prorationDate from the quote it just showed', async () => {
		const out = await run(['subscriptions', 'change-plan', 'sub_1', '--to', 'link_2', '--json']);
		expect(changePlan).toHaveBeenCalledWith('sub_1', {
			targetLinkId: 'link_2',
			prorationDate: 1788434542,
		});
		expect(JSON.parse(out)).toMatchObject({
			applied: true,
			unitAmountMinor: 4900,
			quote: { prorationDate: 1788434542 },
		});
	});
});
