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
	const onEvent = vi.fn();
	const db = { user: [], session: [], account: [], verification: [] };
	const auth = betterAuth({
		baseURL: BASE,
		secret: 'a-test-secret-that-is-long-enough-123',
		database: memoryAdapter(db),
		emailAndPassword: { enabled: true },
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
	return { auth, create, onEvent };
}

async function signUp(auth: ReturnType<typeof setup>['auth']) {
	const res = await auth.api.signUpEmail({
		body: { email: 'ana@example.com', password: 'password1234', name: 'Ana' },
		asResponse: true,
	});
	const cookie = res.headers.get('set-cookie') ?? '';
	const body = (await res.json()) as { user: { id: string } };
	return { cookie: cookie.split(';')[0], userId: body.user.id };
}

function sign(payload: string) {
	const t = Math.floor(Date.now() / 1000);
	const v1 = createHmac('sha256', SECRET).update(`${t}.${payload}`).digest('hex');
	return `t=${t},v1=${v1}`;
}

describe('agentaos plugin', () => {
	it('starts a checkout for the signed-in user with their id in metadata', async () => {
		const { auth, create } = setup();
		const { cookie, userId } = await signUp(auth);
		const res = await auth.handler(
			new Request(`${BASE}/api/auth/agentaos/checkout`, {
				method: 'POST',
				headers: { 'content-type': 'application/json', cookie, origin: BASE },
				body: JSON.stringify({ slug: 'pro' }),
			}),
		);
		expect(res.status).toBe(200);
		expect(await res.json()).toEqual({
			url: 'https://app.agentaos.ai/pay/cs_1',
			sessionId: 'cs_1',
		});
		expect(create).toHaveBeenCalledWith(
			expect.objectContaining({
				linkId: 'link_pro',
				buyerEmail: 'ana@example.com',
				metadata: { userId },
			}),
		);
	});

	it('refuses a checkout without a session, and an unknown product', async () => {
		const { auth } = setup();
		const anon = await auth.handler(
			new Request(`${BASE}/api/auth/agentaos/checkout`, {
				method: 'POST',
				headers: { 'content-type': 'application/json', origin: BASE },
				body: JSON.stringify({ slug: 'pro' }),
			}),
		);
		expect(anon.status).toBe(401);
		const { cookie } = await signUp(auth);
		const unknown = await auth.handler(
			new Request(`${BASE}/api/auth/agentaos/checkout`, {
				method: 'POST',
				headers: { 'content-type': 'application/json', cookie, origin: BASE },
				body: JSON.stringify({ slug: 'nope' }),
			}),
		);
		expect(unknown.status).toBe(400);
	});

	it('verifies a webhook and passes the user id to onEvent', async () => {
		const { auth, onEvent } = setup();
		const payload = JSON.stringify({
			type: 'checkout.session.completed',
			business: 'biz_1',
			data: {
				link_id: 'link_pro',
				session_id: 'cs_1',
				metadata: { userId: 'user_1' },
				livemode: false,
			},
		});
		const res = await auth.handler(
			new Request(`${BASE}/api/auth/agentaos/webhook`, {
				method: 'POST',
				headers: { 'content-type': 'application/json', 'x-agentaos-signature': sign(payload) },
				body: payload,
			}),
		);
		expect(res.status).toBe(200);
		expect(onEvent).toHaveBeenCalledWith(
			expect.objectContaining({
				userId: 'user_1',
				event: expect.objectContaining({ type: 'checkout.session.completed' }),
			}),
		);
	});

	it('rejects a webhook with a bad signature', async () => {
		const { auth, onEvent } = setup();
		const res = await auth.handler(
			new Request(`${BASE}/api/auth/agentaos/webhook`, {
				method: 'POST',
				headers: { 'content-type': 'application/json', 'x-agentaos-signature': 't=1,v1=bad' },
				body: '{"type":"webhook.test","data":{}}',
			}),
		);
		expect(res.status).toBe(400);
		expect(onEvent).not.toHaveBeenCalled();
	});
});
