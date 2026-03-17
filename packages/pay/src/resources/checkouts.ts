import type {
	Checkout,
	CreateCheckoutParams,
	ListCheckoutParams,
	PaginatedList,
} from '../types.js';
import { BaseResource } from './base.js';

const BASE_PATH = '/api/v1/gateway/sessions';

export class CheckoutsResource extends BaseResource {
	async create(params: CreateCheckoutParams): Promise<Checkout> {
		return this.post<Checkout>(BASE_PATH, params);
	}

	async list(params?: ListCheckoutParams): Promise<PaginatedList<Checkout>> {
		return this.get<PaginatedList<Checkout>>(
			BASE_PATH,
			params as Record<string, string | number | undefined>,
		);
	}

	async retrieve(sessionId: string): Promise<Checkout> {
		return this.get<Checkout>(`${BASE_PATH}/${sessionId}`);
	}

	async cancel(sessionId: string): Promise<{ success: boolean }> {
		return this.post<{ success: boolean }>(`${BASE_PATH}/${sessionId}/cancel`);
	}
}
