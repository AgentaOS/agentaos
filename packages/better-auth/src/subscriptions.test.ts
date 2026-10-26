import { createHmac } from 'node:crypto';
import { AgentaOS, ValidationError } from '@agentaos/pay';
import { betterAuth } from 'better-auth';
import { memoryAdapter } from 'better-auth/adapters/memory';
import { describe, expect, it, vi } from 'vitest';
import { agentaos } from './index.js';

const SECRET = 'whsec_test';
const BASE = 'http://localhost:3000';

function setup() {
	const client = new AgentaOS('sk_test_dummy');
	const list = vi.spyOn(client.subscriptions, 'list').mockResolvedValue({
		items: [
			{ id: 'sub_mine', customerEmail: 'ana@example.com', linkId: 'link_pro' },
			{ id: 'sub_other', customerEmail: 'other@example.com', linkId: 'link_pro' },
		],
		total: 2,
		hasMore: false,
	} as never);
	const cancel = vi.spyOn(client.subscriptions, 'cancel').mockResolvedValue({
		status: 'active',
		cancelAtPeriodEnd: true,
		currentPeriodEnd: '2026-11-26T00:00:00Z',
		effectiveCancelDate: '2026-11-26T00:00:00Z',
	} as never);
	const preview = vi.spyOn(client.subscriptions, 'previewPlanChange').mockResolvedValue({
		direction: 'upgrade',
		dueTodayMinor: 1000,
		prorationDate: 1793000000,
	} as never);
	const change = vi.spyOn(client.subscriptions, 'changePlan').mockResolvedValue({
		direction: 'upgrade',
		applied: true,
	} as never);
	const invoices = vi
		.spyOn(client.subscriptions, 'invoices')
		.mockResolvedValue([{ id: 'inv_1', invoiceNumber: 'A-1' }] as never);
	const db = {
		user: [],
		session: [],
		account: [],
		verification: [],
		agentaosSubscription: [] as { userId: string; subscriptionId: string }[],
	};
	const handlers = {
		onCheckoutCompleted: vi.fn(),
		onSubscriptionRenewed: vi.fn(),
		onEvent: vi.fn(),
	};
	const auth = betterAuth({
		baseURL: BASE,
		secret: 'a-test-secret-that-is-long-enough-123',
		database: memoryAdapter(db),
		emailAndPassword: { enabled: true },
		plugins: [
			agentaos({
				client,
				products: [
					{ slug: 'pro', productId: 'link_pro' },
					{ slug: 'team', productId: 'link_team' },
				],
				successUrl: `${BASE}/thanks`,
				webhookSecret: SECRET,
				...handlers,
			}),
		],
	});
	return { auth, db, list, cancel, preview, change, invoices, handlers };
}

type Auth = ReturnType<typeof setup>['auth'];

async function signUp(auth: Auth, email: string) {
	const res = await auth.api.signUpEmail({
		body: { email, password: 'password1234', name: 'Ana' },
		asResponse: true,
	});
	const body = (await res.json()) as { user: { id: string } };
	return {
		cookie: (res.headers.get('set-cookie') ?? '').split(';')[0] ?? '',
		userId: body.user.id,
	};
}

function sign(payload: string) {
	const t = Math.floor(Date.now() / 1000);
	return `t=${t},v1=${createHmac('sha256', SECRET).update(`${t}.${payload}`).digest('hex')}`;
}

function deliver(auth: Auth, payload: object) {
	const body = JSON.stringify(payload);
	return auth.handler(
		new Request(`${BASE}/api/auth/agentaos/webhook`, {
			method: 'POST',
			headers: { 'content-type': 'application/json', 'x-agentaos-signature': sign(body) },
			body,
		}),
	);
}

/** The first payment of a checkout this user started: what records them as the owner. */
const firstPayment = (userId: string, subscriptionId: string) => ({
	type: 'checkout.session.completed',
	business: 'biz_1',
	data: {
		session_id: 'cs_1',
		link_id: 'tok_pro',
		metadata: { userId, product: 'pro', subscriptionId },
		livemode: false,
	},
});

