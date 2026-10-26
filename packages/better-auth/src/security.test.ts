import { createHmac } from 'node:crypto';
import { AgentaOS } from '@agentaos/pay';
import { betterAuth } from 'better-auth';
import { memoryAdapter } from 'better-auth/adapters/memory';
import { describe, expect, it, vi } from 'vitest';
import { agentaos } from './index.js';

const SECRET = 'whsec_test';
const BASE = 'http://localhost:3000';

function setup() {
	const client = new AgentaOS('sk_test_dummy');
	const create = vi.spyOn(client.checkouts, 'create').mockResolvedValue({
		sessionId: 'cs_1',
		checkoutUrl: 'https://app.agentaos.ai/pay/cs_1',
	} as never);
	const list = vi.spyOn(client.subscriptions, 'list').mockResolvedValue({
		items: [{ id: 'sub_victim', customerEmail: 'victim@example.com', planName: 'Pro' }],
		total: 1,
		hasMore: false,
	} as never);
	const onEvent = vi.fn();
	const auth = betterAuth({
		baseURL: BASE,
		secret: 'a-test-secret-that-is-long-enough-123',
		database: memoryAdapter({
			user: [],
			session: [],
			account: [],
			verification: [],
			agentaosSubscription: [],
		}),
		emailAndPassword: { enabled: true },
		// Better Auth turns the origin check off in test environments; turn it on to test production.
		advanced: { disableOriginCheck: false },
		plugins: [
			agentaos({
				client,
				products: [{ slug: 'pro', productId: 'link_pro' }],
				successUrl: `${BASE}/thanks`,
				webhookSecret: SECRET,
				onEvent,
			}),
		],
	});
	return { auth, create, list, onEvent };
}

async function signUp(auth: ReturnType<typeof setup>['auth'], email: string) {
	const res = await auth.api.signUpEmail({
		body: { email, password: 'password1234', name: 'X' },
		asResponse: true,
	});
	return (res.headers.get('set-cookie') ?? '').split(';')[0] ?? '';
}

const post = (path: string, headers: Record<string, string>, body: string) =>
	new Request(`${BASE}/api/auth${path}`, { method: 'POST', headers, body });

describe('security', () => {
	it('rejects a checkout started from another site (CSRF)', async () => {
		const { auth, create } = setup();
		const cookie = await signUp(auth, 'ana@example.com');
		const res = await auth.handler(
			post(
				'/agentaos/checkout',
				{ 'content-type': 'application/json', cookie, origin: 'https://evil.example' },
				'{"slug":"pro"}',
			),
		);
		expect(res.status).toBe(403);
		expect(create).not.toHaveBeenCalled();
	});

	it('ignores a product id or URL smuggled into the checkout body', async () => {
		const { auth, create } = setup();
		const cookie = await signUp(auth, 'ana@example.com');
		await auth.handler(
			post(
				'/agentaos/checkout',
				{ 'content-type': 'application/json', cookie, origin: BASE },
				JSON.stringify({
					slug: 'pro',
					productId: 'link_cheap',
					linkId: 'link_cheap',
					successUrl: 'https://evil.example',
				}),
			),
		);
		expect(create).toHaveBeenCalledWith(
			expect.objectContaining({ linkId: 'link_pro', successUrl: `${BASE}/thanks` }),
		);
	});

	it('gives no access to a subscription by matching email alone', async () => {
		const { auth, list } = setup();
		// Someone signs up with the buyer's address; no checkout of theirs created the subscription.
		const cookie = await signUp(auth, 'victim@example.com');
		const listed = await auth.handler(
			new Request(`${BASE}/api/auth/agentaos/subscriptions`, { headers: { cookie } }),
		);
		expect(await listed.json()).toEqual({ subscriptions: [] });
		expect(list).not.toHaveBeenCalled();
		const cancel = await auth.handler(
			post(
				'/agentaos/cancel-subscription',
				{ 'content-type': 'application/json', cookie, origin: BASE },
				JSON.stringify({ subscriptionId: 'sub_victim' }),
			),
		);
		expect(cancel.status).toBe(404);
	});

	it('rejects a cancel or plan change started from another site (CSRF)', async () => {
		const { auth } = setup();
		const cookie = await signUp(auth, 'ana@example.com');
		for (const path of ['/agentaos/cancel-subscription', '/agentaos/change-plan']) {
			const res = await auth.handler(
				post(
					path,
					{ 'content-type': 'application/json', cookie, origin: 'https://evil.example' },
					JSON.stringify({ subscriptionId: 'sub_victim', slug: 'pro' }),
				),
			);
			expect(res.status).toBe(403);
		}
	});

	it('rejects a replayed webhook older than 5 minutes', async () => {
		const { auth, onEvent } = setup();
		const payload =
			'{"type":"webhook.test","business":"b","data":{"message":"hi","livemode":false}}';
		const t = Math.floor(Date.now() / 1000) - 600;
		const v1 = createHmac('sha256', SECRET).update(`${t}.${payload}`).digest('hex');
		const res = await auth.handler(
			post(
				'/agentaos/webhook',
				{ 'content-type': 'application/json', 'x-agentaos-signature': `t=${t},v1=${v1}` },
				payload,
			),
		);
		expect(res.status).toBe(400);
		expect(onEvent).not.toHaveBeenCalled();
	});

	it('rejects a webhook signed with another secret, or a tampered body', async () => {
		const { auth, onEvent } = setup();
		const payload =
			'{"type":"webhook.test","business":"b","data":{"message":"hi","livemode":false}}';
		const t = Math.floor(Date.now() / 1000);
		const wrong = createHmac('sha256', 'whsec_other').update(`${t}.${payload}`).digest('hex');
		const r1 = await auth.handler(
			post(
				'/agentaos/webhook',
				{ 'content-type': 'application/json', 'x-agentaos-signature': `t=${t},v1=${wrong}` },
				payload,
			),
		);
		const good = createHmac('sha256', SECRET).update(`${t}.${payload}`).digest('hex');
		const r2 = await auth.handler(
			post(
				'/agentaos/webhook',
				{ 'content-type': 'application/json', 'x-agentaos-signature': `t=${t},v1=${good}` },
				payload.replace('hi', 'pwned'),
			),
		);
		expect([r1.status, r2.status]).toEqual([400, 400]);
		expect(onEvent).not.toHaveBeenCalled();
	});
});
