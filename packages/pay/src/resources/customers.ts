import type { Customer } from '../types.js';
import { BaseResource } from './base.js';

const BASE_PATH = '/api/v1/gateway/customers';

/** Read the customers who have paid you (mirrors the dashboard Customers list). */
export class CustomersResource extends BaseResource {
	/** List every customer in the current environment (test/live from the API key). */
	async list(): Promise<Customer[]> {
		return this.get<Customer[]>(BASE_PATH);
	}
}
