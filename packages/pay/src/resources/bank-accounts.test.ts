// @vitest-environment node
/**
 * Bank accounts: where a business's payouts go. A platform saves them for the businesses it
 * manages, from its own app, with `{ business }` on the call or the client; a merchant for
 * itself. Thin references come back, never the account number.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AgentaOS } from '../client.js';

interface Call {
	url: string;
	method?: string;
	body?: string;
	account: string | null;
}

function stub(responseBody: unknown = { ok: true }, status = 200): Call[] {
	const calls: Call[] = [];
	vi.stubGlobal(
		'fetch',
		vi.fn(async (url: string, init?: RequestInit) => {
			const headers = (init?.headers ?? {}) as Record<string, string>;
			calls.push({
				url: String(url),
				method: init?.method,
				body: init?.body as string | undefined,
				account: headers['agentaos-account'] ?? null,
			});
			return new Response(JSON.stringify(responseBody), {
				status,
				headers: { 'content-type': 'application/json' },
			});
		}),
	);
	return calls;
}

const BASE = { baseUrl: 'https://api.example.com' };
const url = (call: Call | undefined) => new URL(call?.url ?? '');
afterEach(() => vi.unstubAllGlobals());

describe('bankAccounts', () => {
	const platform = () => new AgentaOS('sk_live_key', BASE);

	it('requirements → GET /gateway/bank-accounts/requirements?currency=', async () => {
		const calls = stub({ quoteId: 'q1', requirements: [] });
		await platform().bankAccounts.requirements('EUR', { business: 'biz_1' });
		expect(calls[0]?.method).toBe('GET');
		expect(url(calls[0]).pathname).toBe('/api/v1/gateway/bank-accounts/requirements');
		expect(url(calls[0]).searchParams.get('currency')).toBe('EUR');
		expect(calls[0]?.account).toBe('biz_1');
	});

	it('refreshRequirements → POST /gateway/bank-accounts/requirements/refresh', async () => {
		const calls = stub([]);
		await platform().bankAccounts.refreshRequirements(
			{ quoteId: 'q1', details: { legalType: 'BUSINESS' } },
			{ business: 'biz_1' },
		);
		expect(calls[0]?.method).toBe('POST');
		expect(calls[0]?.account).toBe('biz_1');
		expect(url(calls[0]).pathname).toBe('/api/v1/gateway/bank-accounts/requirements/refresh');
		expect(JSON.parse(calls[0]?.body ?? '{}')).toEqual({
			quoteId: 'q1',
			details: { legalType: 'BUSINESS' },
		});
	});

	it('create → POST /gateway/bank-accounts for the business, fields as given', async () => {
		const calls = stub({ id: 'acc_1', account_identifier_last4: '3000', payable: true });
		const saved = await platform().bankAccounts.create(
			{
				currency: 'EUR',
				type: 'iban',
				accountHolderName: 'Seller GmbH',
				legalType: 'BUSINESS',
				details: { IBAN: 'DE89370400440532013000' },
			},
			{ business: 'biz_1' },
		);
		expect([calls[0]?.method, url(calls[0]).pathname, calls[0]?.account]).toEqual([
			'POST',
			'/api/v1/gateway/bank-accounts',
			'biz_1',
		]);
		expect(JSON.parse(calls[0]?.body ?? '{}')).toMatchObject({
			currency: 'EUR',
			accountHolderName: 'Seller GmbH',
		});
		// Wire snake_case arrives camelCase, as on every resource.
		expect(saved.accountIdentifierLast4).toBe('3000');
	});

	it('list → GET /gateway/bank-accounts', async () => {
		const calls = stub([]);
		await platform().bankAccounts.list({ business: 'biz_1' });
		expect([calls[0]?.method, url(calls[0]).pathname, calls[0]?.account]).toEqual([
			'GET',
			'/api/v1/gateway/bank-accounts',
			'biz_1',
		]);
	});

	it('deactivate → DELETE /gateway/bank-accounts/:id', async () => {
		const calls = stub({ success: true });
		await platform().bankAccounts.deactivate('acc_1', { business: 'biz_1' });
		expect([calls[0]?.method, url(calls[0]).pathname]).toEqual([
			'DELETE',
			'/api/v1/gateway/bank-accounts/acc_1',
		]);
		expect(calls[0]?.account).toBe('biz_1');
	});

	// Before we open bank accounts by API for the platform, adding one is refused with the
	// server's reason, surfaced the way every other refusal is.
	it('surfaces the closed gate as a PermissionError with the server\'s code', async () => {
		stub(
			{
				statusCode: 403,
				message: 'Bank accounts by API are not enabled for your platform.',
				code: 'bank_accounts_by_api_closed',
			},
			403,
		);
		await expect(
			platform().bankAccounts.create(
				{
					currency: 'EUR',
					type: 'iban',
					accountHolderName: 'Nordvik Studio OÜ',
					legalType: 'BUSINESS',
					details: { IBAN: 'EE00' },
				},
				{ business: 'biz_1' },
			),
		).rejects.toMatchObject({ name: 'PermissionError', status: 403 });
	});
});
