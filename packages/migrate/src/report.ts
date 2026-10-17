import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { ApplyResult } from './apply.js';
import type { MigrationPlan } from './plan.js';

export const SOURCE_LABEL: Record<MigrationPlan['source'], string> = {
	paddle: 'Paddle',
	lemonsqueezy: 'Lemon Squeezy',
	creem: 'Creem',
	gumroad: 'Gumroad',
};

/**
 * Writes the migration folder. Files with subscriber emails stay on this
 * machine; nothing here is uploaded anywhere.
 */
export async function writeReport(
	outDir: string,
	plan: MigrationPlan,
	result?: ApplyResult,
): Promise<string[]> {
	await mkdir(outDir, { recursive: true });
	const files: Record<string, string> = {
		// Holds customer emails: keep the whole folder out of git.
		'.gitignore': '*\n',
		'summary.md': summary(plan, result),
		'products.csv': productsCsv(plan, result),
		'skipped.csv': csv(
			['kind', 'old_id', 'name', 'reason'],
			plan.skipped.map((s) => [s.kind, s.sourceId, s.name, s.reason]),
		),
	};
	if (plan.subscribers.length > 0) {
		files['subscribers.csv'] = subscribersCsv(plan, result);
		files['email-to-subscribers.md'] = subscriberEmail(plan, result);
	}
	if (result) files['redirects.csv'] = redirectsCsv(plan, result);

	await Promise.all(
		Object.entries(files).map(([name, body]) => writeFile(join(outDir, name), body)),
	);
	return Object.keys(files)
		.filter((name) => name !== '.gitignore')
		.map((name) => join(outDir, name));
}

export function summary(plan: MigrationPlan, result?: ApplyResult): string {
	const from = SOURCE_LABEL[plan.source];
	const subs = plan.plans.filter((p) => p.type === 'subscription').length;
	const lines = [
		`# Move from ${from} to AgentaOS`,
		'',
		result
			? 'Status: **applied**.'
			: 'Status: **dry run**. Nothing was created. Run again with `--apply`.',
		'',
		`- Products to move: ${plan.plans.length} (${subs} subscription plans, ${plan.plans.length - subs} one-time)`,
		`- Discount codes to move: ${plan.discounts.length}`,
		`- Active subscribers: ${plan.subscribers.length}`,
		`- Left behind, with the reason: ${plan.skipped.length} (see skipped.csv)`,
	];
	if (result) {
		const made = result.plans.filter((p) => !p.existed).length;
		lines.push(
			'',
			'## Done',
			'',
			`- Created ${made} products (${result.plans.length - made} were already there from an earlier run).`,
			`- Created ${result.discounts.filter((d) => !d.existed).length} discount codes.`,
		);
		if (result.switchCode)
			lines.push(
				`- Switch code for subscribers: \`${result.switchCode}\` (first invoice free, usable as many times as you have subscribers, valid 60 days).`,
			);
		for (const f of result.failures) lines.push(`- Failed (${f.kind}) ${f.name}: ${f.error}`);
	}
	lines.push(
		'',
		'## What moves and what does not',
		'',
		`Your products, prices, trials and discount codes move. Your ${from} account is only read, never changed.`,
		'',
		`Saved cards do not move: ${from} holds them and does not hand them to another seller. Each subscriber`,
		'subscribes again once, on the new link. subscribers.csv has each one with their link and renewal date.',
		'',
		'## Next steps',
		'',
		'1. Test a purchase on one of the new links (test mode, card 4242 4242 4242 4242).',
		'2. Swap the old buy links on your site for the new ones (redirects.csv).',
		'3. Email your subscribers before their renewal date (email-to-subscribers.md).',
		`4. When someone subscribes on AgentaOS, cancel their ${from} subscription at the end of the period they paid for, so nobody pays twice.`,
		'',
	);
	return lines.join('\n');
}

function productsCsv(plan: MigrationPlan, result?: ApplyResult): string {
	const created = new Map(result?.plans.map((p) => [p.sourceId, p]));
	return csv(
		[
			'old_id',
			'name',
			'price',
			'currency',
			'billing',
			'trial_days',
			'new_product_id',
			'new_link',
			'old_link',
		],
		plan.plans.map((p) => [
			p.sourceId,
			p.name,
			p.amount.toFixed(2),
			p.currency,
			p.type === 'subscription' ? `every ${p.interval}` : 'one time',
			p.trialDays ? String(p.trialDays) : '',
			created.get(p.sourceId)?.linkId ?? '',
			created.get(p.sourceId)?.checkoutUrl ?? '',
			p.oldUrl ?? '',
		]),
	);
}

function subscribersCsv(plan: MigrationPlan, result?: ApplyResult): string {
	const planById = new Map(plan.plans.map((p) => [p.sourceId, p]));
	const linkBySource = new Map(result?.plans.map((p) => [p.sourceId, p.checkoutUrl]));
	return csv(
		['email', 'name', 'country', 'plan', 'renews_on_old', 'new_link', 'note'],
		plan.subscribers.map((s) => [
			s.email,
			s.name ?? '',
			s.country ?? '',
			planById.get(s.planSourceId)?.name ?? '',
			s.renewsAt?.slice(0, 10) ?? '',
			linkBySource.get(s.planSourceId) ?? '',
			s.note ?? (planById.has(s.planSourceId) ? '' : 'their plan was not moved; see skipped.csv'),
		]),
	);
}

function redirectsCsv(plan: MigrationPlan, result: ApplyResult): string {
	const oldUrlBySource = new Map(plan.plans.map((p) => [p.sourceId, p.oldUrl]));
	return csv(
		['old_link', 'new_link', 'product'],
		result.plans
			.filter((p) => oldUrlBySource.get(p.sourceId))
			.map((p) => [oldUrlBySource.get(p.sourceId) ?? '', p.checkoutUrl, p.name]),
	);
}

function subscriberEmail(plan: MigrationPlan, result?: ApplyResult): string {
	const from = SOURCE_LABEL[plan.source];
	const code = result?.switchCode
		? `\nUse the code ${result.switchCode} at checkout and your first period on the new plan is free, because you have already paid for this one.\n`
		: '';
	return [
		'Subject: Your subscription is moving (one click, nothing changes)',
		'',
		'Hi {name},',
		'',
		`We are moving our billing from ${from} to AgentaOS. Your plan and price stay the same.`,
		'',
		'Your current subscription stays active until {renews_on_old}. To keep access after that, subscribe once on the new page:',
		'',
		'{new_link}',
		code,
		'Once you have, we cancel the old subscription so you are never charged twice.',
		'',
		'Questions? Just reply to this email.',
		'',
		'{your name}',
		'',
		'---',
		'Fill {name}, {renews_on_old} and {new_link} from subscribers.csv. Send it a week or two before each renewal date.',
		'',
	].join('\n');
}

export function csv(header: string[], rows: string[][]): string {
	return `${[header, ...rows].map((row) => row.map(csvCell).join(',')).join('\n')}\n`;
}

function csvCell(value: string): string {
	const safe = /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
	return /[",\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
}
