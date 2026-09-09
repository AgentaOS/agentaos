import type { GoLiveReadiness } from '../types.js';
import { BaseResource } from './base.js';

const BASE_PATH = '/api/v1/gateway/go-live';

/**
 * Merchant onboarding readiness. The server decides what "ready" means and
 * returns one render-ready object; nothing here recomputes readiness from
 * parts, which is the whole reason that endpoint exists.
 */
export class GoLiveResource extends BaseResource {
	/** Where the merchant is on the road to live payments: verification state,
	 *  payout account, open change requests, the free audit, milestones. */
	async get(): Promise<GoLiveReadiness> {
		return this.getJson<GoLiveReadiness>(BASE_PATH);
	}
}
