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

	/**
	 * The organization to act for when authenticating with a session token
	 * (a JWT from `agenta login`), whose owner may belong to several. Sent as
	 * `?orgId=` on every request. API keys are bound to one org and need it not.
	 */
	orgId?: string;

	/**
	 * Act for a business you manage (Connect): every request of this client is sent with
	 * `AgentaOS-Account: <business>` — Stripe's `stripeAccount`. Omit to act as yourself.
	 */
	business?: string;
}

/** Per-request options, the last argument of every method (Stripe's per-request options). */
export interface RequestOptions {
	/** Act for this managed business on this call only; overrides the client's `business`. */
	business?: string;
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
	/** Product name shown in the dashboard's Products grid. Optional — if omitted,
	 *  the server defaults it from `description`. Set it to give the link a clean
	 *  product title. */
	name?: string;
	/** Product thumbnail shown in the dashboard's Products grid. */
	imageUrl?: string;
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
	/** 'one_time' (default) or 'subscription' for recurring billing. */
	type?: 'one_time' | 'subscription';
	/** Billing cadence — REQUIRED when type is 'subscription', omit otherwise. */
	billingInterval?: 'month' | 'year';
	/** Trial length in days (1–730). Subscription links only. */
	trialPeriodDays?: number;
	/**
	 * What the trial costs, in currency units — `9` means 9.00 for the whole trial,
	 * not per month. Leave it out and the trial is free. Needs `trialPeriodDays`: a
	 * trial price with no trial length is refused. `amount` stays the recurring price,
	 * charged when the trial ends.
	 */
	trialAmount?: number;
}

