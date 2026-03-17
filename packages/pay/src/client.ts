import { CheckoutsResource } from './resources/checkouts.js';
import { InvoicesResource } from './resources/invoices.js';
import { PaymentLinksResource } from './resources/payment-links.js';
import { TransactionsResource } from './resources/transactions.js';
import { WebhooksResource } from './resources/webhooks.js';
import type { AgentaOSOptions } from './types.js';

const DEFAULT_BASE_URL = 'https://api.agentaos.ai';
const DEFAULT_TIMEOUT = 30_000;
const DEFAULT_MAX_RETRIES = 2;

export class AgentaOS {
	readonly checkouts: CheckoutsResource;
	readonly paymentLinks: PaymentLinksResource;
	readonly transactions: TransactionsResource;
	readonly invoices: InvoicesResource;
	readonly webhooks: WebhooksResource;

	constructor(apiKey: string, options?: AgentaOSOptions) {
		// SECURITY: Prevent browser use — API key must never be in client-side code
		if (typeof globalThis.window !== 'undefined' && typeof globalThis.document !== 'undefined') {
			throw new Error(
				'@agentaos/pay is a server-side SDK. Do not use it in browser code.\n' +
					'Your API key grants full access to your payment data.\n' +
					'Use this SDK in Node.js backends only.',
			);
		}

		// Validate key format
		if (!apiKey || (!apiKey.startsWith('sk_live_') && !apiKey.startsWith('sk_test_'))) {
			throw new Error(
				'Invalid API key format. Must start with sk_live_ or sk_test_.\n' +
					'Get your key at: https://app.agentaos.ai → Settings → API Keys',
			);
		}

		const baseUrl = options?.baseUrl ?? DEFAULT_BASE_URL;
		const resourceOptions = {
			timeout: options?.timeout ?? DEFAULT_TIMEOUT,
			maxRetries: options?.maxRetries ?? DEFAULT_MAX_RETRIES,
			debug: options?.debug ?? false,
			logger: options?.logger as ((level: string, message: string) => void) | undefined,
		};

		this.checkouts = new CheckoutsResource(baseUrl, apiKey, resourceOptions);
		this.paymentLinks = new PaymentLinksResource(baseUrl, apiKey, resourceOptions);
		this.transactions = new TransactionsResource(baseUrl, apiKey, resourceOptions);
		this.invoices = new InvoicesResource(baseUrl, apiKey, resourceOptions);
		this.webhooks = new WebhooksResource();
	}
}
