import { Command } from 'commander';
import { ensureSession } from '../../lib/ensure-session.js';
import { statusGet } from '../../ops/status.js';
import type { CliAccount, CliContext } from '../connect.js';
import { fail, print } from '../from-operation.js';
import { isJsonMode } from '../output.js';

/**
 * `agenta status` — who you are, and how far along going live you are.
 *
 * The go-live half is the `status.get` operation, shared with the MCP tool.
 * The "who you are" half exists only here: a session names a person, an API
 * key does not, so the account line cannot come from the catalogue. Being
 * logged out is an answer, not an error: one JSON object, exit 0.
 */
export function statusCommand(ctx: CliContext): Command {
	const status = new Command('status')
		.alias('whoami')
		.usage('[options]')
		.description(statusGet.description)
		// Connect (PRD §6.1 R9-3): see where a business you manage stands.
		.option('--business <id>', 'Act for this business you manage. Omit to act as yourself.')
		.action((opts: { business?: string }) => showStatus(ctx, opts.business));
	// `agenta status get` is the catalogue's name for the same thing; hidden,
	// and the usage line above keeps `[command]` out of the help it had in 3.0.0.
	status.addCommand(
		new Command('get')
			.description(statusGet.description)
			.option('--business <id>', 'Act for this business you manage. Omit to act as yourself.')
			.action((opts: { business?: string }) => showStatus(ctx, opts.business)),
		{ hidden: true },
	);
	return status;
}

async function showStatus(ctx: CliContext, business?: string): Promise<void> {
	try {
		const session = await ensureSession();
		if (!session.ok) {
			console.log(
				JSON.stringify({
					account: { authenticated: false, reason: session.reason, next: 'agenta login' },
				}),
			);
			return;
		}

		const { sdk, account } = await ctx.connect(business ? { business } : undefined);
		if (!account.orgId) {
			console.log(JSON.stringify({ account: { ...account, serverReachable: false } }));
			return;
		}

		const result = await statusGet.run(sdk, {});
		if (isJsonMode()) {
			console.log(JSON.stringify({ ...result, account: { ...account, ...result.account } }));
			return;
		}
		console.log(`\n  ${signedInLine(account)}`);
		print(statusGet, result);
	} catch (error: unknown) {
		fail(error instanceof Error ? error.message : 'Unknown error');
	}
}

function signedInLine(account: CliAccount): string {
	const who = account.email ?? 'you';
	const org = account.organization ? ` for ${account.organization}` : '';
	return `Signed in as ${who}${org} on ${account.server}.`;
}