export interface PaymentLink {
	/** Same value as `checkouts.create({ linkId })`. On the product page: Copy link ID. */
	id: string;
	orgId: string;
	amount: number;
	currency: string;
	description: string | null;
	/** Product name shown in the dashboard's Products grid. Defaults from `description` when not set. */
	name: string | null;
	/** Product thumbnail shown in the dashboard's Products grid. */
	imageUrl: string | null;
	status: 'active' | 'cancelled';
	/** Settlement mode: 'mor' (card + bank) or 'crypto' (on-chain to your wallet). */
	sellerMode: 'mor' | 'crypto';
	/** 'one_time' or 'subscription'. */
	type: 'one_time' | 'subscription';
	/** Set only for subscription links; null for one-time links. */
	billingInterval: 'month' | 'year' | null;
	/** Trial length in days on a subscription link; null when there is no trial. */
	trialPeriodDays: number | null;
	/** What the trial costs, in currency units, for the whole trial; null when it is free. */
	trialAmount: number | null;
	checkoutUrl: string;
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
	/** `paymentLinks.id`. On the product page this is Copy link ID. Omit for a standalone checkout. */
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
	/** CAIP-2 network IDs (e.g. ['eip155:8453']). Defaults to Base mainnet. */
	supportedNetworks?: string[];
	/** Invoice due date (YYYY-MM-DD). Presentation only — stamped on the issued invoice. */
	dueDate?: string;
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
	x402Url: string;
	status: 'open' | 'completed' | 'expired' | 'cancelled';
	/** Settlement mode: 'mor' (card + bank) or 'crypto' (on-chain to your wallet). */
	sellerMode: 'mor' | 'crypto';
	amountOverride: number | null;
	currency: string;
	metadata: Record<string, unknown>;
	successUrl: string | null;
	cancelUrl: string | null;
	/** Set once an invoice has been issued for this session; null until then. */
	invoiceId: string | null;
	invoiceNumber: string | null;
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
// Subscriptions
// ---------------------------------------------------------------------------

/** Raw Stripe subscription status, mirrored onto the local record by the poll. */
export type SubscriptionStatus =
	| 'incomplete'
	| 'incomplete_expired'
	| 'trialing'
	| 'active'
	| 'past_due'
	| 'canceled'
	| 'unpaid'
	| 'paused';

export interface Subscription {
	id: string;
	customerEmail: string | null;
	customerName: string | null;
	/** The plan (subscription payment-link) name or description. */
	planName: string | null;
	/** Same UUID as `checkouts.create({ linkId })` / product page Copy link ID. */
	linkId: string;
	billingInterval: 'month' | 'year' | null;
	status: SubscriptionStatus;
	/** Per-cycle amount in integer minor units (e.g. 1999 = €19.99). */
	unitAmountMinor: number;
	currency: string;
	/** ISO 8601 end of the current paid period; null before the first cycle books. */
	currentPeriodEnd: string | null;
	stripeSubscriptionId: string | null;
	cancelAtPeriodEnd: boolean;
	canceledAt: string | null;
	effectiveCancelDate: string | null;
	/**
	 * Null unless a downgrade is scheduled; then the plan, amount and date the
	 * subscription switches to. `planName` / `unitAmountMinor` / `linkId` above
	 * stay what the buyer paid for until `effectiveAt`.
	 */
	pendingPlanChange: PendingPlanChange | null;
	/**
	 * The code this subscriber typed at checkout, or null. What it took off is on the
	 * first invoice — read `invoices(id)` for the figure, not this.
	 */
	discount: SubscriptionDiscount | null;
}

/**
 * A redeemed code. `tracking` means the code took nothing off the price and exists so
 * the merchant can see who it brought in; `discount` means it did reduce the first
 * invoice.
 */
export interface SubscriptionDiscount {
	code: string;
	kind: 'discount' | 'tracking';
}

export interface ListSubscriptionParams extends ListParams {
	/**
	 * Only subscribers who redeemed this code. The code string the merchant knows, not
	 * a discount-code id. Case-insensitive.
	 */
	discountCode?: string;
}

/** A scheduled downgrade, applied at the next renewal. */
export interface PendingPlanChange {
	/** The target product's `paymentLinks.id`. */
	linkId: string;
	planName: string | null;
	/** Per-cycle amount from `effectiveAt` on, integer minor units. */
	unitAmountMinor: number;
	/** ISO 8601: the current period end at the time the downgrade was scheduled. */
	effectiveAt: string;
}

/** One cycle invoice from GET /gateway/subscriptions/:id/invoices. */
export interface SubscriptionInvoice {
	id: string;
	invoiceNumber: string;
	status: string;
	issuedAt: string;
	amount: number;
	currency: string;
	disputed: boolean;
	chargedBack: boolean;
}

export interface CancelSubscriptionParams {
	/**
	 * Cancel at the end of the current paid period (default true) — the
	 * subscriber keeps what they paid for, no refund. Pass false to cancel
	 * immediately.
	 */
	atPeriodEnd?: boolean;
}

export interface CancelSubscriptionResult {
	status: SubscriptionStatus;
	currentPeriodEnd: string | null;
	cancelAtPeriodEnd: boolean;
	/** ISO 8601 date the cancellation takes effect. */
	effectiveCancelDate: string | null;
}

/**
 * `upgrade` = the new plan costs more per cycle (charged now); `downgrade` =
 * the same or less (scheduled for the period end); `revert` = the target is
 * the current plan while a downgrade is pending — cancels that downgrade,
 * nothing charged, nothing scheduled.
 */
export type PlanChangeDirection = 'upgrade' | 'downgrade' | 'revert';

/**
 * Quote for moving a subscription to another plan (GET …/plan-change/preview).
 * Read-only: nothing is charged or scheduled until `changePlan` is called with
 * the `prorationDate` echoed from here.
 */
export interface PlanChangePreview {
	direction: PlanChangeDirection;
	currency: string;
	/** Charged now, integer minor units. Always 0 for a downgrade. */
	dueTodayMinor: number;
	dueTodayVatMinor: number;
	/** ISO 8601. Upgrade: now. Downgrade: the current period end. */
	effectiveAt: string;
	/** The next regular cycle invoice on the new plan, integer minor units. */
	nextInvoiceMinor: number;
	nextInvoiceVatMinor: number;
	nextInvoiceAt: string;
	/** Unix seconds. Pass back to `changePlan` so the charge matches this quote. */
	prorationDate: number;
}

export interface ChangePlanParams {
	/** The target product's `paymentLinks.id` (same currency and billing interval as the current plan). */
	targetLinkId: string;
	/** From `previewPlanChange().prorationDate`. */
	prorationDate: number;
}

export type ChangePlanResult =
	| {
			direction: 'upgrade';
			applied: true;
			status: SubscriptionStatus;
			/** New per-cycle amount, integer minor units. */
			unitAmountMinor: number;
			currency: string;
	  }
	| {
			direction: 'downgrade';
			applied: true;
			/** ISO 8601: when the new plan starts (the current period end). */
			effectiveAt: string;
			unitAmountMinor: number;
			currency: string;
	  }
	| {
			/** The pending downgrade was cancelled; the current plan stays. */
			direction: 'revert';
			applied: true;
			unitAmountMinor: number;
			currency: string;
	  };

// ---------------------------------------------------------------------------
// Subscriber credits
// ---------------------------------------------------------------------------

export interface GrantCreditParams {
	/**
	 * Positive integer minor units of the subscription's currency (`500` = 5.00). There
	 * is no currency field: it is read off the subscription, because a mismatched one
	 * parks the money where no invoice can reach it.
	 */
	amountMinor: number;
	/** Why you gave it. The subscriber never sees this; you and your operators do. */
	reason: string;
	/**
	 * Required. Send one string per credit you mean to give, and the SAME one again if
	 * the call times out and you retry — that is what stops a retry becoming a second
	 * credit. Nothing on the server survives a retry to recognise it by, so there is no
	 * safe default we could pick for you. Two different keys for the same amount give
	 * two credits, which is how you deliberately credit someone twice.
	 */
	idempotencyKey: string;
}

/** The whole screen after a grant: every figure is the server's, none is derived here. */
export interface Credit {
	/** The card processor's own id for the entry. There is no id of ours. */
	id: string;
	amountMinor: number;
	currency: string;
	reason: string;
	/** All unspent credit this customer has with you now, positive. */
	creditBalanceMinor: number;
	/** What the next invoice would have taken before this credit. */
	nextInvoiceMinor: number;
	/** What it will take after it. */
	nextInvoiceDueAfterCreditMinor: number;
	nextInvoiceAt: string;
	/** The id of the person who gave it. */
	createdBy: string;
	createdAt: string;
}

/** One row of the credit history. The grant response carries the figures; this does not. */
export interface CreditEntry {
	id: string;
	amountMinor: number;
	reason: string;
	createdBy: string;
	createdAt: string;
}

export interface CreditList {
	items: CreditEntry[];
	/**
	 * Unspent credit on the CUSTOMER, not on this subscription. A buyer with two
	 * subscriptions with you shares one balance.
	 */
	balanceMinor: number;
}

// ---------------------------------------------------------------------------
// Discount codes
// ---------------------------------------------------------------------------

export interface CreateDiscountCodeParams {
	/** What the buyer types. Letters, digits, dashes and underscores, up to 64. */
	code: string;
	/** Your label for it. A code with no discount cannot carry one — it is its own name. */
	name?: string;
	/** 0.01–100. Set at most one of `percentOff` and `amountOffMinor`. */
	percentOff?: number;
	/** Integer minor units of the PLAN's currency, which the server resolves. */
	amountOffMinor?: number;
	/** Stop applying the code after this many redemptions. */
	maxRedemptions?: number;
	/** ISO 8601. After this the code stops working. */
	expiresAt?: string;
	/** Limit the code to ONE plan, by its `paymentLinks.id`. Omit for every plan you own. */
	linkId?: string;
}

export interface DiscountCode {
	id: string;
	code: string;
	/** `tracking` takes nothing off the price; `discount` reduces the first invoice. */
	kind: 'discount' | 'tracking';
	/** The plan the code is limited to; null means every subscription plan you own. */
	planLinkId: string | null;
	planName: string | null;
	archivedAt: string | null;
	createdAt: string;
	/** Whether the code still works. On `get` this also reflects the processor's view. */
	active: boolean;
}

export interface DiscountCodeDetail extends DiscountCode {
	/** Ready to print: `20% off`, `€5.00 off`, or `No discount — tracking only`. */
	termsLabel: string;
	/** How many subscribers redeemed it. */
	timesRedeemed: number;
	/** The redemption cap you set; null when you set none. */
	maxRedemptions: number | null;
}

// ---------------------------------------------------------------------------
// Customers
// ---------------------------------------------------------------------------

export interface Customer {
	id: string;
	email: string;
	name: string | null;
	/** ISO 3166-1 alpha-2 country code. */
	country: string | null;
	vatNumber: string | null;
	stripeCustomerId: string | null;
	createdAt: string;
}

// ---------------------------------------------------------------------------
// Go live (merchant onboarding readiness)
// ---------------------------------------------------------------------------

/** Mirrors `GoLiveVerifyState` (server: gateway/domain/mor-verification-readiness.ts). */
export type VerifyState = 'unverified' | 'in_review' | 'on_hold' | 'verified' | 'rejected';

/** One thing ops asked the merchant to change. Mirrors `RfiItem`. */
export interface RfiItem {
	id: string;
	text: string;
	at: string;
}

/** Mirrors `GoLiveReadiness` (server: gateway/go-live/go-live.service.ts). Only
 *  the fields the CLI actually prints are declared. */
export interface GoLiveReadiness {
	triedIt: boolean;
	verifyState: VerifyState;
	hasPayoutAccount: boolean;
	canGoLive: boolean;
	progress: { done: number; total: number };
	rejectReason: string | null;
	cooldownUntil: string | null;
	heldReason: string | null;
	/** Open change requests only. Non-null means the merchant owes us something. */
	rfi: { question: string; askedAt: string; items: RfiItem[] } | null;
	/** Null until they ask for one. `reportUrl` is null while it is being written. */
	audit: {
		requestedAt: string;
		publishedAt: string | null;
		reportUrl: string | null;
		grade: string | null;
	} | null;
	milestones: {
		firstProductAt: string | null;
		firstTestPaymentAt: string | null;
		firstLivePaymentAt: string | null;
		livePaymentCount: number;
	};
}

// ---------------------------------------------------------------------------
// Account review (business verification + the free audit)
// ---------------------------------------------------------------------------

/** Same values the merchant dashboard writes. */
export type ProductCategory =
	| 'saas'
	| 'digital'
	| 'services'
	| 'marketplace'
	| 'physical'
	| 'other';

export type DeliveryMethod =
	| 'instant_digital'
	| 'email_delivery'
	| 'subscription_access'
	| 'manual'
	| 'scheduled_service'
	| 'physical_shipped'
	| 'other';

/** The subset of {@link DeliveryMethod} the audit request accepts
 *  (server: `RequestAuditDto.deliveryMethod`). */
export type AuditDeliveryMethod =
	| 'instant_digital'
	| 'scheduled_service'
	| 'physical_shipped'
	| 'other';

export type VolumeBand = 'under_1k' | '1k_10k' | '10k_50k' | 'over_50k';

export type AccountReviewStatus = 'pending' | 'in_review' | 'approved' | 'rejected';

export type AccountReviewEntityType = 'individual' | 'business';

export interface AccountReviewAddress {
	street: string;
	city: string;
	region?: string;
	/** Postal code. */
	postal?: string;
	/** ISO 3166-1 alpha-2 country code. */
	country: string;
}

/** The merchant's own acknowledgements as stored (read side, camelized). Every
 *  key is optional because a row created by the free audit alone carries only
 *  `audit` until the merchant submits verification. */
export interface AccountReviewChecklist {
	prohibitedOk?: boolean;
	checklistAck?: boolean;
	cooldownAck?: boolean;
	privacyOk?: boolean;
	tosOk?: boolean;
	hasUsageClaims?: boolean;
	noFalseClaimsOk?: boolean;
	hasCustomers?: boolean;
	trademarkOk?: boolean;
	pricingClearOk?: boolean;
	ethicalOk?: boolean;
	productCategory?: string;
	deliveryMethod?: string;
	volumeBand?: string;
	/** The free Revenue & Pricing Audit. Merchant writes `requestedAt`; ops
	 *  fills the rest when the report is done. Gates nothing. */
	audit?: {
		requestedAt?: string;
		publishedAt?: string | null;
		reportUrl?: string | null;
		score?: number | null;
		grade?: string | null;
	};
}

/** The verification on file (server: `AccountReviewResponse`). Live
 *  environment always — a review is about one real business. */
export interface AccountReview {
	status: AccountReviewStatus;
	entityType: AccountReviewEntityType;
	legalName: string | null;
	registrationNumber: string | null;
	/** ISO 3166-1 alpha-2 country code. */
	taxCountry: string | null;
	address: AccountReviewAddress | null;
	productUrl: string | null;
	productDescription: string | null;
	checklist: AccountReviewChecklist | null;
	rejectReason: string | null;
	cooldownUntil: string | null;
	/** Null until verification was actually submitted — the free audit alone
	 *  never sets it. */
	submittedAt: string | null;
	/** Null unless the merchant is on hold. */
	heldReason: string | null;
	/** Open change requests only. Non-null means the merchant owes us something. */
	rfi: { question: string; askedAt: string; items: RfiItem[] } | null;
}

/** The five things we check on the merchant's own live site before approving. */
export interface SiteChecklist {
	price_visible: boolean;
	terms: boolean;
	privacy: boolean;
	refunds: boolean;
	contact: boolean;
}

/** Write side of the checklist. Keys are snake_case because the server stores
 *  this object literally (request bodies are never transformed). The five
 *  required acknowledgements must all be true or the server rejects the submit. */
export interface SubmitAccountReviewChecklist {
	/** The business sells none of the categories AgentaOS does not support.
	 *  `false` is refused: the business cannot be verified. */
	prohibited_ok: boolean;
	checklist_ack: boolean;
	cooldown_ack: boolean;
	privacy_ok: boolean;
	tos_ok: boolean;
	has_usage_claims?: boolean;
	no_false_claims_ok?: boolean;
	has_customers?: boolean;
	trademark_ok?: boolean;
	pricing_clear_ok?: boolean;
	ethical_ok?: boolean;
	product_category?: ProductCategory;
	delivery_method?: DeliveryMethod;
	volume_band?: VolumeBand;
	/** When present every item must be true. */
	site_checklist?: SiteChecklist;
}

/** Body for `accountReview.submit()` (server: `SubmitAccountReviewDto`). */
export interface SubmitAccountReview {
	entityType: AccountReviewEntityType;
	/** Registered company name, or the individual's full legal name. */
	legalName: string;
	/** Required when `entityType` is `'business'`. */
	registrationNumber?: string;
	/** Country of registration, ISO 3166-1 alpha-2. */
	taxCountry: string;
	address: AccountReviewAddress;
	/** The merchant project page. http(s) only. */
	productUrl: string;
	productDescription?: string;
	/** Name buyers see on their statement. */
	displayName?: string;
	checklist: SubmitAccountReviewChecklist;
}

/** Body for `accountReview.requestAudit()` (server: `RequestAuditDto`). */
export interface RequestAudit {
	/** The page the audit reads. The only required field. http(s) only. */
	productUrl: string;
	productDescription?: string;
	productCategory?: ProductCategory;
	deliveryMethod?: AuditDeliveryMethod;
}

/** What `accountReview.requestAudit()` returns: the review row the audit was
 *  recorded on. `checklist.audit.requestedAt` is when we started owing the
 *  report; it does not move when the merchant asks again. */
export type AuditRequested = AccountReview;

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
	/** `true` = live mode, `false` = test mode. Account mode, not the chain — see `network` for the chain/rail. */
	livemode: boolean;
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
	/** `true` = live mode, `false` = test mode. */
	livemode: boolean;
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
	/** `true` = live mode, `false` = test mode. */
	livemode: boolean;
	description: string | null;
}

