import type {
	Business,
	BusinessInvitation,
	CreateBusinessParams,
	CreatedBusiness,
	RequestOptions,
	VerificationLink,
} from '../types.js';
import { BaseResource } from './base.js';

const BASE_PATH = '/api/v1/gateway/businesses';

/**
 * The businesses you manage (Connect — Stripe's connected accounts). To act for one, pass
 * `{ business: id }` to any call, or create the client with it: `new AgentaOS(key, { business })`.
 */
export class BusinessesResource extends BaseResource {
	/** Every business you manage, with its status and your share. */
	async list(req?: RequestOptions): Promise<Business[]> {
		return this.getJson<Business[]>(BASE_PATH, undefined, req);
	}

	/** One business you manage. */
	async retrieve(id: string, req?: RequestOptions): Promise<Business> {
		return this.getJson<Business>(`${BASE_PATH}/${id}`, undefined, req);
	}

	/**
	 * Add a business. It starts in test mode and goes live after its own verification. With
	 * `clientEmail`, your client is invited as its admin: we email them, or — with
	 * `sendInvitationEmail: false` — you send them `inviteUrl` yourself.
	 */
	async create(params: CreateBusinessParams, req?: RequestOptions): Promise<CreatedBusiness> {
		return this.postJson<CreatedBusiness>(BASE_PATH, params, req);
	}

	/** Send the invitation again: a new link (the old one stops working), emailed unless you say not. */
	async resendInvitation(
		id: string,
		params?: { sendInvitationEmail?: boolean },
		req?: RequestOptions,
	): Promise<BusinessInvitation> {
		return this.postJson<BusinessInvitation>(`${BASE_PATH}/${id}/invitation`, params ?? {}, req);
	}

	/** Withdraw the invitation: its link stops working. */
	async revokeInvitation(id: string, req?: RequestOptions): Promise<void> {
		await this.del(`${BASE_PATH}/${id}/invitation`, req);
	}

	/**
	 * The identity check link for your client — Stripe's Account Links. You send it; only your
	 * client can complete it. Needs a live key. `url` is null once they are verified.
	 */
	async createVerificationLink(id: string, req?: RequestOptions): Promise<VerificationLink> {
		return this.postJson<VerificationLink>(`${BASE_PATH}/${id}/verification-link`, {}, req);
	}
}
