import type { Command } from 'commander';
import { describe, expect, it, vi } from 'vitest';
import { buildProgram } from '../cli/index.js';

/** No session on disk — `status` then answers from local state, with no network. */
vi.mock('../lib/ensure-session.js', async (importOriginal) => ({
	...(await importOriginal<typeof import('../lib/ensure-session.js')>()),
	ensureSession: async () => ({ ok: false, reason: 'not-logged-in' }),
}));

/** Every command under `parent`, named the way a caller types it. */
function everyCommand(parent: Command, prefix = ''): Array<[string, Command]> {
	return parent.commands.flatMap((command): Array<[string, Command]> => {
		const name = `${prefix}${command.name()}`;
		return [[name, command], ...everyCommand(command, `${name} `)];
	});
}

/** Throw on a parse error instead of taking the test worker down with it. */
function exitOverrideAll(command: Command): Command {
	command.exitOverride();
	for (const subcommand of command.commands) exitOverrideAll(subcommand);
	return command;
}

const program = exitOverrideAll(buildProgram());

describe('agenta CLI', () => {
	// The published agent skill says "always pass --json", so a command that
	// rejects it breaks the documented contract.
	it.each(everyCommand(program))('`agenta %s` accepts --json', (_name, command) => {
		expect(command.helpInformation()).toContain('--json');
	});

	it('runs `status --json` instead of rejecting the flag', async () => {
		const stdout = vi.spyOn(console, 'log').mockImplementation(() => {});
		process.exitCode = 0;

		await program.parseAsync(['status', '--json'], { from: 'user' });

		const printed = String(stdout.mock.calls[0]?.[0]);
		const exitCode = process.exitCode;
		stdout.mockRestore();
		process.exitCode = 0;

		expect(exitCode).toBe(0);
		expect(JSON.parse(printed)).toMatchObject({ account: { authenticated: false } });
	});
});