export interface SubscriptionData {
	id: string;
	/** Stripe subscription status, mirrored verbatim (e.g. `incomplete`, `active`, `trialing`, `past_due`, `unpaid`, `canceled`). */
	status: string;
	planName: string | null;
	/** The current plan's `paymentLinks.id`. */
	linkId: string;
	currency: string;
	/** Price snapshot in integer minor units (e.g. cents). */
	amountMinor: number;
	/** ISO 8601 timestamp, or `null` before the first billing cycle is set. */
	currentPeriodEnd: string | null;
	cancelAtPeriodEnd: boolean;
	/**
	 * Null unless a downgrade is scheduled. `subscription.updated` fires when a
	 * downgrade is scheduled (this is set), reverted (null again), an upgrade is
	 * applied, and when the scheduled plan takes over at the period end.
	 */
	pendingPlan: {
		linkId: string;
		planName: string | null;
		amountMinor: number;
		/** ISO 8601. */
		effectiveAt: string;
	} | null;
	customerEmail: string | null;
	customerName: string | null;
	/** `true` = live mode, `false` = test mode. */
	livemode: boolean;
}

/** `dispute.created` / `dispute.closed`: a buyer's bank opened, or closed, a chargeback on a sale. */
export interface DisputeData {
	disputeId: string;
	status: string;
	transactionId: string;
	amountMinor: number;
	currency: string;
	livemode: boolean;
}

