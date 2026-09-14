import type {
	CreateDiscountCodeParams,
	DiscountCode,
	DiscountCodeDetail,
	ListParams,
	PaginatedList,
} from '../types.js';
import { BaseResource } from './base.js';

const BASE_PATH = '/api/v1/gateway/discount-codes';

/**
 * Codes a buyer types at checkout. A code may take a percentage off, a fixed amount
 * off, or NOTHING AT ALL — a code with no discount still records who it brought in,
 * which is how a referral works when the referred buyer pays full price. Codes apply
 * to subscriptions only.
 *
 * The code string is yours, so two merchants can both run SAVE20 without colliding.
 */
export class DiscountCodesResource extends BaseResource {
	/**
	 * Mint a code. Terms are fixed once it exists: to change them, archive this one
	 * and create another, so nobody is quoted a price that later changes under them.
	 */
	async create(params: CreateDiscountCodeParams): Promise<DiscountCode> {
		return this.postJson<DiscountCode>(BASE_PATH, params);
	}

	/**
	 * Your codes in this environment: the code, whether it discounts or only tracks,
	 * whether it still works, and the plan it is limited to. What each one takes off
	 * is on `get` — it comes from the card processor, and fetching one per row would
	 * be a call per row.
	 */
	async list(params?: ListParams): Promise<PaginatedList<DiscountCode>> {
		return this.getJson<PaginatedList<DiscountCode>>(
			BASE_PATH,
			params as Record<string, string | number | undefined>,
		);
	}

	/** One code with its terms, how many subscribers used it, and whether it is still
	 *  valid — read live. */
	async get(id: string): Promise<DiscountCodeDetail> {
		return this.getJson<DiscountCodeDetail>(`${BASE_PATH}/${id}`);
	}

	/** Stops the code working now. Subscribers who already used it keep their discount. */
	async archive(id: string): Promise<DiscountCode> {
		return this.postJson<DiscountCode>(`${BASE_PATH}/${id}/archive`);
	}
}
