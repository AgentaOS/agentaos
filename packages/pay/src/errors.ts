export class AgentaOSError extends Error {
	constructor(
		message: string,
		readonly status: number,
		readonly code: string,
		readonly requestId?: string,
	) {
		super(message);
		this.name = 'AgentaOSError';
	}
}

export class AuthenticationError extends AgentaOSError {
	constructor(message: string, requestId?: string) {
		super(message, 401, 'authentication_error', requestId);
		this.name = 'AuthenticationError';
	}
}

export class PermissionError extends AgentaOSError {
	constructor(message: string, requestId?: string) {
		super(message, 403, 'permission_error', requestId);
		this.name = 'PermissionError';
	}
}

export class NotFoundError extends AgentaOSError {
	constructor(message: string, requestId?: string) {
		super(message, 404, 'not_found', requestId);
		this.name = 'NotFoundError';
	}
}

export class ValidationError extends AgentaOSError {
	readonly errors: Array<{ field: string; message: string }>;

	constructor(
		message: string,
		errors: Array<{ field: string; message: string }>,
		requestId?: string,
	) {
		super(message, 400, 'validation_error', requestId);
		this.name = 'ValidationError';
		this.errors = errors;
	}
}

export class RateLimitError extends AgentaOSError {
	readonly retryAfter: number;

	constructor(message: string, retryAfter: number, requestId?: string) {
		super(message, 429, 'rate_limit', requestId);
		this.name = 'RateLimitError';
		this.retryAfter = retryAfter;
	}
}

export class IdempotencyError extends AgentaOSError {
	constructor(message: string, requestId?: string) {
		super(message, 409, 'idempotency_error', requestId);
		this.name = 'IdempotencyError';
	}
}

export class ApiError extends AgentaOSError {
	constructor(message: string, status: number, requestId?: string) {
		super(message, status, 'api_error', requestId);
		this.name = 'ApiError';
	}
}

export class WebhookVerificationError extends AgentaOSError {
	constructor(message: string) {
		super(message, 0, 'webhook_verification_error');
		this.name = 'WebhookVerificationError';
	}
}

export class TimeoutError extends AgentaOSError {
	constructor(message: string) {
		super(message, 0, 'timeout_error');
		this.name = 'TimeoutError';
	}
}
