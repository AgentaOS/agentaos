import type {
	CancelSubscriptionParams,
	CancelSubscriptionResult,
	ChangePlanParams,
	ChangePlanResult,
	Credit,
	CreditList,
	GrantCreditParams,
	ListSubscriptionParams,
	PaginatedList,
	PlanChangePreview,
	RequestOptions,
	Subscription,
	SubscriptionInvoice,
} from '../types.js';
import { BaseResource } from './base.js';

const BASE_PATH = '/api/v1/gateway/subscriptions';

/**
 * Read + manage subscriptions. Subscriptions are CREATED by buyers on the
 * hosted checkout (paying a `type: 'subscription'` payment link) — this
 * resource is the merchant-side management surface (list, cancel), mirroring
 * the dashboard. There is no `create` here by design.
 */
export class SubscriptionsResource extends BaseResource {
	/**
	 * List subscriptions in the current environment (test/live from the API key),
	 * paginated. Pass `discountCode` to see only the subscribers one code brought in.
	 */
	async list(
		params?: ListSubscriptionParams,
		req?: RequestOptions,
	): Promise<PaginatedList<Subscription>> {
		return this.getJson<PaginatedList<Subscription>>(
			BASE_PATH,
			params as Record<string, string | number | undefined>,
			req,
		);
	}

	/**
	 * Cancel a subscription. Defaults to cancel-at-period-end (the subscriber
	 * keeps the current paid period, no refund); pass `{ atPeriodEnd: false }`
	 * to cancel immediately. Idempotent on an already-canceled subscription.
	 */
	async cancel(
		id: string,
		params?: CancelSubscriptionParams,
		req?: RequestOptions,
	): Promise<CancelSubscriptionResult> {
		return this.postJson<CancelSubscriptionResult>(
			`${BASE_PATH}/${id}/cancel`,
			{
				atPeriodEnd: params?.atPeriodEnd ?? true,
			},
			req,
		);
	}

	/** Per-cycle invoices for one subscription, newest first. */
	async invoices(id: string, req?: RequestOptions): Promise<SubscriptionInvoice[]> {
		return this.getJson<SubscriptionInvoice[]>(`${BASE_PATH}/${id}/invoices`, undefined, req);
	}

	/**
	 * Put credit on this subscriber's account with you. It comes off their next
	 * invoice, reducing what their card is charged; it is not a refund and no money
	 * moves out. Owner or admin on a signed-in session only — an API key cannot,
	 * because the credit has to name the person who gave it.
	 *
	 * `idempotencyKey` is required, not optional. It rides the `Idempotency-Key`
	 * header, and it is the ONLY thing standing between a timeout you retry and a
	 * subscriber credited twice: there is no local record of a credit for the server
	 * to recognise a repeat by. Generating one for you would defeat it, because a
	 * retry would generate a second.
	 */
	async credit(id: string, params: GrantCreditParams, req?: RequestOptions): Promise<Credit> {
		const { idempotencyKey, ...body } = params;
		return this.postJson<Credit>(`${BASE_PATH}/${id}/credits`, body, { ...req, idempotencyKey });
	}

	/** Credits given on this subscription, newest first, and what is still unspent. */
	async credits(id: string, req?: RequestOptions): Promise<CreditList> {
		return this.getJson<CreditList>(`${BASE_PATH}/${id}/credits`, undefined, req);
	}

	/**
	 * Quote a move to another plan without applying it. The target must be a
	 * different subscription product in the same currency and billing interval;
	 * the subscription must be active or trialing.
	 */
	async previewPlanChange(
		id: string,
		targetLinkId: string,
		req?: RequestOptions,
	): Promise<PlanChangePreview> {
		return this.getJson<PlanChangePreview>(
			`${BASE_PATH}/${id}/plan-change/preview`,
			{
				targetLinkId,
			},
			req,
		);
	}

	/**
	 * Apply a plan change quoted by `previewPlanChange`. An upgrade charges the
	 * prorated difference on the saved card now; a downgrade switches at the
	 * current period end and charges nothing today. Idempotent on
	 * (subscription, target plan, prorationDate).
	 */
	async changePlan(
		id: string,
		params: ChangePlanParams,
		req?: RequestOptions,
	): Promise<ChangePlanResult> {
		return this.postJson<ChangePlanResult>(`${BASE_PATH}/${id}/plan-change`, params, req);
	}
}
