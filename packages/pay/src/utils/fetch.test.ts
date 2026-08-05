// @vitest-environment node
import { afterEach, describe, expect, it, vi } from 'vitest';
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
import { request, requestRaw, requestText } from './fetch.js';

interface FetchCall {
	url: string;
	method?: string;
	headers: Record<string, string>;
	body?: string;
}

/**
 * Stub global fetch with a scripted sequence of responses (or thrown errors),
 * one per attempt. Records the exact url/method/headers/body the SDK put on the
 * wire so assertions target the real request, never the mock's own behavior.
 */
function scriptFetch(steps: Array<() => Response | Promise<Response>>): FetchCall[] {
	const calls: FetchCall[] = [];
	let i = 0;
	vi.stubGlobal(
		'fetch',
		vi.fn(async (url: string, init?: RequestInit) => {
			calls.push({
				url: String(url),
				method: init?.method,
				headers: (init?.headers ?? {}) as Record<string, string>,
				body: init?.body as string | undefined,
			});
			const step = steps[Math.min(i, steps.length - 1)];
			i += 1;
			if (!step) throw new Error('scriptFetch called with no scripted step');
			return step();
		}),
	);
	return calls;
}

function jsonResponse(
	body: unknown,
	init?: { status?: number; headers?: Record<string, string> },
): Response {
	return new Response(JSON.stringify(body), {
		status: init?.status ?? 200,
		headers: { 'content-type': 'application/json', ...(init?.headers ?? {}) },
	});
}

const ok = () => jsonResponse({ ok: true });

interface Options {
	baseUrl: string;
	apiKey: string;
	method: 'GET' | 'POST' | 'DELETE';
	path: string;
	query?: Record<string, string | number | undefined>;
	body?: unknown;
	timeout: number;
	maxRetries: number;
	idempotencyKey?: string;
	authMode?: 'api-key' | 'jwt';
}

function baseOptions(overrides: Partial<Options> = {}): Options {
	return {
		baseUrl: 'https://api.example.com',
		apiKey: 'sk_test_key',
		method: 'GET',
		path: '/api/v1/gateway/invoices',
		timeout: 30_000,
		maxRetries: 0,
		authMode: 'api-key',
		...overrides,
	};
}

/**
 * Drive a request to completion under fake timers so retry sleeps resolve
 * instantly. The outcome handler is attached BEFORE timers advance, so a
 * rejection surfaced mid-advance is never an unhandled rejection.
 */
async function runUnderFakeTimers<T>(start: () => Promise<T>): Promise<T> {
	vi.useFakeTimers();
	try {
		const settled = start().then(
			(value) => ({ ok: true as const, value }),
			(error: unknown) => ({ ok: false as const, error }),
		);
		await vi.runAllTimersAsync();
		const outcome = await settled;
		if (outcome.ok) return outcome.value;
		throw outcome.error;
	} finally {
		vi.useRealTimers();
	}
}

afterEach(() => vi.unstubAllGlobals());

describe('headers', () => {
	it('sends x-api-key when authMode is api-key', async () => {
		const calls = scriptFetch([ok]);
		await request(baseOptions({ authMode: 'api-key', apiKey: 'sk_test_abc' }));
		expect(calls[0]?.headers['x-api-key']).toBe('sk_test_abc');
		expect(calls[0]?.headers.authorization).toBeUndefined();
	});

	it('sends authorization Bearer when authMode is jwt', async () => {
		const calls = scriptFetch([ok]);
		await request(baseOptions({ authMode: 'jwt', apiKey: 'a.b.c' }));
		expect(calls[0]?.headers.authorization).toBe('Bearer a.b.c');
		expect(calls[0]?.headers['x-api-key']).toBeUndefined();
	});

	it('always sends accept application/json', async () => {
		const calls = scriptFetch([ok]);
		await request(baseOptions());
		expect(calls[0]?.headers.accept).toBe('application/json');
	});

	it('sets content-type application/json on POST with a body', async () => {
		const calls = scriptFetch([ok]);
		await request(baseOptions({ method: 'POST', body: { amount: 10 } }));
		expect(calls[0]?.headers['content-type']).toBe('application/json');
	});

	it('omits content-type on GET', async () => {
		const calls = scriptFetch([ok]);
		await request(baseOptions({ method: 'GET' }));
		expect(calls[0]?.headers['content-type']).toBeUndefined();
	});

	it('omits content-type on POST without a body', async () => {
		const calls = scriptFetch([ok]);
		await request(baseOptions({ method: 'POST' }));
		expect(calls[0]?.headers['content-type']).toBeUndefined();
	});
});

