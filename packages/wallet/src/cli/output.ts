import chalk from 'chalk';

/**
 * Output helper — respects --json flag or non-TTY for AI-parseable output.
 * Human mode: chalk-formatted key-value pairs.
 * JSON mode: single JSON line on stdout.
 */
export function isJsonMode(): boolean {
	return process.argv.includes('--json') || !process.stdout.isTTY;
}

export function output(data: Record<string, unknown>): void {
	if (isJsonMode()) {
		console.log(JSON.stringify(data));
		return;
	}
	// Human-friendly
	console.log('');
	for (const [key, value] of Object.entries(data)) {
		if (value === null || value === undefined) continue;
		if (typeof value === 'object' && !Array.isArray(value)) continue; // skip nested
		const label = key.replace(/([A-Z])/g, ' $1').replace(/^./, (s) => s.toUpperCase());
		console.log(`  ${chalk.bold(`${label}:`)} ${value}`);
	}
	console.log('');
}

export function outputError(message: string): void {
	if (isJsonMode()) {
		console.error(JSON.stringify({ error: message }));
	} else {
		console.error(`\n  ${chalk.red('✕')} ${message}\n`);
	}
}
