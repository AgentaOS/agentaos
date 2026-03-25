import {
	AgentaOSError,
	ApiError,
	AuthenticationError,
	IdempotencyError,
	NotFoundError,
	PermissionError,
	RateLimitError,
	TimeoutError,
	ValidationError,
} from '../errors.js';
import { camelToSnake, snakeToCamel } from './transform.js';

interface RequestOptions {
	baseUrl: string;
	apiKey: string;
	method: 'GET' | 'POST' | 'DELETE';
	path: string;
	query?: Record<string, string | number | undefined>;
	body?: unknown;
	timeout: number;
	maxRetries: number;
	idempotencyKey?: string;
	debug?: boolean;
	logger?: (level: string, message: string) => void;
	authMode?: 'api-key' | 'jwt';
}

function buildUrl(
	baseUrl: string,
	path: string,
	query?: Record<string, string | number | undefined>,
): string {
	const url = new URL(`${baseUrl}${path}`);
	if (query) {
		for (const [key, value] of Object.entries(query)) {
			if (value !== undefined) {
				url.searchParams.set(key, String(value));
			}
		}
	}
	return url.toString();
}

function generateIdempotencyKey(): string {
	return crypto.randomUUID();
}

function log(options: RequestOptions, level: string, message: string): void {
	if (!options.debug) return;
	if (options.logger) {
		options.logger(level, message);
	} else {
		process.stderr.write(`[agentaos] ${message}\n`);
	}
}

async function handleErrorResponse(
	response: Response,
	requestId: string | undefined,
): Promise<never> {
	let body: Record<string, unknown> = {};
	try {
		body = (await response.json()) as Record<string, unknown>;
	} catch {
		// body stays empty
	}

	const message =
		typeof body.message === 'string'
			? body.message
			: typeof body.error === 'string'
				? body.error
				: `Request failed with status ${response.status}`;

	switch (response.status) {
		case 400: {
			const errors = Array.isArray(body.errors)
				? (body.errors as Array<{ field: string; message: string }>)
				: [];
			throw new ValidationError(message, errors, requestId);
		}
		case 401:
			throw new AuthenticationError(message, requestId);
		case 403:
			throw new PermissionError(message, requestId);
		case 404:
			throw new NotFoundError(
				'Resource not found. Ensure the resource belongs to your organization.',
				requestId,
			);
		case 409:
			throw new IdempotencyError(message, requestId);
		case 429: {
			const retryAfterHeader = response.headers.get('retry-after');
			const retryAfter = retryAfterHeader ? Number.parseInt(retryAfterHeader, 10) * 1000 : 60_000;
			throw new RateLimitError(
				`Rate limited. Retry after ${retryAfter}ms. Consider reducing request frequency.`,
				retryAfter,
				requestId,
			);
		}
		default:
			if (response.status >= 500) {
				throw new ApiError(message, response.status, requestId);
			}
			throw new AgentaOSError(message, response.status, 'unknown_error', requestId);
	}
}

