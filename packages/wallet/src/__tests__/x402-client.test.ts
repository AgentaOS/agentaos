import { afterEach, describe, expect, it, vi } from 'vitest';
import { checkX402, discoverX402 } from '../lib/x402-client.js';

// `checkX402` / `discoverX402` call the global `fetch`. We mock it here so these
// are deterministic unit tests. (The old version hit https://httpbin.org live and
// was flaky — 15s timeouts and a different assertion failing on each run.)

function response(
	status: number,
	init?: { headers?: Record<string, string>; body?: string },
): Response {
	return new Response(init?.body ?? '', { status, headers: init?.headers });
}

afterEach(() => {
	vi.unstubAllGlobals();
});

describe('x402-client', () => {
	it('checkX402 returns requires402=false for a non-402 URL', async () => {
		vi.stubGlobal(
			'fetch',
			vi.fn(async () => response(200)),
		);
		const result = await checkX402('https://example.com/free');
		expect(result.requires402).toBe(false);
		expect(result.url).toBe('https://example.com/free');
	});

	it('checkX402 returns requires402=true for a 402 URL', async () => {
		vi.stubGlobal(
			'fetch',
			vi.fn(async () => response(402)),
		);
		const result = await checkX402('https://example.com/paid');
		expect(result.requires402).toBe(true);
	});

	it('checkX402 parses payment requirements from a JSON 402 body', async () => {
		const paymentRequired = {
			x402Version: 1,
			accepts: [{ scheme: 'exact', network: 'eip155:84532', amount: '1000000', asset: '0xUSDC' }],
		};
		vi.stubGlobal(
			'fetch',
			vi.fn(async () =>
				response(402, {
					headers: { 'content-type': 'application/json' },
					body: JSON.stringify(paymentRequired),
				}),
			),
		);
		const result = await checkX402('https://example.com/paid');
		expect(result.requires402).toBe(true);
		expect(result.paymentRequired?.accepts[0]?.amount).toBe('1000000');
	});

	it('discoverX402 returns empty when nothing requires payment', async () => {
		// .well-known/x402 → 404 (no manifest); every probe → 200 (no 402)
		vi.stubGlobal(
			'fetch',
			vi.fn(async (url: string | URL) =>
				String(url).includes('/.well-known/x402') ? response(404) : response(200),
			),
		);
		const result = await discoverX402('example.com');
		expect(result.domain).toBe('example.com');
		expect(result.endpoints).toEqual([]);
	});

	it('discoverX402 reads the .well-known/x402 manifest when present', async () => {
		const manifest = {
			endpoints: [
				{
					path: '/api/data',
					method: 'GET',
					scheme: 'exact',
					network: 'eip155:84532',
					amount: '1000000',
					asset: '0xUSDC',
				},
			],
		};
		vi.stubGlobal(
			'fetch',
			vi.fn(async (url: string | URL) =>
				String(url).includes('/.well-known/x402')
					? response(200, {
							headers: { 'content-type': 'application/json' },
							body: JSON.stringify(manifest),
						})
					: response(200),
			),
		);
		const result = await discoverX402('https://example.com');
		expect(result.endpoints).toHaveLength(1);
		expect(result.endpoints[0]?.path).toBe('/api/data');
	});
});
