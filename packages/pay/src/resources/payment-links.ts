import type { CreatePaymentLinkParams, ListParams, PaginatedList, PaymentLink } from '../types.js';
import { BaseResource } from './base.js';

const BASE_PATH = '/api/v1/gateway/payment-links';

export class PaymentLinksResource extends BaseResource {
	async create(params: CreatePaymentLinkParams): Promise<PaymentLink> {
		// Seller mode (Merchant of Record vs on-chain crypto) is NOT a parameter —
		// the server derives it from the merchant's account. The response carries
		// the resolved `sellerMode` for rendering.
		return this.postJson<PaymentLink>(BASE_PATH, params);
	}

	async list(params?: ListParams): Promise<PaginatedList<PaymentLink>> {
		return this.getJson<PaginatedList<PaymentLink>>(
			BASE_PATH,
			params as Record<string, string | number | undefined>,
		);
	}

	async retrieve(id: string): Promise<PaymentLink> {
		return this.getJson<PaymentLink>(`${BASE_PATH}/${id}`);
	}

	async cancel(id: string): Promise<{ success: boolean }> {
		return this.del<{ success: boolean }>(`${BASE_PATH}/${id}`);
	}
}
