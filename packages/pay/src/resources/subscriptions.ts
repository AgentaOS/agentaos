import type {
	CancelSubscriptionParams,
	CancelSubscriptionResult,
	ListParams,
	PaginatedList,
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
}
