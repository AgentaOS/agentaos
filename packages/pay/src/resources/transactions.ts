import type { ListTransactionParams, PaginatedList, Transaction } from '../types.js';
import { BaseResource } from './base.js';

const BASE_PATH = '/api/v1/gateway/all-transactions';

export class TransactionsResource extends BaseResource {
	async list(params?: ListTransactionParams): Promise<PaginatedList<Transaction>> {
		return this.get<PaginatedList<Transaction>>(
			BASE_PATH,
			params as Record<string, string | number | undefined>,
		);
	}
}
