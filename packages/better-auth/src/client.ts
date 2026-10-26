import type { BetterAuthClientPlugin } from 'better-auth';
import type { agentaos } from './index.js';

/**
 * Adds `authClient.agentaos.checkout()`, `.subscriptions()`, `.cancelSubscription()`,
 * `.previewPlanChange()`, `.changePlan()` and `.invoices()`.
 */
export const agentaosClient = () =>
	({
		id: 'agentaos',
		$InferServerPlugin: {} as ReturnType<typeof agentaos>,
	}) satisfies BetterAuthClientPlugin;
