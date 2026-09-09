import chalk from 'chalk';
import type { Command } from 'commander';

const JSON_FLAG = '--json';

/** `--json`, or no TTY, means a machine is reading: one JSON line on stdout. */
export function isJsonMode(): boolean {
	return process.argv.includes(JSON_FLAG) || !process.stdout.isTTY;
}

/**
 * Declare `--json` on a command and every command beneath it.
 *
 * The published agent skill tells callers to pass `--json` to everything, so
 * everything has to accept it. On the commands that already print JSON it is a
 * no-op: the flag is read from argv by `isJsonMode()`, never from the parsed
 * options, so declaring it here only stops commander rejecting it as unknown.
 * One declaration for the whole tree keeps the wording in a single place.
 */
export function addJsonOption(command: Command): Command {
	if (!command.options.some((option) => option.long === JSON_FLAG)) {
		command.option(JSON_FLAG, 'Output as JSON');
	}
	for (const subcommand of command.commands) addJsonOption(subcommand);
	return command;
}

export function outputError(message: string): void {
	if (isJsonMode()) {
		console.error(JSON.stringify({ error: message }));
	} else {
		console.error(`\n  ${chalk.red('✕')} ${message}\n`);
	}
}
