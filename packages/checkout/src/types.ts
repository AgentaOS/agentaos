/**
 * The v1 contract of the AgentaOS checkout script (`/v1/agentaos.js`). The script is the one
 * implementation; this package loads it and types it. A breaking change ships as `/v2/`.
 */

/** Where the checkout comes from: a product's buyer link, or a checkout your server created. */
export type CheckoutSource =
	| {
			/** The product's buyer link, e.g. `https://app.agentaos.ai/pay/UID95sZlBqXrVKlUHKmLhQ`. */
			link: string;
			session?: never;
	  }
	| {
			/** `sessionId` of a checkout your server created with `checkouts.create`. */
			session: string;
			link?: never;
	  };

/** Everything `open()` takes besides where the checkout comes from. */
export interface CheckoutBehaviour {
	/** CSS selector or element to render into (inline). Leave out for the overlay. */
	target?: string | HTMLElement;
	/** Prefills the buyer's email. Sent in the handshake, never in a URL. */
	email?: string;
	/** Prefills the buyer's country, ISO 3166-1 alpha-2 (e.g. `DE`). */
	country?: string;
	/**
	 * Where the whole page goes after a completed payment (https only; `sessionId` is added).
	 * Defaults to the product's success URL. `false` keeps the page where it is.
	 */
	successUrl?: string | false;
	onEvent?: (event: CheckoutEvent) => void;
}

/** Read when the checkout opens; `update()` changes only the product or checkout. */
export type OpenOptions = CheckoutSource & CheckoutBehaviour;

export interface CheckoutLoadedData {
	product: {
		name: string;
		type: 'one_time' | 'subscription';
		billingInterval: 'month' | 'year' | null;
		trialDays: number;
	};
	currency: string;
	testMode: boolean;
}

export interface CheckoutCompletedData {
	sessionId: string;
	/** `bank_transfer`: the buyer has the bank details; the money has not arrived yet. */
	kind: 'payment' | 'trial' | 'bank_transfer';
	email: string;
	/** What was charged today (0 for a free trial), or the amount to send for a bank transfer. */
	amountMinor: number;
	currency: string;
	successUrl: string | null;
}

export interface CheckoutErrorData {
	code: 'not_loaded' | 'not_found' | 'unavailable';
	message: string;
}

/**
 * Everything the checkout tells your page. An event is never proof of payment: unlock access
 * from the webhook or `checkouts.retrieve`, and handle `checkout.completed` once per `sessionId`
 * (a reload of a finished checkout sends it again).
 */
export type CheckoutEvent =
	| { name: 'checkout.loaded'; data: CheckoutLoadedData }
	| { name: 'checkout.completed'; data: CheckoutCompletedData }
	/** The overlay closed — by the buyer, or by `close()` (including a React unmount). */
	| { name: 'checkout.closed'; data: Record<string, never> }
	| { name: 'checkout.error'; data: CheckoutErrorData };

export interface CheckoutHandle {
	/** Switches the open checkout to another product or checkout (e.g. Monthly → Yearly). */
	update(source: CheckoutSource): void;
	/** Removes the checkout from the page. */
	close(): void;
}

/** `window.AgentaOS`, as the script defines it. */
export interface AgentaOS {
	checkout: {
		open(options: OpenOptions): CheckoutHandle;
	};
}
