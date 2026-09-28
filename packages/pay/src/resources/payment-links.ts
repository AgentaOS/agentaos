import type {
	CreatePaymentLinkParams,
	ListParams,
	PaginatedList,
	PaymentLink,
	RequestOptions,
} from '../types.js';
import { BaseResource } from './base.js';

const BASE_PATH = '/api/v1/gateway/payment-links';

export class PaymentLinksResource extends BaseResource {
	async create(params: CreatePaymentLinkParams, req?: RequestOptions): Promise<PaymentLink> {
		// Seller mode (Merchant of Record vs on-chain crypto) is NOT a parameter —
		// the server derives it from the merchant's account. The response carries
		// the resolved `sellerMode` for rendering.
		return this.postJson<PaymentLink>(BASE_PATH, params, req);
	}

	async list(params?: ListParams, req?: RequestOptions): Promise<PaginatedList<PaymentLink>> {
		return this.getJson<PaginatedList<PaymentLink>>(
			BASE_PATH,
			params as Record<string, string | number | undefined>,
			req,
		);
	}

	async retrieve(id: string, req?: RequestOptions): Promise<PaymentLink> {
		return this.getJson<PaymentLink>(`${BASE_PATH}/${id}`, undefined, req);
	}

	async cancel(id: string, req?: RequestOptions): Promise<{ success: boolean }> {
		return this.del<{ success: boolean }>(`${BASE_PATH}/${id}`, req);
	}
}
