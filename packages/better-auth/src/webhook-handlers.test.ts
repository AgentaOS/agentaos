import { createHmac } from 'node:crypto';
import { AgentaOS, ValidationError } from '@agentaos/pay';
import { betterAuth } from 'better-auth';
import { memoryAdapter } from 'better-auth/adapters/memory';
import { describe, expect, it, vi } from 'vitest';
import { type AgentaOSPluginOptions, agentaos } from './index.js';

const SECRET = 'whsec_test';
const BASE = 'http://localhost:3000';

function setup(extra: Partial<AgentaOSPluginOptions> = {}) {
	const client = new AgentaOS('sk_test_dummy');
	const handlers = {
		onCheckoutCompleted: vi.fn(),
		onSubscriptionRenewed: vi.fn(),
		onEvent: vi.fn(),
	};
	const auth = betterAuth({
		baseURL: BASE,
		secret: 'a-test-secret-that-is-long-enough-123',
		database: memoryAdapter({ user: [], session: [], account: [], verification: [] }),
		emailAndPassword: { enabled: true },
		plugins: [
			agentaos({
				client,
				products: [{ slug: 'pro', productId: 'link_pro' }],
				successUrl: `${BASE}/thanks`,
				webhookSecret: SECRET,
				...handlers,
				...extra,
			}),
		],
	});
	return { auth, client, handlers };
}

function deliver(auth: ReturnType<typeof setup>['auth'], payload: object) {
	const body = JSON.stringify(payload);
	const t = Math.floor(Date.now() / 1000);
	const v1 = createHmac('sha256', SECRET).update(`${t}.${body}`).digest('hex');
	return auth.handler(
		new Request(`${BASE}/api/auth/agentaos/webhook`, {
			method: 'POST',
			headers: { 'content-type': 'application/json', 'x-agentaos-signature': `t=${t},v1=${v1}` },
			body,
		}),
	);
}

describe('webhook handlers', () => {
	it('calls the handler for the event, then onEvent', async () => {
		const { auth, handlers } = setup();
		await deliver(auth, {
			type: 'checkout.session.completed',
			business: 'biz_1',
			data: { session_id: 'cs_1', metadata: { userId: 'user_1', product: 'pro' }, livemode: false },
		});
		expect(handlers.onCheckoutCompleted).toHaveBeenCalledWith(
			expect.objectContaining({
				userId: 'user_1',
				event: expect.objectContaining({ type: 'checkout.session.completed' }),
			}),
		);
		expect(handlers.onEvent).toHaveBeenCalledTimes(1);
		expect(handlers.onCheckoutCompleted.mock.invocationCallOrder[0]).toBeLessThan(
			handlers.onEvent.mock.invocationCallOrder[0] ?? 0,
		);
		expect(handlers.onSubscriptionRenewed).not.toHaveBeenCalled();
	});

	it('gives a renewal charge no user id', async () => {
		const { auth, handlers } = setup();
		await deliver(auth, {
			type: 'checkout.session.completed',
			business: 'biz_1',
			data: { session_id: 'cs_2', metadata: { subscriptionId: 'sub_1', subscriptionCycle: true } },
		});
		expect(handlers.onCheckoutCompleted).toHaveBeenCalledWith(
			expect.objectContaining({ userId: null }),
		);
	});

	it('routes a subscription event to its handler', async () => {
		const { auth, handlers } = setup();
		const res = await deliver(auth, {
			type: 'subscription.renewed',
			business: 'biz_1',
			data: { id: 'sub_1', customer_email: 'ana@example.com', livemode: false },
		});
		expect(res.status).toBe(200);
		expect(handlers.onSubscriptionRenewed).toHaveBeenCalledWith(
			expect.objectContaining({ userId: null }),
		);
		expect(handlers.onCheckoutCompleted).not.toHaveBeenCalled();
	});

	it('calls a handler written as a method with its options as `this`', async () => {
		const seen: string[] = [];
		const options = {
			log: seen,
			onSubscriptionRenewed() {
				this.log.push('renewed');
			},
		};
		const { auth } = setup(options as Partial<AgentaOSPluginOptions>);
		const res = await deliver(auth, {
			type: 'subscription.renewed',
			business: 'b',
			data: { id: 's' },
		});
		expect(res.status).toBe(200);
		expect(seen).toEqual(['renewed']);
	});
});

describe('a failing handler', () => {
	it('answers 500 so AgentaOS retries, and skips onEvent', async () => {
		const { auth, handlers } = setup();
		handlers.onSubscriptionRenewed.mockRejectedValue(new Error('database down'));
		const res = await deliver(auth, {
			type: 'subscription.renewed',
			business: 'b',
			data: { id: 's' },
		});
		expect(res.status).toBe(500);
		expect(handlers.onEvent).not.toHaveBeenCalled();
	});
});

describe('errors from AgentaOS', () => {
	it('keeps the reason when AgentaOS refuses a checkout', async () => {
		const { auth, client } = setup();
		vi.spyOn(client.checkouts, 'create').mockRejectedValue(
			new ValidationError('This product is archived', []),
		);
		const res = await auth.api.signUpEmail({
			body: { email: 'ana@example.com', password: 'password1234', name: 'Ana' },
			asResponse: true,
		});
		const cookie = (res.headers.get('set-cookie') ?? '').split(';')[0] ?? '';
		const checkout = await auth.handler(
			new Request(`${BASE}/api/auth/agentaos/checkout`, {
				method: 'POST',
				headers: { 'content-type': 'application/json', cookie, origin: BASE },
				body: JSON.stringify({ slug: 'pro' }),
			}),
		);
		expect(checkout.status).toBe(400);
		expect(await checkout.json()).toMatchObject({ message: 'This product is archived' });
	});
});
