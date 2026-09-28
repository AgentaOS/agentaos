/**
 * Connect (PRD §6.1 R9-3): the two invitation switches are spelled as the docs promise. Both are
 * booleans that default to on, so the shared `--email <email>` value flag must not win over them
 * — it did, and `agenta businesses invite <id> --no-email` answered "unknown option".
 */
import type { Command } from 'commander';
import { describe, expect, it } from 'vitest';
import { buildProgram } from '../cli/index.js';

function commandAt(parent: Command, path: string[]): Command {
	const [head, ...rest] = path;
	const found = parent.commands.find((c) => c.name() === head);
	if (!found) throw new Error(`no command ${head} under ${parent.name()}`);
	return rest.length === 0 ? found : commandAt(found, rest);
}

const program = buildProgram();

describe('agenta businesses — invitation switches', () => {
	it('`invite <id>` offers --no-email, not an --email value', () => {
		const help = commandAt(program, ['businesses', 'invite']).helpInformation();

		expect(help).toContain('--no-email');
		expect(help).not.toContain('--email <email>');
	});

	it('`create` offers --no-invite-email, worded as what it does', () => {
		const help = commandAt(program, ['businesses', 'create']).helpInformation();

		expect(help).toContain('--no-invite-email');
		expect(help).toContain('Send no email');
	});
});
