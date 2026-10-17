import type { AgentaCurrency, Catalog, Skipped, SourceDiscount, SourcePlan } from './types.js';

const AGENTA_CURRENCIES = new Set<string>(['EUR', 'USD']);
const CODE_PATTERN = /^[A-Za-z0-9_-]{1,64}$/;
const MAX_TRIAL_DAYS = 730;

export interface PlannedPlan extends SourcePlan {
	currency: AgentaCurrency;
}

export interface PlannedDiscount extends SourceDiscount {
	/** The one plan the code stays limited to, if any. */
	planSourceId?: string;
	/** Why the code works slightly differently on AgentaOS, if it does. */
	note?: string;
}

/** What `apply` will create, and what stays behind with the reason. */
export interface MigrationPlan {
	source: Catalog['source'];
	plans: PlannedPlan[];
	discounts: PlannedDiscount[];
	subscribers: Catalog['subscribers'];
	skipped: Skipped[];
}

export function buildPlan(catalog: Catalog): MigrationPlan {
	const skipped = [...catalog.skipped];
	const plans: PlannedPlan[] = [];

	for (const plan of catalog.plans) {
		const reason = planProblem(plan);
		if (reason) {
			skipped.push({ kind: 'plan', sourceId: plan.sourceId, name: plan.name, reason });
			continue;
		}
		plans.push({
			...plan,
			currency: plan.currency as AgentaCurrency,
			trialDays: clampTrial(plan.trialDays),
		});
	}

	const planById = new Map(plans.map((p) => [p.sourceId, p]));
	const discounts: PlannedDiscount[] = [];
	for (const discount of catalog.discounts) {
		const planned = planDiscount(discount, planById);
		if ('reason' in planned) {
			skipped.push({
				kind: 'discount',
				sourceId: discount.sourceId,
				name: discount.code,
				reason: planned.reason,
			});
		} else {
			discounts.push(planned);
		}
	}

	return { source: catalog.source, plans, discounts, subscribers: catalog.subscribers, skipped };
}

function planProblem(plan: SourcePlan): string | undefined {
	if (!AGENTA_CURRENCIES.has(plan.currency)) {
		return `priced in ${plan.currency}; AgentaOS prices are in EUR or USD, so set the new price yourself`;
	}
	if (!(plan.amount > 0)) return 'free or pay-what-you-want; create it by hand';
	return undefined;
}

function planDiscount(
	discount: SourceDiscount,
	planById: Map<string, PlannedPlan>,
): PlannedDiscount | { reason: string } {
	if (!CODE_PATTERN.test(discount.code)) {
		return {
			reason: 'code has characters AgentaOS does not allow (letters, digits, - and _ only)',
		};
	}
	if (!discount.percentOff && !discount.amountOffMinor) {
		return { reason: 'takes nothing off the price' };
	}

	const targets = discount.planSourceIds.filter((id) => planById.has(id));
	if (discount.planSourceIds.length > 0 && targets.length === 0) {
		return { reason: 'limited to products that were not moved' };
	}
	if (discount.amountOffMinor && discount.currency) {
		const currencies = new Set(
			targets.length
				? targets.map((id) => planById.get(id)?.currency)
				: [...planById.values()].map((p) => p.currency),
		);
		if (currencies.size !== 1 || !currencies.has(discount.currency as PlannedPlan['currency'])) {
			return {
				reason: `fixed amount in ${discount.currency} does not match the plan currency; recreate it by hand`,
			};
		}
	}
	const onlySubscriptions = targets.every((id) => planById.get(id)?.type === 'subscription');
	if (!onlySubscriptions) {
		return { reason: 'limited to a one-time product; AgentaOS codes apply to subscription plans' };
	}

	return {
		...discount,
		planSourceId: targets.length === 1 ? targets[0] : undefined,
		note:
			targets.length > 1
				? 'was limited to several plans; on AgentaOS it works on every plan'
				: 'takes money off the first invoice only',
	};
}

function clampTrial(days: number | undefined): number | undefined {
	if (!days || days < 1) return undefined;
	return Math.min(days, MAX_TRIAL_DAYS);
}
