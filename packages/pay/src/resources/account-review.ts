import { NotFoundError } from '../errors.js';
import type { AccountReview, AuditRequested, RequestAudit, SubmitAccountReview } from '../types.js';
import { BaseResource } from './base.js';

const BASE_PATH = '/api/v1/gateway/account-review';

/** Every account-review endpoint wraps the row the same way; only GET can
 *  carry null (nothing on file yet). */
interface ReviewEnvelope<T extends AccountReview | null = AccountReview> {
	review: T;
}

/**
 * Business verification and the free Revenue & Pricing Audit — the two
 * onboarding steps a merchant takes before accepting live payments. Reviews
 * are live-only: the server ignores the key's environment here.
 */
export class AccountReviewResource extends BaseResource {
	/** The verification on file, or null when the merchant has never asked for
	 *  an audit nor submitted anything. */
	async get(): Promise<AccountReview | null> {
		try {
			const { review } = await this.getJson<ReviewEnvelope<AccountReview | null>>(BASE_PATH);
			return review;
		} catch (error) {
			if (error instanceof NotFoundError) return null;
			throw error;
		}
	}

	/** Submit business details for verification. The server rejects a submit
	 *  while a rejection cooldown is running or the account is on hold. */
	async submit(body: SubmitAccountReview): Promise<AccountReview> {
		const { review } = await this.postJson<ReviewEnvelope>(BASE_PATH, body);
		return review;
	}

	/** Send the details already on file back for review after making the
	 *  changes ops asked for. No body: nothing is retyped. */
	async resubmit(): Promise<AccountReview> {
		const { review } = await this.postJson<ReviewEnvelope>(`${BASE_PATH}/resubmit`, {});
		return review;
	}

	/** Ask for the free audit. Gates nothing and never marks the account as
	 *  submitted; asking twice updates the product details but keeps the
	 *  original `requestedAt`. */
	async requestAudit(body: RequestAudit): Promise<AuditRequested> {
		const { review } = await this.postJson<ReviewEnvelope>(`${BASE_PATH}/audit`, body);
		return review;
	}
}
