// ---------------------------------------------------------------------------
// Tax Rates
// ---------------------------------------------------------------------------

export interface TaxRate {
	id: string;
	orgId: string;
	name: string;
	rate: number;
	inclusive: boolean;
	country: string | null;
	isDefault: boolean;
	archived: boolean;
	createdAt: string;
}

// ---------------------------------------------------------------------------
// Client options
// ---------------------------------------------------------------------------

export interface AgentaOSOptions {
	/** API base URL. Default: https://api.agentaos.ai */
	baseUrl?: string;

	/** Request timeout in milliseconds. Default: 30000 */
	timeout?: number;

	/** Max retries on 5xx errors. Default: 2. Set 0 to disable. */
	maxRetries?: number;

	/** Enable debug logging to stderr (sanitized — never logs API key or request bodies). */
	debug?: boolean;

	/** Custom logger. Receives sanitized log entries. */
	logger?: (level: 'debug' | 'info' | 'warn' | 'error', message: string) => void;
}

// ---------------------------------------------------------------------------
// Pagination
// ---------------------------------------------------------------------------

export interface PaginatedList<T> {
	items: T[];
	total: number;
	hasMore: boolean;
}

export interface ListParams {
	/** 1-100, default 10 */
	limit?: number;
	/** default 0 */
	offset?: number;
}

// ---------------------------------------------------------------------------
// Payment Links
// ---------------------------------------------------------------------------

export interface CheckoutField {
	key: string;
	label: string;
	type: 'text' | 'email' | 'tel' | 'select';
	required: boolean;
	placeholder?: string;
	/** For 'select' type */
	options?: string[];
}

export interface CreatePaymentLinkParams {
	amount: number;
	/** 'EUR' | 'USD', default from org settings */
	currency?: string;
	description?: string;
	/** HTTPS only */
	webhookUrl?: string;
	/** HTTPS only */
	successUrl?: string;
	/** HTTPS only */
	cancelUrl?: string;
	metadata?: Record<string, string>;
	/** ISO 8601 */
	expiresAt?: string;
	/** UUID of pre-created tax rate */
	taxRateId?: string;
	checkoutFields?: CheckoutField[];
}

export interface PaymentLink {
	id: string;
	orgId: string;
	amount: number;
	currency: string;
	description: string | null;
	status: 'active' | 'cancelled';
	checkoutUrl: string;
	x402Url: string;
	metadata: Record<string, unknown>;
	checkoutFields: CheckoutField[];
	webhookUrl: string | null;
	successUrl: string | null;
	cancelUrl: string | null;
	taxRateId: string | null;
	paymentCount: number;
	expiresAt: string | null;
	createdAt: string;
	updatedAt: string;
}

// ---------------------------------------------------------------------------
// Checkouts
// ---------------------------------------------------------------------------

export interface CreateCheckoutParams {
	/** Link ID to create checkout from. Optional — omit to create a standalone checkout. */
	linkId?: string;
	/** Amount in currency units (e.g. 10.00). Required if no linkId. */
	amount?: number;
	/** Currency code (e.g. 'EUR', 'USD'). Defaults to org settlement currency. */
	currency?: string;
	/** Description shown on checkout page. */
	description?: string;
	/** UUID of a pre-created tax rate. */
	taxRateId?: string;
	/** Pre-populate buyer email (shown on checkout, used for receipt). */
	buyerEmail?: string;
	/** Pre-populate buyer name. */
	buyerName?: string;
	/** Pre-populate buyer company name. */
	buyerCompany?: string;
	/** Pre-populate buyer country (ISO 3166-1 alpha-2, e.g. 'DE'). */
	buyerCountry?: string;
	/** Pre-populate buyer address. */
	buyerAddress?: string;
	/** Pre-populate buyer VAT number (e.g. 'DE123456789'). */
	buyerVat?: string;
	/** Override the link's amount for this checkout. */
	amountOverride?: number;
	metadata?: Record<string, unknown>;
	webhookUrl?: string;
	successUrl?: string;
	cancelUrl?: string;
	/** seconds, 300-86400, default 1800 */
	expiresIn?: number;
}

export interface ListCheckoutParams extends ListParams {
	status?: 'open' | 'completed' | 'expired' | 'cancelled';
}

export interface Checkout {
	id: string;
	paymentLinkId: string;
	orgId: string;
	sessionId: string;
	checkoutUrl: string;
	status: 'open' | 'completed' | 'expired' | 'cancelled';
	amountOverride: number | null;
	currency: string;
	metadata: Record<string, unknown>;
	successUrl: string | null;
	cancelUrl: string | null;
	expiresAt: string;
	createdAt: string;
	updatedAt: string;
}

// ---------------------------------------------------------------------------
// Transactions
// ---------------------------------------------------------------------------

export interface ListTransactionParams extends ListParams {
	direction?: 'all' | 'inbound' | 'outbound';
	/** ISO 8601 date */
	from?: string;
	/** ISO 8601 date */
	to?: string;
}

export interface Transaction {
	id: string;
	orgId: string;
	direction: 'inbound' | 'outbound';
	paymentLinkId: string | null;
	sessionId: string | null;
	payerAddress: string;
	toAddress: string | null;
	amount: number;
	paymentToken: string;
	settlementToken: string;
	txHash: string | null;
	network: string;
	status: 'confirmed' | 'pending' | 'failed';
	recipientLabel: string | null;
	description: string | null;
	tokenAddress: string | null;
	createdAt: string;
}

// ---------------------------------------------------------------------------
// Invoices
// ---------------------------------------------------------------------------

export interface ListInvoiceParams extends ListParams {
	from?: string;
	to?: string;
	status?: 'all' | 'issued' | 'voided';
}

export interface Invoice {
	id: string;
	orgId: string;
	transactionId: string | null;
	invoiceNumber: string;
	amount: number;
	currency: string;
	paymentToken: string;
	description: string | null;
	txHash: string | null;
	network: string;
	fiatAmount: number | null;
	fiatCurrency: string | null;
	exchangeRate: number | null;
	exchangeRateSource: string | null;
	exchangeRateAt: string | null;
	merchantName: string | null;
	merchantAddress: string | null;
	merchantVat: string | null;
	merchantWallet: string | null;
	payerAddress: string;
	taxRate: number | null;
	taxAmount: number | null;
	taxInclusive: boolean | null;
	taxName: string | null;
	buyerCountry: string | null;
	buyerEmail: string | null;
	buyerName: string | null;
	buyerVat: string | null;
	buyerCompany: string | null;
	status: 'issued' | 'voided';
	issuedAt: string;
	voidedAt: string | null;
	createdAt: string;
}

// ---------------------------------------------------------------------------
// Webhook Events
// ---------------------------------------------------------------------------

export interface CheckoutCompletedData {
	linkId: string;
	sessionId: string;
	amount: string;
	currency: string;
	txHash: string;
	payer: string;
	payerType: 'human' | 'agent';
	network: string;
	metadata: Record<string, unknown>;
}

export interface SendCompletedData {
	transactionId: string;
	txHash: string;
	from: string;
	to: string;
	amount: string;
	token: string;
	chainId: number;
	network: string;
	description: string | null;
}

export interface SendFailedData {
	transactionId: string;
	txHash: null;
	from: string;
	to: string;
	amount: string;
	token: string;
	chainId: number;
	network: string;
	description: string | null;
}

export type WebhookEvent =
	| { type: 'checkout.session.completed'; data: CheckoutCompletedData }
	| { type: 'send.completed'; data: SendCompletedData }
	| { type: 'send.failed'; data: SendFailedData };
