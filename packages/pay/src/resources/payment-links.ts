import type { CreatePaymentLinkParams, ListParams, PaginatedList, PaymentLink } from '../types.js';
import { BaseResource } from './base.js';

const BASE_PATH = '/api/v1/gateway/payment-links';

export class PaymentLinksResource extends BaseResource {
	async create(params: CreatePaymentLinkParams): Promise<PaymentLink> {
		return this.post<PaymentLink>(BASE_PATH, params);
	}

	async list(params?: ListParams): Promise<PaginatedList<PaymentLink>> {
		return this.get<PaginatedList<PaymentLink>>(
			BASE_PATH,
			params as Record<string, string | number | undefined>,
		);
	}

	async retrieve(id: string): Promise<PaymentLink> {
		return this.get<PaymentLink>(`${BASE_PATH}/${id}`);
	}

	async cancel(id: string): Promise<{ success: boolean }> {
		return this.del<{ success: boolean }>(`${BASE_PATH}/${id}`);
	}
}
