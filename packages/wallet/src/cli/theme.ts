import chalk, { type ChalkInstance } from 'chalk';

// ---------------------------------------------------------------------------
// Agenta brand palette (from brand-guidelines.html)
//
// The brand is monochrome: #1A1A1A accent on #FAFAF8 cream.
// Terminal adaptation: bold/white for emphasis, dim for secondary.
// Color only for semantic meaning — green, red, amber.
// ---------------------------------------------------------------------------

/** Brand accent — bold white. Mirrors #1A1A1A-on-cream in terminal. */
export const brand: ChalkInstance = chalk.bold;
export const brandBold: ChalkInstance = chalk.bold;

/** Success — checkmarks, completed status. Brand: #22C55E */
export const success: ChalkInstance = chalk.hex('#22c55e');

/** Warning — paused state, caution messages. Brand: #F59E0B */
export const warn: ChalkInstance = chalk.hex('#f59e0b');

/** Danger — errors, revoked, blocked. Brand: #EF4444 */
export const danger: ChalkInstance = chalk.hex('#ef4444');

/** Muted — secondary text, labels, separators. Brand: #6B6B6B */
export const dim: ChalkInstance = chalk.dim;

/** Bold — section headers, emphasis */
export const bold: ChalkInstance = chalk.bold;

// ---------------------------------------------------------------------------
// Composite helpers
// ---------------------------------------------------------------------------

export function brandDot(active: boolean): string {
	return active ? '●' : dim('○');
}

export function statusColor(status: string): string {
	switch (status) {
		case 'active':
			return success(status);
		case 'paused':
			return warn(status);
		case 'revoked':
			return danger(status);
		case 'offline':
		case 'error':
			return danger(status);
		default:
			return dim(status);
	}
}

export function successMark(text: string): string {
	return `${success('✓')} ${text}`;
}

export function failMark(text: string): string {
	return `${danger('✕')} ${text}`;
}

// ---------------------------------------------------------------------------
// Brand header + ASCII logo
// ---------------------------------------------------------------------------

export const BRAND_LINE = `${brand('▪')} ${brandBold('AgentaOS')} ${dim('by Agenta')}`;

export const BRAND_BANNER = [
	'',
	`   ${bold('●')}     ${bold('●')}     ${bold('●')}`,
	'',
	`   ${bold(' █████╗  ██████╗ ███████╗███╗   ██╗████████╗ █████╗  ██████╗ ███████╗')}`,
	`   ${bold('██╔══██╗██╔════╝ ██╔════╝████╗  ██║╚══██╔══╝██╔══██╗██╔═══██╗██╔════╝')}`,
	`   ${bold('███████║██║  ███╗█████╗  ██╔██╗ ██║   ██║   ███████║██║   ██║███████╗')}`,
	`   ${bold('██╔══██║██║   ██║██╔══╝  ██║╚██╗██║   ██║   ██╔══██║██║   ██║╚════██║')}`,
	`   ${bold('██║  ██║╚██████╔╝███████╗██║ ╚████║   ██║   ██║  ██║╚██████╔╝███████║')}`,
	`   ${bold('╚═╝  ╚═╝ ╚═════╝ ╚══════╝╚═╝  ╚═══╝   ╚═╝   ╚═╝  ╚═╝ ╚═════╝ ╚══════╝')}`,
	'',
	`   ${bold('AgentaOS')}  ${dim('The merchant of record for founders selling digital products.')}`,
	'',
].join('\n');

// ---------------------------------------------------------------------------
// Section helpers — visual breathing room between prompt groups
// ---------------------------------------------------------------------------

export function section(label: string): void {
	console.log('');
	console.log(`  ${dim('─')}  ${bold(label)}`);
	console.log('');
}

export function hint(text: string): void {
	console.log(`     ${dim(text)}`);
}

// The `@inquirer/prompts` theme lived here. It went with the prompts: this CLI
// is driven by AI tools, so nothing waits on stdin any more.