/** `account.updated` (Connect, Stripe's name): a business's verification changed. Field names are
 *  camelCase, as `webhooks.verify()` returns every event (the wire JSON is snake_case). */
export interface AccountUpdatedData {
	/** Where the business's review stands, in the words the dashboard uses. */
	verification: 'unverified' | 'in_review' | 'verified' | 'on_hold' | 'rejected';
	/** We have asked the business something and are waiting on it. */
	changesRequested: boolean;
	/** The identity check is done — its own, or its company's for another app of the same company. */
	identityVerified: boolean;
	livemode: boolean;
}

/** `webhook.test`: the sample event the dashboard sends so you can check your endpoint. */
export interface WebhookTestData {
	message: string;
	livemode: boolean;
}

/**
 * Every event we send. `business` names the business it happened in — your own id, or one of
 * the businesses you manage (Connect: your webhook also receives your clients' events).
 */
export type WebhookEvent = (
	| { type: 'checkout.session.completed'; data: CheckoutCompletedData }
	| { type: 'send.completed'; data: SendCompletedData }
	| { type: 'send.failed'; data: SendFailedData }
	| { type: 'subscription.created'; data: SubscriptionData }
	| { type: 'subscription.renewed'; data: SubscriptionData }
	| { type: 'subscription.payment_failed'; data: SubscriptionData }
	| { type: 'subscription.updated'; data: SubscriptionData }
	| { type: 'subscription.canceled'; data: SubscriptionData }
	| { type: 'dispute.created'; data: DisputeData }
	| { type: 'dispute.closed'; data: DisputeData }
	| { type: 'account.updated'; data: AccountUpdatedData }
	| { type: 'webhook.test'; data: WebhookTestData }
) & { business: string };