const post = (path: string, cookie: string, body: unknown) =>
	new Request(`${BASE}/api/auth${path}`, {
		method: 'POST',
		headers: { 'content-type': 'application/json', cookie, origin: BASE },
		body: JSON.stringify(body),
	});

async function owner(auth: Auth) {
	const ana = await signUp(auth, 'ana@example.com');
	await deliver(auth, firstPayment(ana.userId, 'sub_mine'));
	return ana;
}

describe('recording who owns a subscription', () => {
	it('records the buyer once, even when the event is delivered twice', async () => {
		const { auth, db } = setup();
		const ana = await signUp(auth, 'ana@example.com');
		await deliver(auth, firstPayment(ana.userId, 'sub_mine'));
		await deliver(auth, firstPayment(ana.userId, 'sub_mine'));
		expect(db.agentaosSubscription).toHaveLength(1);
		expect(db.agentaosSubscription[0]).toMatchObject({
			userId: ana.userId,
			subscriptionId: 'sub_mine',
		});
	});

	it('records nothing for a renewal, which carries no user id', async () => {
		const { auth, db, handlers } = setup();
		await deliver(auth, {
			type: 'checkout.session.completed',
			business: 'biz_1',
			data: {
				session_id: 'cs_2',
				metadata: { subscriptionId: 'sub_mine', subscriptionCycle: true },
			},
		});
		expect(db.agentaosSubscription).toHaveLength(0);
		expect(handlers.onCheckoutCompleted).toHaveBeenCalledWith(
			expect.objectContaining({ userId: null }),
		);
	});

	it('lists only the subscriptions this user bought', async () => {
		const { auth } = setup();
		const ana = await owner(auth);
		const res = await auth.handler(
			new Request(`${BASE}/api/auth/agentaos/subscriptions`, { headers: { cookie: ana.cookie } }),
		);
		const body = (await res.json()) as { subscriptions: { id: string }[] };
		expect(body.subscriptions.map((s) => s.id)).toEqual(['sub_mine']);
	});
});

