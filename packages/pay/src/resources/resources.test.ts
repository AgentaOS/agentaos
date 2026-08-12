// @vitest-environment node
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AgentaOS } from '../client.js';

interface FetchCall {
	url: string;
	method?: string;
	body?: string;
}

/** Capture method + url + body of each call and return a scripted response body. */
function stubRoutes(responseBody: unknown = { ok: true }): FetchCall[] {
	const calls: FetchCall[] = [];
	vi.stubGlobal(
		'fetch',
		vi.fn(async (url: string, init?: RequestInit) => {
			calls.push({
				url: String(url),
				method: init?.method,
				body: init?.body as string | undefined,
			});
			const isText = typeof responseBody === 'string';
			return new Response(isText ? (responseBody as string) : JSON.stringify(responseBody), {
				status: 200,
				headers: isText ? {} : { 'content-type': 'application/json' },
			});
		}),
	);
	return calls;
}

function client(): AgentaOS {
	return new AgentaOS('sk_test_key', { baseUrl: 'https://api.example.com' });
}

function pathOf(call: FetchCall | undefined): string {
	return new URL(call?.url ?? '').pathname;
}

afterEach(() => vi.unstubAllGlobals());

describe('checkouts', () => {
	it('create → POST /api/v1/gateway/sessions', async () => {
		const calls = stubRoutes();
		await client().checkouts.create({ amount: 10 });
		expect(calls[0]?.method).toBe('POST');
		expect(pathOf(calls[0])).toBe('/api/v1/gateway/sessions');
	});

	it('list → GET /api/v1/gateway/sessions with query params', async () => {
		const calls = stubRoutes({ items: [], total: 0, has_more: false });
		await client().checkouts.list({ status: 'open', limit: 5, offset: 10 });
		const url = new URL(calls[0]?.url ?? '');
		expect(calls[0]?.method).toBe('GET');
		expect(url.pathname).toBe('/api/v1/gateway/sessions');
		expect(url.searchParams.get('status')).toBe('open');
		expect(url.searchParams.get('limit')).toBe('5');
		expect(url.searchParams.get('offset')).toBe('10');
	});

	it('retrieve → GET /api/v1/gateway/sessions/:id', async () => {
		const calls = stubRoutes();
		await client().checkouts.retrieve('sess_123');
		expect(calls[0]?.method).toBe('GET');
		expect(pathOf(calls[0])).toBe('/api/v1/gateway/sessions/sess_123');
	});

	it('cancel → POST /api/v1/gateway/sessions/:id/cancel', async () => {
		const calls = stubRoutes();
		await client().checkouts.cancel('sess_123');
		expect(calls[0]?.method).toBe('POST');
		expect(pathOf(calls[0])).toBe('/api/v1/gateway/sessions/sess_123/cancel');
	});

	it('camelizes the create response', async () => {
		stubRoutes({ id: 'sess_1', seller_mode: 'mor', payment_link_id: 'pl_1' });
		const checkout = await client().checkouts.create({ amount: 10 });
		expect(checkout).toMatchObject({ sellerMode: 'mor', paymentLinkId: 'pl_1' });
	});
});

describe('paymentLinks', () => {
	it('create → POST /api/v1/gateway/payment-links', async () => {
		const calls = stubRoutes();
		await client().paymentLinks.create({ amount: 29.99 });
		expect(calls[0]?.method).toBe('POST');
		expect(pathOf(calls[0])).toBe('/api/v1/gateway/payment-links');
	});

	it('list → GET /api/v1/gateway/payment-links with pagination params', async () => {
		const calls = stubRoutes({ items: [], total: 0, has_more: false });
		await client().paymentLinks.list({ limit: 25, offset: 50 });
		const url = new URL(calls[0]?.url ?? '');
		expect(calls[0]?.method).toBe('GET');
		expect(url.pathname).toBe('/api/v1/gateway/payment-links');
		expect(url.searchParams.get('limit')).toBe('25');
		expect(url.searchParams.get('offset')).toBe('50');
	});

	it('retrieve → GET /api/v1/gateway/payment-links/:id', async () => {
		const calls = stubRoutes();
		await client().paymentLinks.retrieve('pl_9');
		expect(calls[0]?.method).toBe('GET');
		expect(pathOf(calls[0])).toBe('/api/v1/gateway/payment-links/pl_9');
	});

	it('cancel → DELETE /api/v1/gateway/payment-links/:id', async () => {
		const calls = stubRoutes();
		await client().paymentLinks.cancel('pl_9');
		expect(calls[0]?.method).toBe('DELETE');
		expect(pathOf(calls[0])).toBe('/api/v1/gateway/payment-links/pl_9');
	});

	it('camelizes the create response, including name and image_url', async () => {
		stubRoutes({ id: 'pl_1', name: 'Pro Plan', image_url: 'https://cdn.example.com/pro-plan.png' });
		const link = await client().paymentLinks.create({ amount: 29.99 });
		expect(link).toMatchObject({
			name: 'Pro Plan',
			imageUrl: 'https://cdn.example.com/pro-plan.png',
		});
	});
});