// ---------------------------------------------------------------------------
// Businesses (Connect)
// ---------------------------------------------------------------------------

/** Where a business stands — the pill the Businesses list shows. */
export type BusinessStatus =
	| 'test_only'
	| 'in_review'
	| 'changes_needed'
	| 'on_hold'
	| 'rejected'
	| 'live';

/** A business you manage: a client's business, or another app of your own company. */
export interface Business {
	id: string;
	name: string;
	country: string | null;
	status: BusinessStatus;
	/** You — the platform that manages it. */
	platformOrgId: string;
	createdAt: string;
	/** Your share of its sales: basis points of the price before VAT, plus a fixed amount. */
	platformFee: { bps: number; fixedMinor: number };
	/** Another app of your own company: verified and priced with you, carries no share. */
	sameLegalEntity: boolean;
	/** Your share of its live sales this month, per currency, ready to show. */
	feesThisMonth: Array<{ currency: string; feesMinor: number; feesDisplay: string }>;
	/** Who an open invitation is waiting on, or null. */
	invitedEmail: string | null;
	/** Its identity check is done (its own, or its company's). */
	identityVerified: boolean;
}

export interface CreateBusinessParams {
	/** What buyers see. */
	name: string;
	/** Where it is registered, ISO 3166-1 alpha-2. */
	country: string;
	/** Invite your client as its admin. Omit to run it yourself. */
	clientEmail?: string;
	/** Another app of your own company instead of a client's business. */
	sameLegalEntity?: boolean;
	/** Default true. False: no email from us — send `inviteUrl` yourself (white-label). */
	sendInvitationEmail?: boolean;
}

export interface CreatedBusiness {
	business: Business;
	/** Present when `clientEmail` was given. */
	inviteToken: string | null;
	/** The link your client opens to accept. */
	inviteUrl: string | null;
}

export interface BusinessInvitation {
	inviteToken: string;
	inviteUrl: string;
}

export interface VerificationLink {
	/** The identity check your client completes — only they can. Null: already verified. */
	url: string | null;
	status: string;
}