describe('idempotency key', () => {
	const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

	it('generates a UUID idempotency-key on POST when none is passed', async () => {
		const calls = scriptFetch([ok]);
		await request(baseOptions({ method: 'POST', body: { amount: 10 } }));
		expect(calls[0]?.headers['idempotency-key']).toMatch(UUID);
	});

	it('uses the passed idempotency-key on POST', async () => {
		const calls = scriptFetch([ok]);
		await request(
			baseOptions({ method: 'POST', body: { amount: 10 }, idempotencyKey: 'idem-123' }),
		);
		expect(calls[0]?.headers['idempotency-key']).toBe('idem-123');
	});

	it('sets an idempotency-key on POST even without a body', async () => {
		const calls = scriptFetch([ok]);
		await request(baseOptions({ method: 'POST' }));
		expect(calls[0]?.headers['idempotency-key']).toMatch(UUID);
	});

	it('does not set an idempotency-key on GET', async () => {
		const calls = scriptFetch([ok]);
		await request(baseOptions({ method: 'GET' }));
		expect(calls[0]?.headers['idempotency-key']).toBeUndefined();
	});
});

describe('request body', () => {
	it('sends the body as-is in camelCase (never snake-cased)', async () => {
		const calls = scriptFetch([ok]);
		await request(
			baseOptions({ method: 'POST', body: { billingInterval: 'month', taxRateId: 't1' } }),
		);
		expect(JSON.parse(calls[0]?.body ?? '{}')).toEqual({
			billingInterval: 'month',
			taxRateId: 't1',
		});
	});

	it('sends no body on GET', async () => {
		const calls = scriptFetch([ok]);
		await request(baseOptions({ method: 'GET' }));
		expect(calls[0]?.body).toBeUndefined();
	});
});

describe('query string', () => {
	it('appends defined query params and skips undefined ones', async () => {
		const calls = scriptFetch([ok]);
		await request(baseOptions({ query: { status: 'open', limit: 5, missing: undefined } }));
		const url = new URL(calls[0]?.url ?? '');
		expect(url.searchParams.get('status')).toBe('open');
		expect(url.searchParams.get('limit')).toBe('5');
		expect(url.searchParams.has('missing')).toBe(false);
	});
});

describe('response transform', () => {
	it('camelizes the response body', async () => {
		scriptFetch([() => jsonResponse({ seller_mode: 'crypto', created_at: '2026-01-01' })]);
		const result = await request<{ sellerMode: string; createdAt: string }>(baseOptions());
		expect(result).toEqual({ sellerMode: 'crypto', createdAt: '2026-01-01' });
	});
});

describe('retries that eventually succeed', () => {
	it('retries a 429 with retry-after <= 60 then succeeds', async () => {
		const calls = scriptFetch([
			() => jsonResponse({ error: 'slow down' }, { status: 429, headers: { 'retry-after': '1' } }),
			() => jsonResponse({ ok: true }),
		]);
		const result = await runUnderFakeTimers(() =>
			request<{ ok: boolean }>(baseOptions({ maxRetries: 2 })),
		);
		expect(result).toEqual({ ok: true });
		expect(calls).toHaveLength(2);
	});

	it('retries a 5xx with exponential backoff then succeeds', async () => {
		const calls = scriptFetch([
			() => jsonResponse({ error: 'boom' }, { status: 503 }),
			() => jsonResponse({ ok: true }),
		]);
		const result = await runUnderFakeTimers(() =>
			request<{ ok: boolean }>(baseOptions({ maxRetries: 2 })),
		);
		expect(result).toEqual({ ok: true });
		expect(calls).toHaveLength(2);
	});

	it('retries a network error then succeeds', async () => {
		const calls = scriptFetch([
			() => {
				throw new Error('ECONNRESET');
			},
			() => jsonResponse({ ok: true }),
		]);
		const result = await runUnderFakeTimers(() =>
			request<{ ok: boolean }>(baseOptions({ maxRetries: 2 })),
		);
		expect(result).toEqual({ ok: true });
		expect(calls).toHaveLength(2);
	});
});

describe('retries exhausted', () => {
	it('throws ApiError after exhausting retries on repeated 5xx', async () => {
		scriptFetch([() => jsonResponse({ message: 'still down' }, { status: 500 })]);
		await expect(
			runUnderFakeTimers(() => request(baseOptions({ maxRetries: 1 }))),
		).rejects.toBeInstanceOf(ApiError);
	});

	it('throws a network AgentaOSError after exhausting retries on repeated network errors', async () => {
		scriptFetch([
			() => {
				throw new Error('ECONNRESET');
			},
		]);
		await expect(
			runUnderFakeTimers(() => request(baseOptions({ maxRetries: 1 }))),
		).rejects.toMatchObject({ code: 'network_error', status: 0 });
	});
});