describe('transactions', () => {
	it('list → GET /api/v1/gateway/all-transactions with filter params', async () => {
		const calls = stubRoutes({ items: [], total: 0, has_more: false });
		await client().transactions.list({
			direction: 'inbound',
			from: '2026-01-01',
			to: '2026-02-01',
			limit: 20,
		});
		const url = new URL(calls[0]?.url ?? '');
		expect(calls[0]?.method).toBe('GET');
		expect(url.pathname).toBe('/api/v1/gateway/all-transactions');
		expect(url.searchParams.get('direction')).toBe('inbound');
		expect(url.searchParams.get('from')).toBe('2026-01-01');
		expect(url.searchParams.get('to')).toBe('2026-02-01');
		expect(url.searchParams.get('limit')).toBe('20');
	});

	it('camelizes list items in the response', async () => {
		stubRoutes({
			items: [{ id: 't1', payer_address: '0xabc', settlement_token: 'EURC' }],
			total: 1,
			has_more: false,
		});
		const page = await client().transactions.list();
		expect(page.hasMore).toBe(false);
		expect(page.items[0]).toMatchObject({ payerAddress: '0xabc', settlementToken: 'EURC' });
	});
});

describe('invoices', () => {
	it('list → GET /api/v1/gateway/invoices with status filter', async () => {
		const calls = stubRoutes({ items: [], total: 0, has_more: false });
		await client().invoices.list({ status: 'issued', from: '2026-01-01', to: '2026-02-01' });
		const url = new URL(calls[0]?.url ?? '');
		expect(calls[0]?.method).toBe('GET');
		expect(url.pathname).toBe('/api/v1/gateway/invoices');
		expect(url.searchParams.get('status')).toBe('issued');
	});

	it('retrieve → GET /api/v1/gateway/invoices/:id', async () => {
		const calls = stubRoutes();
		await client().invoices.retrieve('inv_5');
		expect(calls[0]?.method).toBe('GET');
		expect(pathOf(calls[0])).toBe('/api/v1/gateway/invoices/inv_5');
	});

	it('void → POST /api/v1/gateway/invoices/:id/void', async () => {
		const calls = stubRoutes();
		await client().invoices.void('inv_5');
		expect(calls[0]?.method).toBe('POST');
		expect(pathOf(calls[0])).toBe('/api/v1/gateway/invoices/inv_5/void');
	});

	it('downloadPdf → GET /api/v1/gateway/invoices/:id/pdf returning a Buffer', async () => {
		const calls = stubRoutes('%PDF-1.7 bytes');
		const buffer = await client().invoices.downloadPdf('inv_5');
		expect(calls[0]?.method).toBe('GET');
		expect(pathOf(calls[0])).toBe('/api/v1/gateway/invoices/inv_5/pdf');
		expect(Buffer.isBuffer(buffer)).toBe(true);
		expect(buffer.toString('utf-8')).toBe('%PDF-1.7 bytes');
	});

	it('downloadStatement → GET /api/v1/gateway/invoices/statement with from/to', async () => {
		const calls = stubRoutes('statement-bytes');
		await client().invoices.downloadStatement({ from: '2026-01-01', to: '2026-03-01' });
		const url = new URL(calls[0]?.url ?? '');
		expect(calls[0]?.method).toBe('GET');
		expect(url.pathname).toBe('/api/v1/gateway/invoices/statement');
		expect(url.searchParams.get('from')).toBe('2026-01-01');
		expect(url.searchParams.get('to')).toBe('2026-03-01');
	});

	it('exportCsv → GET /api/v1/gateway/invoices/export returning raw text', async () => {
		const calls = stubRoutes('number,amount\nINV-1,100');
		const csv = await client().invoices.exportCsv({ status: 'issued' });
		const url = new URL(calls[0]?.url ?? '');
		expect(calls[0]?.method).toBe('GET');
		expect(url.pathname).toBe('/api/v1/gateway/invoices/export');
		expect(url.searchParams.get('status')).toBe('issued');
		expect(csv).toBe('number,amount\nINV-1,100');
	});

	it('getReceipt → GET /api/v1/gateway/invoices/:id/receipt returning a Buffer', async () => {
		const calls = stubRoutes('%PDF-receipt-bytes');
		const buffer = await client().invoices.getReceipt('inv_5');
		expect(calls[0]?.method).toBe('GET');
		expect(pathOf(calls[0])).toBe('/api/v1/gateway/invoices/inv_5/receipt');
		expect(Buffer.isBuffer(buffer)).toBe(true);
		expect(buffer.toString('utf-8')).toBe('%PDF-receipt-bytes');
	});

	it('sendReceipt → POST /api/v1/gateway/invoices/:id/send-receipt (camelized)', async () => {
		const calls = stubRoutes({ ok: true, sent_to: 'buyer@example.com' });
		const res = await client().invoices.sendReceipt('inv_5');
		expect(calls[0]?.method).toBe('POST');
		expect(pathOf(calls[0])).toBe('/api/v1/gateway/invoices/inv_5/send-receipt');
		expect(res).toMatchObject({ ok: true, sentTo: 'buyer@example.com' });
	});
});

