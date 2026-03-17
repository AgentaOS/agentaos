export { AgentaOS } from './client.js';
export type { AgentaOSOptions } from './types.js';

// Re-export all types
export type {
	PaymentLink,
	CreatePaymentLinkParams,
	CheckoutField,
	Checkout,
	CreateCheckoutParams,
	ListCheckoutParams,
	Transaction,
	ListTransactionParams,
	Invoice,
	ListInvoiceParams,
	WebhookEvent,
	CheckoutCompletedData,
	SendCompletedData,
	SendFailedData,
	PaginatedList,
	ListParams,
} from './types.js';

// Re-export errors
export {
	AgentaOSError,
	AuthenticationError,
	PermissionError,
	NotFoundError,
	ValidationError,
	RateLimitError,
	IdempotencyError,
	ApiError,
	WebhookVerificationError,
	TimeoutError,
} from './errors.js';
