import { randomBytes } from 'node:crypto';
import type { AgentaOS, PaymentLink } from '@agentaos/pay';
import type { MigrationPlan, PlannedDiscount, PlannedPlan } from './plan.js';
import { SOURCE_LABEL } from './report.js';

const PAGE_SIZE = 100;
const SWITCH_CODE_DAYS = 60;

export interface CreatedPlan {
	sourceId: string;
	name: string;
	linkId: string;
	checkoutUrl: string;
	/** True when an earlier run already made it. */
	existed: boolean;
}

export interface Failure {
	kind: 'plan' | 'discount' | 'switch-code';
	name: string;
	error: string;
}

export interface ApplyResult {
	plans: CreatedPlan[];
	discounts: { code: string; existed: boolean }[];
	switchCode?: string;
	failures: Failure[];
}

export interface ApplyOptions {
	/** Make a one-off code that takes the first invoice to zero for moved subscribers. */
	switchCode?: boolean;
}

/**
 * Creates the plan's products and codes in AgentaOS. Safe to run again:
 * products are matched by the source id kept in their metadata, codes by code.
 * A create that fails is reported, never retried.
 */
export async function applyPlan(
	agentaos: AgentaOS,
	plan: MigrationPlan,
	options: ApplyOptions = {},
): Promise<ApplyResult> {
	const result: ApplyResult = { plans: [], discounts: [], failures: [] };
	const existingLinks = await linksMigratedFrom(agentaos, plan.source);

	for (const p of plan.plans) {
		const existing = existingLinks.get(p.sourceId);
		if (existing) {
			result.plans.push(toCreated(p, existing, true));
			continue;
		}
		try {
			result.plans.push(toCreated(p, await createLink(agentaos, plan.source, p), false));
		} catch (err) {
			result.failures.push({ kind: 'plan', name: p.name, error: message(err) });
		}
	}

	const linkIdBySource = new Map(result.plans.map((p) => [p.sourceId, p.linkId]));
	const existingCodes = await existingDiscountCodes(agentaos);
	for (const d of plan.discounts) {
		if (existingCodes.has(d.code.toUpperCase())) {
			result.discounts.push({ code: d.code, existed: true });
			continue;
		}
		try {
			await createDiscount(agentaos, d, linkIdBySource);
			result.discounts.push({ code: d.code, existed: false });
		} catch (err) {
			result.failures.push({ kind: 'discount', name: d.code, error: message(err) });
		}
	}

	if (options.switchCode && plan.subscribers.length > 0) {
		try {
			result.switchCode = await createSwitchCode(agentaos, plan);
		} catch (err) {
			result.failures.push({ kind: 'switch-code', name: 'SWITCH', error: message(err) });
		}
	}
	return result;
}

async function createLink(
	agentaos: AgentaOS,
	source: string,
	p: PlannedPlan,
): Promise<PaymentLink> {
	return agentaos.paymentLinks.create({
		name: p.name,
		description: p.description?.slice(0, 500),
		amount: p.amount,
		currency: p.currency,
		imageUrl: p.imageUrl?.startsWith('https://') ? p.imageUrl : undefined,
		type: p.type,
		billingInterval: p.type === 'subscription' ? p.interval : undefined,
		trialPeriodDays: p.type === 'subscription' ? p.trialDays : undefined,
		trialAmount: p.type === 'subscription' && p.trialDays ? p.trialAmount : undefined,
		metadata: { migratedFrom: source, sourceId: p.sourceId },
	});
}

async function createDiscount(
	agentaos: AgentaOS,
	d: PlannedDiscount,
	linkIdBySource: Map<string, string>,
): Promise<void> {
	const linkId = d.planSourceId ? linkIdBySource.get(d.planSourceId) : undefined;
	if (d.planSourceId && !linkId) throw new Error('its plan was not created');
	await agentaos.discountCodes.create({
		code: d.code,
		name: d.name,
		percentOff: d.percentOff,
		amountOffMinor: d.percentOff ? undefined : d.amountOffMinor,
		maxRedemptions: d.maxRedemptions,
		expiresAt: d.expiresAt,
		linkId,
	});
}

/** One code per run, random so it cannot be guessed, capped at the number of subscribers. */
async function createSwitchCode(agentaos: AgentaOS, plan: MigrationPlan): Promise<string> {
	const code = `SWITCH-${randomBytes(4).toString('hex').toUpperCase()}`;
	const expiresAt = new Date(Date.now() + SWITCH_CODE_DAYS * 86_400_000).toISOString();
	await agentaos.discountCodes.create({
		code,
		name: `Moved from ${SOURCE_LABEL[plan.source]}: first period free`,
		percentOff: 100,
		maxRedemptions: plan.subscribers.length,
		expiresAt,
	});
	return code;
}

async function linksMigratedFrom(
	agentaos: AgentaOS,
	source: string,
): Promise<Map<string, PaymentLink>> {
	const links = new Map<string, PaymentLink>();
	for (let offset = 0; ; offset += PAGE_SIZE) {
		const page = await agentaos.paymentLinks.list({ limit: PAGE_SIZE, offset });
		for (const link of page.items) {
			const sourceId = link.metadata?.sourceId;
			if (
				link.status === 'active' &&
				link.metadata?.migratedFrom === source &&
				typeof sourceId === 'string'
			) {
				links.set(sourceId, link);
			}
		}
		if (!page.hasMore) return links;
	}
}

async function existingDiscountCodes(agentaos: AgentaOS): Promise<Set<string>> {
	const codes = new Set<string>();
	for (let offset = 0; ; offset += PAGE_SIZE) {
		const page = await agentaos.discountCodes.list({ limit: PAGE_SIZE, offset });
		for (const d of page.items) codes.add(d.code.toUpperCase());
		if (!page.hasMore) return codes;
	}
}

function toCreated(p: PlannedPlan, link: PaymentLink, existed: boolean): CreatedPlan {
	return {
		sourceId: p.sourceId,
		name: p.name,
		linkId: link.id,
		checkoutUrl: link.checkoutUrl,
		existed,
	};
}

function message(err: unknown): string {
	return err instanceof Error ? err.message : String(err);
}
