import type {
	BankAccount,
	BankAccountRequirements,
	CreateBankAccountParams,
	RefreshBankAccountRequirementsParams,
	RequestOptions,
} from '../types.js';
import { BaseResource } from './base.js';

const BASE_PATH = '/api/v1/gateway/bank-accounts';

/**
 * Where payouts go: the bank accounts of a business, as thin references (holder, last four digits,
 * the name-check result), never the account number. A platform saves them for the businesses it
 * manages with `{ business: id }`; a merchant for itself. Adding and retiring one need a live key
 * and, for a platform, bank accounts by API opened by us; the requirements and the list do not.
 */
export class BankAccountsResource extends BaseResource {
	/** The fields a bank account in this currency needs, as a form schema. */
	async requirements(currency: string, req?: RequestOptions): Promise<BankAccountRequirements> {
		return this.getJson<BankAccountRequirements>(`${BASE_PATH}/requirements`, { currency }, req);
	}

	/** The fields again after an answer that changes them (a field marked `refreshRequirementsOnChange`). */
	async refreshRequirements(
		params: RefreshBankAccountRequirementsParams,
		req?: RequestOptions,
	): Promise<BankAccountRequirements['requirements']> {
		return this.postJson<BankAccountRequirements['requirements']>(
			`${BASE_PATH}/requirements/refresh`,
			params,
			req,
		);
	}

	/**
	 * Save a bank account. The bank confirms the holder name at once: a clear mismatch is saved
	 * but never paid, and `payableReason` says so. The account number is never
	 * stored; we keep the last four characters and a hash.
	 */
	async create(params: CreateBankAccountParams, req?: RequestOptions): Promise<BankAccount> {
		return this.postJson<BankAccount>(BASE_PATH, params, req);
	}

	/** The active accounts, each with whether the next payout can go to it. */
	async list(req?: RequestOptions): Promise<BankAccount[]> {
		return this.getJson<BankAccount[]>(BASE_PATH, undefined, req);
	}

	/** Retire an account: it stops being paid to. Needs a live key and, for a platform, the switch. */
	async deactivate(id: string, req?: RequestOptions): Promise<{ success: boolean }> {
		return this.del<{ success: boolean }>(`${BASE_PATH}/${id}`, req);
	}
}
