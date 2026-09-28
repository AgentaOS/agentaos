import type {
	ListTransactionParams,
	PaginatedList,
	RequestOptions,
	Transaction,
} from '../types.js';
import { BaseResource } from './base.js';

const BASE_PATH = '/api/v1/gateway/all-transactions';

export class TransactionsResource extends BaseResource {
	async list(
		params?: ListTransactionParams,
		req?: RequestOptions,
	): Promise<PaginatedList<Transaction>> {
		return this.getJson<PaginatedList<Transaction>>(
			BASE_PATH,
			params as Record<string, string | number | undefined>,
			req,
		);
	}
}
