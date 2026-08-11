// @vitest-environment node
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AgentaOS } from './client.js';
import { CheckoutsResource } from './resources/checkouts.js';
import { InvoicesResource } from './resources/invoices.js';
import { PaymentLinksResource } from './resources/payment-links.js';
import { TransactionsResource } from './resources/transactions.js';
import { WebhooksResource } from './resources/webhooks.js';

interface FetchCall {
	url: string;
	headers: Record<string, string>;
}

/** Capture the url + headers of the first request so auth mode / baseUrl are provable. */
function captureCall(): FetchCall[] {
	const calls: FetchCall[] = [];
	vi.stubGlobal(
		'fetch',
		vi.fn(async (url: string, init?: RequestInit) => {
			calls.push({ url: String(url), headers: (init?.headers ?? {}) as Record<string, string> });
			return new Response(JSON.stringify({ id: 'x' }), {
				status: 200,
				headers: { 'content-type': 'application/json' },
			});
		}),
	);
	return calls;
}

afterEach(() => vi.unstubAllGlobals());

describe('auth mode detection', () => {
	it('sends x-api-key for an sk_test_ key', async () => {
		const calls = captureCall();
		await new AgentaOS('sk_test_abc123').invoices.retrieve('i1');
		expect(calls[0]?.headers['x-api-key']).toBe('sk_test_abc123');
		expect(calls[0]?.headers.authorization).toBeUndefined();
	});

	it('sends x-api-key for an sk_live_ key', async () => {
		const calls = captureCall();
		await new AgentaOS('sk_live_prod999').invoices.retrieve('i1');
		expect(calls[0]?.headers['x-api-key']).toBe('sk_live_prod999');
		expect(calls[0]?.headers.authorization).toBeUndefined();
	});

	it('sends authorization Bearer for a 3-part JWT', async () => {
		const calls = captureCall();
		const jwt = 'header.payload.signature';
		await new AgentaOS(jwt).invoices.retrieve('i1');
		expect(calls[0]?.headers.authorization).toBe(`Bearer ${jwt}`);
		expect(calls[0]?.headers['x-api-key']).toBeUndefined();
	});
});

describe('invalid key format', () => {
	it('throws for a key that is neither sk_ nor a JWT', () => {
		expect(() => new AgentaOS('nonsense')).toThrow('Invalid API key format');
	});

	it('throws for a 2-part dotted token (not a valid JWT)', () => {
		expect(() => new AgentaOS('header.payload')).toThrow('Invalid API key format');
	});

	it('throws for a 4-part dotted token (not a valid JWT)', () => {
		expect(() => new AgentaOS('a.b.c.d')).toThrow('Invalid API key format');
	});
});

describe('browser guard', () => {
	it('throws when both window and document exist', () => {
		vi.stubGlobal('window', {});
		vi.stubGlobal('document', {});
		expect(() => new AgentaOS('sk_test_abc')).toThrow('server-side SDK');
	});

	it('does not trip when only window exists (needs both)', () => {
		vi.stubGlobal('window', {});
		expect(() => new AgentaOS('sk_test_abc')).not.toThrow();
	});
});

describe('baseUrl', () => {
	it('defaults to https://api.agentaos.ai', async () => {
		const calls = captureCall();
		await new AgentaOS('sk_test_abc').invoices.retrieve('i1');
		expect(new URL(calls[0]?.url ?? '').origin).toBe('https://api.agentaos.ai');
	});

	it('honors a baseUrl override', async () => {
		const calls = captureCall();
		await new AgentaOS('sk_test_abc', { baseUrl: 'https://staging.example.com' }).invoices.retrieve(
			'i1',
		);
		expect(new URL(calls[0]?.url ?? '').origin).toBe('https://staging.example.com');
	});
});

describe('resource wiring', () => {
	const client = new AgentaOS('sk_test_abc');

	it('wires the checkouts resource', () => {
		expect(client.checkouts).toBeInstanceOf(CheckoutsResource);
	});

	it('wires the paymentLinks resource', () => {
		expect(client.paymentLinks).toBeInstanceOf(PaymentLinksResource);
	});

	it('wires the transactions resource', () => {
		expect(client.transactions).toBeInstanceOf(TransactionsResource);
	});

	it('wires the invoices resource', () => {
		expect(client.invoices).toBeInstanceOf(InvoicesResource);
	});

	it('wires the webhooks resource', () => {
		expect(client.webhooks).toBeInstanceOf(WebhooksResource);
	});
});
