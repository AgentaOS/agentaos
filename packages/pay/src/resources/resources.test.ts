// @vitest-environment node
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AgentaOS } from '../client.js';

interface FetchCall {
	url: string;
	method?: string;
	body?: string;
}

/** Capture method + url + body of each call and return a scripted response body. */
function stubRoutes(responseBody: unknown = { ok: true }, status = 200): FetchCall[] {
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
				status,
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

	it('previewPlanChange → GET …/plan-change/preview?targetLinkId=… and returns the quote', async () => {
		const calls = stubRoutes({
			direction: 'upgrade',
			currency: 'eur',
			due_today_minor: 1234,
			due_today_vat_minor: 239,
			effective_at: '2026-09-03T10:00:00.000Z',
			next_invoice_minor: 4900,
			next_invoice_vat_minor: 1176,
			next_invoice_at: '2026-10-03T10:45:13.000Z',
			proration_date: 1788434542,
		});
		const quote = await client().subscriptions.previewPlanChange('sub_1', 'link_2');
		const url = new URL(calls[0]?.url ?? '');
		expect(calls[0]?.method ?? 'GET').toBe('GET');
		expect(url.pathname).toBe('/api/v1/gateway/subscriptions/sub_1/plan-change/preview');
		expect(url.searchParams.get('targetLinkId')).toBe('link_2');
		expect(quote).toMatchObject({
			direction: 'upgrade',
			dueTodayMinor: 1234,
			prorationDate: 1788434542,
		});
	});

	it('changePlan → POST …/plan-change echoing the quoted prorationDate', async () => {
		const calls = stubRoutes({
			direction: 'upgrade',
			applied: true,
			status: 'active',
			unit_amount_minor: 4900,
			currency: 'eur',
		});
		const res = await client().subscriptions.changePlan('sub_1', {
			targetLinkId: 'link_2',
			prorationDate: 1788434542,
		});
		expect(calls[0]?.method).toBe('POST');
		expect(pathOf(calls[0])).toBe('/api/v1/gateway/subscriptions/sub_1/plan-change');
		expect(JSON.parse(calls[0]?.body ?? '{}')).toEqual({
			targetLinkId: 'link_2',
			prorationDate: 1788434542,
		});
		expect(res).toMatchObject({ direction: 'upgrade', applied: true, unitAmountMinor: 4900 });
	});

	it('invoices → GET /api/v1/gateway/subscriptions/:id/invoices', async () => {
		const calls = stubRoutes([
			{ id: 'inv_1', invoice_number: 'INV-2026-0001', issued_at: '2026-08-18T00:00:00Z' },
		]);
		const rows = await client().subscriptions.invoices('sub_1');
		expect(calls[0]?.method).toBe('GET');
		expect(pathOf(calls[0])).toBe('/api/v1/gateway/subscriptions/sub_1/invoices');
		expect(rows[0]).toMatchObject({
			invoiceNumber: 'INV-2026-0001',
			issuedAt: '2026-08-18T00:00:00Z',
		});
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

describe('goLive', () => {
	it('get → GET /api/v1/gateway/go-live returning the readiness object as-is', async () => {
		const calls = stubRoutes({
			triedIt: true,
			verifyState: 'unverified',
			hasPayoutAccount: false,
			canGoLive: false,
			progress: { done: 1, total: 3 },
			rfi: null,
			audit: null,
		});
		const readiness = await client().goLive.get();
		expect(calls[0]?.method).toBe('GET');
		expect(pathOf(calls[0])).toBe('/api/v1/gateway/go-live');
		expect(readiness).toMatchObject({ verifyState: 'unverified', progress: { done: 1, total: 3 } });
	});
});

describe('accountReview', () => {
	const review = {
		status: 'in_review',
		entity_type: 'business',
		legal_name: 'Acme OÜ',
		registration_number: '16961316',
		tax_country: 'EE',
		address: { street: 'Sepapaja 6', city: 'Tallinn', country: 'EE' },
		product_url: 'https://acme.example',
		product_description: null,
		checklist: { prohibited_ok: true, product_category: 'saas' },
		reject_reason: null,
		cooldown_until: null,
		submitted_at: '2026-09-09T10:00:00Z',
		heldReason: null,
		rfi: null,
	};

	it('get → GET /api/v1/gateway/account-review, unwrapping and camelizing the review', async () => {
		const calls = stubRoutes({ review, prefill: { legal_name_default: null } });
		const res = await client().accountReview.get();
		expect(calls[0]?.method).toBe('GET');
		expect(pathOf(calls[0])).toBe('/api/v1/gateway/account-review');
		expect(res).toMatchObject({
			status: 'in_review',
			entityType: 'business',
			legalName: 'Acme OÜ',
			submittedAt: '2026-09-09T10:00:00Z',
			checklist: { prohibitedOk: true, productCategory: 'saas' },
		});
	});

	it('get → null when nothing is on file yet', async () => {
		stubRoutes({ review: null, prefill: { legal_name_default: null } });
		expect(await client().accountReview.get()).toBeNull();
	});

	it('get → null on 404', async () => {
		stubRoutes({ message: 'Not found' }, 404);
		expect(await client().accountReview.get()).toBeNull();
	});

	it('submit → POST /api/v1/gateway/account-review with the body untouched', async () => {
		const calls = stubRoutes({ review });
		const body = {
			entityType: 'business' as const,
			legalName: 'Acme OÜ',
			registrationNumber: '16961316',
			taxCountry: 'EE',
			address: { street: 'Sepapaja 6', city: 'Tallinn', country: 'EE' },
			productUrl: 'https://acme.example',
			displayName: 'Acme',
			checklist: {
				prohibited_ok: true,
				checklist_ack: true,
				cooldown_ack: true,
				privacy_ok: true,
				tos_ok: true,
				product_category: 'saas' as const,
				volume_band: '1k_10k' as const,
			},
		};
		const res = await client().accountReview.submit(body);
		expect(calls[0]?.method).toBe('POST');
		expect(pathOf(calls[0])).toBe('/api/v1/gateway/account-review');
		expect(JSON.parse(calls[0]?.body ?? '{}')).toEqual(body);
		expect(res).toMatchObject({ status: 'in_review', legalName: 'Acme OÜ' });
	});

	it('resubmit → POST /api/v1/gateway/account-review/resubmit with an empty body', async () => {
		const calls = stubRoutes({ review });
		const res = await client().accountReview.resubmit();
		expect(calls[0]?.method).toBe('POST');
		expect(pathOf(calls[0])).toBe('/api/v1/gateway/account-review/resubmit');
		expect(JSON.parse(calls[0]?.body ?? 'null')).toEqual({});
		expect(res).toMatchObject({ status: 'in_review' });
	});

	it('requestAudit → POST /api/v1/gateway/account-review/audit with the product facts', async () => {
		const calls = stubRoutes({
			review: {
				...review,
				status: 'pending',
				submitted_at: null,
				checklist: { audit: { requestedAt: '2026-09-09T10:00:00Z' } },
			},
		});
		const body = {
			productUrl: 'https://acme.example',
			productDescription: 'Invoices for freelancers',
			productCategory: 'saas' as const,
			deliveryMethod: 'instant_digital' as const,
		};
		const res = await client().accountReview.requestAudit(body);
		expect(calls[0]?.method).toBe('POST');
		expect(pathOf(calls[0])).toBe('/api/v1/gateway/account-review/audit');
		expect(JSON.parse(calls[0]?.body ?? '{}')).toEqual(body);
		expect(res).toMatchObject({
			submittedAt: null,
			checklist: { audit: { requestedAt: '2026-09-09T10:00:00Z' } },
		});
	});
});

describe('orgId option', () => {
	function sessionClient(orgId?: string): AgentaOS {
		const jwt = 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJ1XzEifQ.c2ln';
		return new AgentaOS(jwt, { baseUrl: 'https://api.example.com', orgId });
	}

	it('never sends orgId for an API key, even when the option is set', async () => {
		const calls = stubRoutes({ 'GET /api/v1/gateway/customers': { items: [], total: 0 } });
		const client = new AgentaOS('sk_test_abc123', {
			baseUrl: 'https://api.example.com',
			orgId: 'org_1',
		});
		await client.customers.list({ limit: 1 });
		expect(calls[0]?.url).not.toContain('orgId');
	});

	it('appends orgId to every request, reads and writes alike, when set', async () => {
		const calls = stubRoutes({ items: [], total: 0, has_more: false });
		const client = sessionClient('org_7');
		await client.goLive.get();
		await client.paymentLinks.list({ limit: 5 });
		await client.subscriptions.cancel('sub_1');
		expect(calls.map((call) => new URL(call.url).searchParams.get('orgId'))).toEqual([
			'org_7',
			'org_7',
			'org_7',
		]);
	});

	it('sends no orgId when the option is absent', async () => {
		const calls = stubRoutes({ items: [], total: 0, has_more: false });
		await sessionClient().customers.list({ limit: 5 });
		expect(new URL(calls[0]?.url ?? '').searchParams.has('orgId')).toBe(false);
	});
});