describe('error mapping by status', () => {
	it('maps 400 to ValidationError carrying errors[]', async () => {
		scriptFetch([
			() =>
				jsonResponse(
					{ message: 'bad input', errors: [{ field: 'amount', message: 'required' }] },
					{ status: 400 },
				),
		]);
		const error = await request(baseOptions()).catch((e) => e);
		expect(error).toBeInstanceOf(ValidationError);
		expect((error as ValidationError).errors).toEqual([{ field: 'amount', message: 'required' }]);
	});

	it('maps 401 to AuthenticationError', async () => {
		scriptFetch([() => jsonResponse({ message: 'nope' }, { status: 401 })]);
		await expect(request(baseOptions())).rejects.toBeInstanceOf(AuthenticationError);
	});

	it('maps 403 to PermissionError', async () => {
		scriptFetch([() => jsonResponse({ message: 'forbidden' }, { status: 403 })]);
		await expect(request(baseOptions())).rejects.toBeInstanceOf(PermissionError);
	});

	it('maps 404 to NotFoundError', async () => {
		scriptFetch([() => jsonResponse({ message: 'missing' }, { status: 404 })]);
		await expect(request(baseOptions())).rejects.toBeInstanceOf(NotFoundError);
	});

	it('maps 409 to IdempotencyError', async () => {
		scriptFetch([() => jsonResponse({ message: 'dup' }, { status: 409 })]);
		await expect(request(baseOptions())).rejects.toBeInstanceOf(IdempotencyError);
	});

	it('maps 429 (no more retries) to RateLimitError with retryAfter in ms', async () => {
		scriptFetch([
			() =>
				jsonResponse({ message: 'slow down' }, { status: 429, headers: { 'retry-after': '30' } }),
		]);
		const error = await request(baseOptions({ maxRetries: 0 })).catch((e) => e);
		expect(error).toBeInstanceOf(RateLimitError);
		expect((error as RateLimitError).retryAfter).toBe(30_000);
	});

	it('defaults RateLimitError retryAfter to 60000ms when no retry-after header', async () => {
		scriptFetch([() => jsonResponse({ message: 'slow down' }, { status: 429 })]);
		const error = await request(baseOptions({ maxRetries: 0 })).catch((e) => e);
		expect((error as RateLimitError).retryAfter).toBe(60_000);
	});

	it('maps 5xx to ApiError when retries are disabled', async () => {
		scriptFetch([() => jsonResponse({ message: 'server' }, { status: 502 })]);
		const error = await request(baseOptions({ maxRetries: 0 })).catch((e) => e);
		expect(error).toBeInstanceOf(ApiError);
		expect((error as ApiError).status).toBe(502);
	});

	it('maps an unmapped 4xx to a generic AgentaOSError', async () => {
		scriptFetch([() => jsonResponse({ message: 'teapot' }, { status: 418 })]);
		const error = await request(baseOptions({ maxRetries: 0 })).catch((e) => e);
		expect(error).toBeInstanceOf(AgentaOSError);
		expect((error as AgentaOSError).code).toBe('unknown_error');
		expect((error as AgentaOSError).status).toBe(418);
	});

	it('maps an AbortError to TimeoutError', async () => {
		scriptFetch([
			() => {
				throw new DOMException('The operation was aborted', 'AbortError');
			},
		]);
		await expect(request(baseOptions({ maxRetries: 2 }))).rejects.toBeInstanceOf(TimeoutError);
	});

	it('propagates x-request-id onto the mapped error', async () => {
		scriptFetch([
			() =>
				jsonResponse(
					{ message: 'missing' },
					{ status: 404, headers: { 'x-request-id': 'req_42' } },
				),
		]);
		const error = await request(baseOptions()).catch((e) => e);
		expect((error as NotFoundError).requestId).toBe('req_42');
	});
});

describe('requestRaw', () => {
	it('GETs the path and returns the body as a Buffer', async () => {
		const calls = scriptFetch([() => new Response('PDFBYTES', { status: 200 })]);
		const buffer = await requestRaw(baseOptions({ path: '/api/v1/gateway/invoices/i1/pdf' }));
		expect(calls[0]?.method).toBe('GET');
		expect(new URL(calls[0]?.url ?? '').pathname).toBe('/api/v1/gateway/invoices/i1/pdf');
		expect(Buffer.isBuffer(buffer)).toBe(true);
		expect(buffer.toString('utf-8')).toBe('PDFBYTES');
	});

	it('maps error responses through handleErrorResponse', async () => {
		scriptFetch([() => jsonResponse({ message: 'missing' }, { status: 404 })]);
		await expect(requestRaw(baseOptions({ path: '/x/pdf' }))).rejects.toBeInstanceOf(NotFoundError);
	});
});

describe('requestText', () => {
	it('GETs the path and returns the raw text body', async () => {
		const calls = scriptFetch([() => new Response('a,b,c\n1,2,3', { status: 200 })]);
		const text = await requestText(baseOptions({ path: '/api/v1/gateway/invoices/export' }));
		expect(calls[0]?.method).toBe('GET');
		expect(text).toBe('a,b,c\n1,2,3');
	});
});