describe('managing subscriptions', () => {
	it('cancels the user’s own subscription at the end of the period', async () => {
		const { auth, cancel } = setup();
		const ana = await owner(auth);
		const res = await auth.handler(
			post('/agentaos/cancel-subscription', ana.cookie, { subscriptionId: 'sub_mine' }),
		);
		expect(res.status).toBe(200);
		expect(cancel).toHaveBeenCalledWith('sub_mine');
		expect(await res.json()).toMatchObject({ cancelAtPeriodEnd: true });
	});

	it('answers 404 for a subscription another user bought, and changes nothing', async () => {
		const { auth, cancel, change, invoices } = setup();
		const ana = await owner(auth);
		const bob = await signUp(auth, 'bob@example.com');
		const results = await Promise.all([
			auth.handler(
				post('/agentaos/cancel-subscription', bob.cookie, { subscriptionId: 'sub_mine' }),
			),
			auth.handler(
				post('/agentaos/change-plan', bob.cookie, { subscriptionId: 'sub_mine', slug: 'team' }),
			),
			auth.handler(
				new Request(`${BASE}/api/auth/agentaos/invoices?subscriptionId=sub_mine`, {
					headers: { cookie: bob.cookie },
				}),
			),
		]);
		expect(results.map((r) => r.status)).toEqual([404, 404, 404]);
		expect(cancel).not.toHaveBeenCalled();
		expect(change).not.toHaveBeenCalled();
		expect(invoices).not.toHaveBeenCalled();
		expect(ana.userId).not.toBe(bob.userId);
	});

	it('answers 404 for a subscription sold outside this app', async () => {
		const { auth, cancel } = setup();
		const ana = await owner(auth);
		const res = await auth.handler(
			post('/agentaos/cancel-subscription', ana.cookie, { subscriptionId: 'sub_other' }),
		);
		expect(res.status).toBe(404);
		expect(cancel).not.toHaveBeenCalled();
	});

	it('quotes a plan change, and applies it at a price quoted on the server', async () => {
		const { auth, preview, change } = setup();
		const ana = await owner(auth);
		const quote = await auth.handler(
			post('/agentaos/preview-plan-change', ana.cookie, {
				subscriptionId: 'sub_mine',
				slug: 'team',
			}),
		);
		expect(await quote.json()).toMatchObject({ prorationDate: 1793000000 });
		expect(change).not.toHaveBeenCalled();

		// A proration date sent by the browser is ignored.
		const applied = await auth.handler(
			post('/agentaos/change-plan', ana.cookie, {
				subscriptionId: 'sub_mine',
				slug: 'team',
				prorationDate: 1,
			}),
		);
		expect(applied.status).toBe(200);
		expect(preview).toHaveBeenCalledTimes(2);
		expect(change).toHaveBeenCalledWith('sub_mine', {
			targetLinkId: 'link_team',
			prorationDate: 1793000000,
		});
	});

	it('only switches to a product from the plugin’s list', async () => {
		const { auth, preview } = setup();
		const ana = await owner(auth);
		const res = await auth.handler(
			post('/agentaos/change-plan', ana.cookie, { subscriptionId: 'sub_mine', slug: 'link_cheap' }),
		);
		expect(res.status).toBe(400);
		expect(preview).not.toHaveBeenCalled();
	});

	it('passes the reason on when AgentaOS refuses a change', async () => {
		const { auth, preview } = setup();
		preview.mockRejectedValue(
			new ValidationError('Billing interval must match the current plan', []),
		);
		const ana = await owner(auth);
		const res = await auth.handler(
			post('/agentaos/change-plan', ana.cookie, { subscriptionId: 'sub_mine', slug: 'team' }),
		);
		expect(res.status).toBe(400);
		expect(await res.json()).toMatchObject({
			message: 'Billing interval must match the current plan',
		});
	});

	it('lists the invoices of the user’s own subscription', async () => {
		const { auth, invoices } = setup();
		const ana = await owner(auth);
		const res = await auth.handler(
			new Request(`${BASE}/api/auth/agentaos/invoices?subscriptionId=sub_mine`, {
				headers: { cookie: ana.cookie },
			}),
		);
		expect(await res.json()).toEqual({ invoices: [{ id: 'inv_1', invoiceNumber: 'A-1' }] });
		expect(invoices).toHaveBeenCalledWith('sub_mine');
	});
});

describe('webhook handlers', () => {
	it('passes the owner to subscription events for a subscription bought here', async () => {
		const { auth, handlers } = setup();
		const ana = await owner(auth);
		await deliver(auth, {
			type: 'subscription.renewed',
			business: 'biz_1',
			data: { id: 'sub_mine', livemode: false },
		});
		expect(handlers.onSubscriptionRenewed).toHaveBeenCalledWith(
			expect.objectContaining({ userId: ana.userId }),
		);
	});

	it('calls the handler for the event, then onEvent', async () => {
		const { auth, handlers } = setup();
		await deliver(auth, firstPayment('user_1', 'sub_1'));
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

	it('routes a renewal to onSubscriptionRenewed with no user id', async () => {
		const { auth, handlers } = setup();
		const res = await deliver(auth, {
			type: 'subscription.renewed',
			business: 'biz_1',
			data: { id: 'sub_mine', customer_email: 'ana@example.com', livemode: false },
		});
		expect(res.status).toBe(200);
		expect(handlers.onSubscriptionRenewed).toHaveBeenCalledWith(
			expect.objectContaining({ userId: null }),
		);
		expect(handlers.onCheckoutCompleted).not.toHaveBeenCalled();
	});

	it('calls a handler written as a method with its options as `this`', async () => {
		const client = new AgentaOS('sk_test_dummy');
		const seen: string[] = [];
		const options = {
			client,
			products: [],
			successUrl: `${BASE}/thanks`,
			webhookSecret: SECRET,
			log: seen,
			onSubscriptionRenewed() {
				this.log.push('renewed');
			},
		};
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
			plugins: [agentaos(options)],
		});
		const res = await deliver(auth as unknown as Auth, {
			type: 'subscription.renewed',
			business: 'biz_1',
			data: { id: 'sub_1' },
		});
		expect(res.status).toBe(200);
		expect(seen).toEqual(['renewed']);
	});
});
