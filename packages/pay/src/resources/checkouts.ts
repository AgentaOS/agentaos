import type {
	Checkout,
	CreateCheckoutParams,
	ListCheckoutParams,
	PaginatedList,
	RequestOptions,
} from '../types.js';
import { BaseResource } from './base.js';

const BASE_PATH = '/api/v1/gateway/sessions';

export class CheckoutsResource extends BaseResource {
	async create(params: CreateCheckoutParams, req?: RequestOptions): Promise<Checkout> {
		// Seller mode is NOT a parameter — a link-based session inherits its link's
		// mode and a link-less session uses the mode the server derives from the
		// merchant's account. The response carries the resolved `sellerMode`.
		return this.postJson<Checkout>(BASE_PATH, params, req);
	}

	async list(params?: ListCheckoutParams, req?: RequestOptions): Promise<PaginatedList<Checkout>> {
		return this.getJson<PaginatedList<Checkout>>(
			BASE_PATH,
			params as Record<string, string | number | undefined>,
			req,
		);
	}

	async retrieve(sessionId: string, req?: RequestOptions): Promise<Checkout> {
		return this.getJson<Checkout>(`${BASE_PATH}/${sessionId}`, undefined, req);
	}

	async cancel(sessionId: string, req?: RequestOptions): Promise<{ success: boolean }> {
		return this.postJson<{ success: boolean }>(`${BASE_PATH}/${sessionId}/cancel`, undefined, req);
	}
}