describe('subscriptions', () => {
	it('list → GET /api/v1/gateway/subscriptions with pagination params, returning a camelized envelope', async () => {
		const calls = stubRoutes({
			items: [
				{
					id: 'sub_1',
					customer_email: 'a@b.com',
					unit_amount_minor: 1999,
					current_period_end: '2026-09-01T00:00:00Z',
					stripe_subscription_id: 'sub_x',
				},
			],
			total: 1,
			has_more: false,
		});
		const page = await client().subscriptions.list({ limit: 5, offset: 10 });
		const url = new URL(calls[0]?.url ?? '');
		expect(calls[0]?.method).toBe('GET');
		expect(url.pathname).toBe('/api/v1/gateway/subscriptions');
		expect(url.searchParams.get('limit')).toBe('5');
		expect(url.searchParams.get('offset')).toBe('10');
		expect(page.total).toBe(1);
		expect(page.hasMore).toBe(false);
		expect(page.items[0]).toMatchObject({
			customerEmail: 'a@b.com',
			unitAmountMinor: 1999,
			currentPeriodEnd: '2026-09-01T00:00:00Z',
			stripeSubscriptionId: 'sub_x',
		});
	});

	it('cancel → POST /api/v1/gateway/subscriptions/:id/cancel with atPeriodEnd:true by default', async () => {
		const calls = stubRoutes({ status: 'active', cancel_at_period_end: true });
		const res = await client().subscriptions.cancel('sub_1');
		expect(calls[0]?.method).toBe('POST');
		expect(pathOf(calls[0])).toBe('/api/v1/gateway/subscriptions/sub_1/cancel');
		expect(JSON.parse(calls[0]?.body ?? '{}')).toEqual({ atPeriodEnd: true });
		expect(res).toMatchObject({ cancelAtPeriodEnd: true });
	});

	it('cancel({ atPeriodEnd: false }) → sends the immediate-cancel body', async () => {
		const calls = stubRoutes({ status: 'canceled', cancel_at_period_end: false });
		await client().subscriptions.cancel('sub_1', { atPeriodEnd: false });
		expect(JSON.parse(calls[0]?.body ?? '{}')).toEqual({ atPeriodEnd: false });
	});
});

describe('customers', () => {
	it('list → GET /api/v1/gateway/customers with pagination params, returning a camelized envelope', async () => {
		const calls = stubRoutes({
			items: [{ id: 'cus_1', email: 'a@b.com', vat_number: 'DE123', stripe_customer_id: 'cus_x' }],
			total: 1,
			has_more: false,
		});
		const page = await client().customers.list({ limit: 5, offset: 10 });
		const url = new URL(calls[0]?.url ?? '');
		expect(calls[0]?.method).toBe('GET');
		expect(url.pathname).toBe('/api/v1/gateway/customers');
		expect(url.searchParams.get('limit')).toBe('5');
		expect(url.searchParams.get('offset')).toBe('10');
		expect(page.total).toBe(1);
		expect(page.hasMore).toBe(false);
		expect(page.items[0]).toMatchObject({
			email: 'a@b.com',
			vatNumber: 'DE123',
			stripeCustomerId: 'cus_x',
		});
	});
});
