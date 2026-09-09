import type { ChangePlanResult, PlanChangePreview, Subscription } from '@agentaos/pay';
import { z } from 'zod';
import { pageLimit } from './schema.js';
import { type OperationGroup, operation } from './types.js';
import { count, day, lines, moneyMinor, moreLine } from './words.js';

/**
 * Recurring subscribers. Subscriptions are CREATED by buyers paying for a plan
 * on the hosted checkout; this is the merchant-side management surface.
 */

function planPrice(s: Subscription): string {
	const cadence = s.billingInterval ? `/${s.billingInterval}` : '';
	return `${moneyMinor(s.unitAmountMinor, s.currency)}${cadence}`;
}

export const subscriptionsList = operation({
	name: 'subscriptions.list',
	description: 'List subscriptions',
	input: z.object({ limit: pageLimit }),
	async run(sdk, input) {
		const page = await sdk.subscriptions.list({ limit: input.limit });
		return { total: page.total, hasMore: page.hasMore, items: page.items };
	},
	describe(page) {
		if (!page.items.length) return 'No subscriptions yet. A buyer paying for a plan creates one.';
		return lines(
			`${count(page.total, 'subscription')}:`,
			...page.items.map(
				(s) =>
					`  - ${s.status} — ${planPrice(s)} — ${s.customerEmail ?? s.customerName ?? 'unknown buyer'}${s.planName ? ` on ${s.planName}` : ''} — ${s.id}`,
			),
			moreLine(page.items.length, page.total, page.hasMore),
		);
	},
});

export const subscriptionsCancel = operation({
	name: 'subscriptions.cancel',
	description: 'Cancel a subscription (at period end by default)',
	input: z.object({
		id: z.string().min(1).describe('The subscription id'),
		now: z
			.boolean()
			.optional()
			.describe('Cancel immediately instead of at the end of the current period'),
	}),
	positional: 'id',
	async run(sdk, input) {
		const result = await sdk.subscriptions.cancel(input.id, { atPeriodEnd: !input.now });
		return {
			status: result.status,
			cancelAtPeriodEnd: result.cancelAtPeriodEnd,
			effectiveCancelDate: result.effectiveCancelDate,
			currentPeriodEnd: result.currentPeriodEnd,
		};
	},
	describe(result) {
		if (result.cancelAtPeriodEnd) {
			const until = result.effectiveCancelDate ?? result.currentPeriodEnd;
			return lines(
				'Cancellation scheduled. The subscriber keeps what they paid for; no refund.',
				until ? `Access ends ${day(until)}, and nothing is charged after that.` : null,
			);
		}
		return 'Cancelled now. No further charges; nothing is refunded.';
	},
});

/**
 * Two API calls behind one operation: the quote, then the apply with the
 * quote's prorationDate echoed back so what is charged is what was shown.
 * `dryRun` stops after the quote.
 */
export const subscriptionsChangePlan = operation({
	name: 'subscriptions.changePlan',
	description: 'Move a subscription to another plan (upgrade charges now, downgrade at period end)',
	input: z.object({
		id: z.string().min(1).describe('The subscription id'),
		to: z.string().min(1).describe('Target plan: the product id (same currency and interval)'),
		dryRun: z.boolean().optional().describe('Show the quote only; apply nothing'),
	}),
	positional: 'id',
	async run(sdk, input): Promise<PlanChangeView> {
		const quote = await sdk.subscriptions.previewPlanChange(input.id, input.to);
		if (input.dryRun) return { applied: false, ...quote };
		const result = await sdk.subscriptions.changePlan(input.id, {
			targetLinkId: input.to,
			prorationDate: quote.prorationDate,
		});
		return { ...result, quote };
	},
	describe(view) {
		if (!view.applied) return lines('Quote only; nothing was changed.', quoteLines(view));
		return lines(appliedLine(view), quoteLines(view.quote));
	},
});

type PlanChangeView =
	| ({ applied: false } & PlanChangePreview)
	| (ChangePlanResult & { quote: PlanChangePreview });

function quoteLines(quote: PlanChangePreview): string {
	const next = `${moneyMinor(quote.nextInvoiceMinor, quote.currency)} (VAT ${moneyMinor(quote.nextInvoiceVatMinor, quote.currency)})`;
	switch (quote.direction) {
		case 'upgrade':
			return lines(
				`Upgrade: ${moneyMinor(quote.dueTodayMinor, quote.currency)} due today (VAT ${moneyMinor(quote.dueTodayVatMinor, quote.currency)}), charged to the saved card.`,
				`Next renewal ${day(quote.nextInvoiceAt)} at ${next}.`,
			);
		case 'downgrade':
			return lines(
				`Downgrade: nothing due today; the new plan starts ${day(quote.effectiveAt)}.`,
				`First renewal on it ${day(quote.nextInvoiceAt)} at ${next}.`,
			);
		default:
			return `Revert: the scheduled downgrade is dropped and the current plan stays; nothing is charged. Next renewal ${day(quote.nextInvoiceAt)} at ${next}.`;
	}
}

function appliedLine(result: ChangePlanResult): string {
	const amount = moneyMinor(result.unitAmountMinor, result.currency);
	switch (result.direction) {
		case 'upgrade':
			return `Upgraded. The plan now renews at ${amount} per cycle.`;
		case 'downgrade':
			return `Downgrade scheduled for ${day(result.effectiveAt)}; from then it renews at ${amount} per cycle.`;
		default:
			return `The scheduled downgrade was cancelled; the plan stays at ${amount} per cycle.`;
	}
}

export const SUBSCRIPTIONS: OperationGroup = {
	name: 'subscriptions',
	description: 'Subscription management (list, cancel, change-plan)',
	operations: [subscriptionsChangePlan, subscriptionsList, subscriptionsCancel],
};
