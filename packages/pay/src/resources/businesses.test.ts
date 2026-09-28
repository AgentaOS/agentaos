// @vitest-environment node
/**
 * Connect (PRD §6.1 R9-2): a platform manages its clients' businesses and acts for one — Stripe
 * Connect's shape. `business` sends `AgentaOS-Account` (Stripe's `Stripe-Account`), on the client
 * or on one call; `businesses` is the list / retrieve / create / invitation / ID-check-link API.
 */
import { afterEach, describe, expect, expectTypeOf, it, vi } from 'vitest';
import { AgentaOS } from '../client.js';
import type { WebhookEvent } from '../types.js';

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
			return new Response(status === 204 ? null : JSON.stringify(responseBody), {
				status,
				headers: status === 204 ? {} : { 'content-type': 'application/json' },
			});
		}),
	);
	return calls;
}

const path = (call: Call | undefined) => new URL(call?.url ?? '').pathname;
const BASE = { baseUrl: 'https://api.example.com' };
afterEach(() => vi.unstubAllGlobals());

describe('acting for a business (AgentaOS-Account)', () => {
	it('a client made for a business sends it on every call', async () => {
		const calls = stub({ items: [], total: 0, hasMore: false });
		const client = new AgentaOS('sk_test_key', { ...BASE, business: 'biz_1' });

		await client.checkouts.list();
		await client.customers.list();

		expect(calls.map((c) => c.account)).toEqual(['biz_1', 'biz_1']);
	});

	it('one call can act for another business; the rest stay as they were', async () => {
		const calls = stub({ items: [], total: 0, hasMore: false });
		const platform = new AgentaOS('sk_test_key', BASE);

		await platform.checkouts.list(undefined, { business: 'biz_2' });
		await platform.checkouts.list();

		expect(calls.map((c) => c.account)).toEqual(['biz_2', null]);
	});

	it('a per-call business wins over the client’s', async () => {
		const calls = stub({ items: [], total: 0, hasMore: false });
		const client = new AgentaOS('sk_test_key', { ...BASE, business: 'biz_1' });

		await client.paymentLinks.list(undefined, { business: 'biz_2' });

		expect(calls[0]?.account).toBe('biz_2');
	});
});

describe('businesses', () => {
	const platform = () => new AgentaOS('sk_test_key', BASE);

	it('list → GET /gateway/businesses', async () => {
		const calls = stub([]);
		await platform().businesses.list();
		expect([calls[0]?.method, path(calls[0])]).toEqual(['GET', '/api/v1/gateway/businesses']);
	});

	it('retrieve → GET /gateway/businesses/:id', async () => {
		const calls = stub({ id: 'biz_1' });
		await platform().businesses.retrieve('biz_1');
		expect([calls[0]?.method, path(calls[0])]).toEqual(['GET', '/api/v1/gateway/businesses/biz_1']);
	});

	it('create → POST with the fields as given; returns the invite link to send', async () => {
		const calls = stub({
			business: { id: 'biz_1' },
			inviteToken: 't',
			inviteUrl: 'https://app/invite/t',
		});

		const created = await platform().businesses.create({
			name: 'ClientCo',
			country: 'EE',
			clientEmail: 'ana@clientco.com',
			sendInvitationEmail: false,
		});

		expect([calls[0]?.method, path(calls[0])]).toEqual(['POST', '/api/v1/gateway/businesses']);
		expect(JSON.parse(calls[0]?.body ?? '{}')).toEqual({
			name: 'ClientCo',
			country: 'EE',
			clientEmail: 'ana@clientco.com',
			sendInvitationEmail: false,
		});
		expect(created.inviteUrl).toBe('https://app/invite/t');
	});

	it('resendInvitation → POST /:id/invitation', async () => {
		const calls = stub({ inviteToken: 't2', inviteUrl: 'https://app/invite/t2' });
		await platform().businesses.resendInvitation('biz_1', { sendInvitationEmail: false });
		expect([calls[0]?.method, path(calls[0])]).toEqual([
			'POST',
			'/api/v1/gateway/businesses/biz_1/invitation',
		]);
		expect(JSON.parse(calls[0]?.body ?? '{}')).toEqual({ sendInvitationEmail: false });
	});

	it('revokeInvitation → DELETE /:id/invitation', async () => {
		const calls = stub(undefined, 204);
		await platform().businesses.revokeInvitation('biz_1');
		expect([calls[0]?.method, path(calls[0])]).toEqual([
			'DELETE',
			'/api/v1/gateway/businesses/biz_1/invitation',
		]);
	});

	it('createVerificationLink → POST /:id/verification-link', async () => {
		const calls = stub({ url: 'https://verify.didit.me/session/x', status: 'Not Started' });
		const link = await platform().businesses.createVerificationLink('biz_1');
		expect([calls[0]?.method, path(calls[0])]).toEqual([
			'POST',
			'/api/v1/gateway/businesses/biz_1/verification-link',
		]);
		expect(link.url).toBe('https://verify.didit.me/session/x');
	});
});

describe('WebhookEvent', () => {
	it('lists every event the server sends, each naming its business', () => {
		expectTypeOf<WebhookEvent['type']>().toEqualTypeOf<
			| 'checkout.session.completed'
			| 'send.completed'
			| 'send.failed'
			| 'subscription.created'
			| 'subscription.renewed'
			| 'subscription.payment_failed'
			| 'subscription.updated'
			| 'subscription.canceled'
			| 'dispute.created'
			| 'dispute.closed'
			| 'account.updated'
			| 'webhook.test'
		>();
		expectTypeOf<WebhookEvent['business']>().toEqualTypeOf<string>();
	});
});

describe('webhooks.verify on Connect events', () => {
	it('account.updated reads in camelCase, like every event the SDK returns', async () => {
		const { createHmac } = await import('node:crypto');
		const agentaos = new AgentaOS('sk_test_key', BASE);
		const body = JSON.stringify({
			id: 'evt_1',
			type: 'account.updated',
			business: 'biz_1',
			data: {
				verification: 'verified',
				changes_requested: false,
				identity_verified: true,
				livemode: true,
			},
		});
		const t = Math.floor(Date.now() / 1000);
		const v1 = createHmac('sha256', 'whsec_test').update(`${t}.${body}`).digest('hex');

		const event = agentaos.webhooks.verify(body, `t=${t},v1=${v1}`, 'whsec_test');

		expect(event.business).toBe('biz_1');
		if (event.type !== 'account.updated') throw new Error('wrong type');
		expect(event.data.identityVerified).toBe(true);
		expect(event.data.changesRequested).toBe(false);
	});
});
