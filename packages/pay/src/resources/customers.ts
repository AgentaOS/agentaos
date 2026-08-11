import type { Customer, ListParams, PaginatedList } from '../types.js';
import { BaseResource } from './base.js';

const BASE_PATH = '/api/v1/gateway/customers';

/** Read the customers who have paid you (mirrors the dashboard Customers list). */
export class CustomersResource extends BaseResource {
	/** List customers in the current environment (test/live from the API key), paginated. */
	async list(params?: ListParams): Promise<PaginatedList<Customer>> {
		return this.get<PaginatedList<Customer>>(
			BASE_PATH,
			params as Record<string, string | number | undefined>,
		);
	}
}