export async function request<T>(options: RequestOptions): Promise<T> {
	const { baseUrl, apiKey, method, path, query, body, timeout, maxRetries, idempotencyKey } =
		options;

	const url = buildUrl(baseUrl, path, query);

	const headers: Record<string, string> = {
		accept: 'application/json',
	};
	if (options.authMode === 'jwt') {
		headers.authorization = `Bearer ${apiKey}`;
	} else {
		headers['x-api-key'] = apiKey;
	}

	if (method === 'POST' && body !== undefined) {
		headers['content-type'] = 'application/json';
	}

	if (method === 'POST') {
		headers['idempotency-key'] = idempotencyKey ?? generateIdempotencyKey();
	}

	// Server DTOs use camelCase — don't transform request bodies
	const serializedBody = method === 'POST' && body !== undefined ? JSON.stringify(body) : undefined;

	let lastError: Error | undefined;

	for (let attempt = 0; attempt <= maxRetries; attempt++) {
		const controller = new AbortController();
		const timer = setTimeout(() => controller.abort(), timeout);
		const start = Date.now();

		try {
			const response = await fetch(url, {
				method,
				headers,
				body: serializedBody,
				signal: controller.signal,
			});

			clearTimeout(timer);

			const elapsed = Date.now() - start;
			log(options, 'debug', `${method} ${path} -> ${response.status} (${elapsed}ms)`);

			const requestId = response.headers.get('x-request-id') ?? undefined;

			if (response.ok) {
				const json = await response.json();
				return snakeToCamel(json) as T;
			}

			// Handle 429 — retry once if Retry-After is reasonable
			if (response.status === 429 && attempt < maxRetries) {
				const retryAfterHeader = response.headers.get('retry-after');
				const retryAfterSec = retryAfterHeader ? Number.parseInt(retryAfterHeader, 10) : 1;
				if (retryAfterSec <= 60) {
					log(options, 'warn', `Rate limited, retrying after ${retryAfterSec}s`);
					await sleep(retryAfterSec * 1000);
					continue;
				}
			}

			// Handle 5xx — retry with exponential backoff
			if (response.status >= 500 && attempt < maxRetries) {
				const delay = Math.min(1000 * 2 ** attempt, 10_000);
				log(
					options,
					'warn',
					`Server error ${response.status}, retrying in ${delay}ms (attempt ${attempt + 1}/${maxRetries})`,
				);
				await sleep(delay);
				lastError = new ApiError(`Server error ${response.status}`, response.status, requestId);
				continue;
			}

			await handleErrorResponse(response, requestId);
		} catch (error) {
			clearTimeout(timer);

			if (error instanceof AgentaOSError) {
				throw error;
			}

			if (error instanceof DOMException && error.name === 'AbortError') {
				throw new TimeoutError(
					`Request timed out after ${timeout}ms. Try increasing the timeout option.`,
				);
			}

			// Network errors — retry
			if (attempt < maxRetries) {
				const delay = Math.min(1000 * 2 ** attempt, 10_000);
				log(
					options,
					'warn',
					`Network error, retrying in ${delay}ms (attempt ${attempt + 1}/${maxRetries})`,
				);
				lastError = error instanceof Error ? error : new Error(String(error));
				await sleep(delay);
				continue;
			}

			throw new AgentaOSError(
				`Failed to connect to ${baseUrl}. Check your internet connection and firewall settings.`,
				0,
				'network_error',
			);
		}
	}

	// Should not be reached, but as a safety net
	throw lastError ?? new AgentaOSError('Request failed after retries', 0, 'unknown_error');
}

export async function requestRaw(options: RequestOptions): Promise<Buffer> {
	const { baseUrl, apiKey, path, query, timeout } = options;
	const url = buildUrl(baseUrl, path, query);

	const headers: Record<string, string> = {};
	if (options.authMode === 'jwt') {
		headers.authorization = `Bearer ${apiKey}`;
	} else {
		headers['x-api-key'] = apiKey;
	}

	const controller = new AbortController();
	const timer = setTimeout(() => controller.abort(), timeout);

	try {
		const response = await fetch(url, {
			method: 'GET',
			headers,
			signal: controller.signal,
		});

		clearTimeout(timer);

		if (!response.ok) {
			const requestId = response.headers.get('x-request-id') ?? undefined;
			await handleErrorResponse(response, requestId);
		}

		const arrayBuffer = await response.arrayBuffer();
		return Buffer.from(arrayBuffer);
	} catch (error) {
		clearTimeout(timer);
		if (error instanceof AgentaOSError) throw error;
		if (error instanceof DOMException && error.name === 'AbortError') {
			throw new TimeoutError(
				`Request timed out after ${timeout}ms. Try increasing the timeout option.`,
			);
		}
		throw new AgentaOSError(
			`Failed to connect to ${baseUrl}. Check your internet connection and firewall settings.`,
			0,
			'network_error',
		);
	}
}

export async function requestText(options: RequestOptions): Promise<string> {
	const { baseUrl, apiKey, path, query, timeout } = options;
	const url = buildUrl(baseUrl, path, query);

	const headers: Record<string, string> = {};
	if (options.authMode === 'jwt') {
		headers.authorization = `Bearer ${apiKey}`;
	} else {
		headers['x-api-key'] = apiKey;
	}

	const controller = new AbortController();
	const timer = setTimeout(() => controller.abort(), timeout);

	try {
		const response = await fetch(url, {
			method: 'GET',
			headers,
			signal: controller.signal,
		});

		clearTimeout(timer);

		if (!response.ok) {
			const requestId = response.headers.get('x-request-id') ?? undefined;
			await handleErrorResponse(response, requestId);
		}

		return await response.text();
	} catch (error) {
		clearTimeout(timer);
		if (error instanceof AgentaOSError) throw error;
		if (error instanceof DOMException && error.name === 'AbortError') {
			throw new TimeoutError(
				`Request timed out after ${timeout}ms. Try increasing the timeout option.`,
			);
		}
		throw new AgentaOSError(
			`Failed to connect to ${baseUrl}. Check your internet connection and firewall settings.`,
			0,
			'network_error',
		);
	}
}

function sleep(ms: number): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, ms));
}
