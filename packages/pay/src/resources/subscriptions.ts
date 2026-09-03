import type {
	CancelSubscriptionParams,
	CancelSubscriptionResult,
	ChangePlanParams,
	ChangePlanResult,
	ListParams,
	PaginatedList,
	PlanChangePreview,
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
	/** List subscriptions in the current environment (test/live from the API key), paginated. */
	async list(params?: ListParams): Promise<PaginatedList<Subscription>> {
		return this.get<PaginatedList<Subscription>>(
			BASE_PATH,
			params as Record<string, string | number | undefined>,
		);
	}

	/**
	 * Cancel a subscription. Defaults to cancel-at-period-end (the subscriber
	 * keeps the current paid period, no refund); pass `{ atPeriodEnd: false }`
	 * to cancel immediately. Idempotent on an already-canceled subscription.
	 */
	async cancel(id: string, params?: CancelSubscriptionParams): Promise<CancelSubscriptionResult> {
		return this.post<CancelSubscriptionResult>(`${BASE_PATH}/${id}/cancel`, {
			atPeriodEnd: params?.atPeriodEnd ?? true,
		});
	}

	/** Per-cycle invoices for one subscription, newest first. */
	async invoices(id: string): Promise<SubscriptionInvoice[]> {
		return this.get<SubscriptionInvoice[]>(`${BASE_PATH}/${id}/invoices`);
	}

	/**
	 * Quote a move to another plan without applying it. The target must be a
	 * different subscription product in the same currency and billing interval;
	 * the subscription must be active or trialing.
	 */
	async previewPlanChange(id: string, targetLinkId: string): Promise<PlanChangePreview> {
		return this.get<PlanChangePreview>(`${BASE_PATH}/${id}/plan-change/preview`, {
			targetLinkId,
		});
	}

	/**
	 * Apply a plan change quoted by `previewPlanChange`. An upgrade charges the
	 * prorated difference on the saved card now; a downgrade switches at the
	 * current period end and charges nothing today. Idempotent on
	 * (subscription, target plan, prorationDate).
	 */
	async changePlan(id: string, params: ChangePlanParams): Promise<ChangePlanResult> {
		return this.post<ChangePlanResult>(`${BASE_PATH}/${id}/plan-change`, params);
	}
}
