import type { GoLiveReadiness, RequestOptions } from '../types.js';
import { BaseResource } from './base.js';

const BASE_PATH = '/api/v1/gateway/go-live';

/**
 * Merchant onboarding readiness. The server decides what "ready" means and
 * returns one render-ready object; nothing here recomputes readiness from
 * parts, which is the whole reason that endpoint exists.
 */
export class GoLiveResource extends BaseResource {
	/** Where the merchant is on the road to live payments: verification state,
	 *  open change requests, the free audit, milestones. Also whether a payout
	 *  account exists: it is needed before the first payout, not to go live. */
	async get(req?: RequestOptions): Promise<GoLiveReadiness> {
		return this.getJson<GoLiveReadiness>(BASE_PATH, undefined, req);
	}
}
