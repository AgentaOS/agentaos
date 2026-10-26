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
	vi.spyOn(client.subscriptions, 'list').mockResolvedValue({
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
	return { auth, cancel, preview, change, invoices, handlers };
}

async function verifiedUser(
	auth: ReturnType<typeof setup>['auth'],
	email: string,
	verified = true,
) {
	const res = await auth.api.signUpEmail({
		body: { email, password: 'password1234', name: 'Ana' },
		asResponse: true,
	});
	if (verified) {
		const ctx = await auth.$context;
		const found = await ctx.internalAdapter.findUserByEmail(email);
		await ctx.internalAdapter.updateUser(found!.user.id, { emailVerified: true });
	}
	return (res.headers.get('set-cookie') ?? '').split(';')[0] ?? '';
}

const post = (path: string, cookie: string, body: unknown) =>
	new Request(`${BASE}/api/auth${path}`, {
		method: 'POST',
		headers: { 'content-type': 'application/json', cookie, origin: BASE },
		body: JSON.stringify(body),
	});

function sign(payload: string) {
	const t = Math.floor(Date.now() / 1000);
	return `t=${t},v1=${createHmac('sha256', SECRET).update(`${t}.${payload}`).digest('hex')}`;
}

describe('managing subscriptions', () => {
	it('cancels the user’s own subscription at the end of the period', async () => {
		const { auth, cancel } = setup();
		const cookie = await verifiedUser(auth, 'ana@example.com');
		const res = await auth.handler(
			post('/agentaos/cancel-subscription', cookie, { subscriptionId: 'sub_mine' }),
		);
		expect(res.status).toBe(200);
		expect(cancel).toHaveBeenCalledWith('sub_mine');
		expect(await res.json()).toMatchObject({ cancelAtPeriodEnd: true });
	});

	it('answers 404 for someone else’s subscription, and changes nothing', async () => {
		const { auth, cancel, change, invoices } = setup();
		const cookie = await verifiedUser(auth, 'ana@example.com');
		const cancelRes = await auth.handler(
			post('/agentaos/cancel-subscription', cookie, { subscriptionId: 'sub_other' }),
		);
		const changeRes = await auth.handler(
			post('/agentaos/change-plan', cookie, {
				subscriptionId: 'sub_other',
				slug: 'team',
				prorationDate: 1,
			}),
		);
		const invoicesRes = await auth.handler(
			new Request(`${BASE}/api/auth/agentaos/invoices?subscriptionId=sub_other`, {
				headers: { cookie },
			}),
		);
		expect([cancelRes.status, changeRes.status, invoicesRes.status]).toEqual([404, 404, 404]);
		expect(cancel).not.toHaveBeenCalled();
		expect(change).not.toHaveBeenCalled();
		expect(invoices).not.toHaveBeenCalled();
	});

	it('refuses to manage subscriptions for an unverified email', async () => {
		const { auth, cancel } = setup();
		const cookie = await verifiedUser(auth, 'ana@example.com', false);
		const res = await auth.handler(
			post('/agentaos/cancel-subscription', cookie, { subscriptionId: 'sub_mine' }),
		);
		expect(res.status).toBe(403);
		expect(cancel).not.toHaveBeenCalled();
	});

	it('quotes a plan change first, then applies it with the quoted proration date', async () => {
		const { auth, preview, change } = setup();
		const cookie = await verifiedUser(auth, 'ana@example.com');
		const quote = await auth.handler(
			post('/agentaos/change-plan', cookie, { subscriptionId: 'sub_mine', slug: 'team' }),
		);
		expect(await quote.json()).toMatchObject({ preview: { prorationDate: 1793000000 } });
		expect(preview).toHaveBeenCalledWith('sub_mine', 'link_team');
		expect(change).not.toHaveBeenCalled();

		const applied = await auth.handler(
			post('/agentaos/change-plan', cookie, {
				subscriptionId: 'sub_mine',
				slug: 'team',
				prorationDate: 1793000000,
			}),
		);
		expect(applied.status).toBe(200);
		expect(change).toHaveBeenCalledWith('sub_mine', {
			targetLinkId: 'link_team',
			prorationDate: 1793000000,
		});
	});

	it('only switches to a product from the plugin’s list', async () => {
		const { auth, preview } = setup();
		const cookie = await verifiedUser(auth, 'ana@example.com');
		const res = await auth.handler(
			post('/agentaos/change-plan', cookie, { subscriptionId: 'sub_mine', slug: 'link_cheap' }),
		);
		expect(res.status).toBe(400);
		expect(preview).not.toHaveBeenCalled();
	});

	it('lists the invoices of the user’s own subscription', async () => {
		const { auth, invoices } = setup();
		const cookie = await verifiedUser(auth, 'ana@example.com');
		const res = await auth.handler(
			new Request(`${BASE}/api/auth/agentaos/invoices?subscriptionId=sub_mine`, {
				headers: { cookie },
			}),
		);
		expect(await res.json()).toEqual({ invoices: [{ id: 'inv_1', invoiceNumber: 'A-1' }] });
		expect(invoices).toHaveBeenCalledWith('sub_mine');
	});
});

describe('webhook handlers', () => {
	const deliver = (auth: ReturnType<typeof setup>['auth'], payload: object) => {
		const body = JSON.stringify(payload);
		return auth.handler(
			new Request(`${BASE}/api/auth/agentaos/webhook`, {
				method: 'POST',
				headers: { 'content-type': 'application/json', 'x-agentaos-signature': sign(body) },
				body,
			}),
		);
	};

	it('calls the handler for the event, then onEvent', async () => {
		const { auth, handlers } = setup();
		await deliver(auth, {
			type: 'checkout.session.completed',
			business: 'biz_1',
			data: {
				session_id: 'cs_1',
				link_id: 'link_pro',
				metadata: { userId: 'user_1' },
				livemode: false,
			},
		});
		expect(handlers.onCheckoutCompleted).toHaveBeenCalledWith(
			expect.objectContaining({
				userId: 'user_1',
				event: expect.objectContaining({ type: 'checkout.session.completed' }),
			}),
		);
		expect(handlers.onEvent).toHaveBeenCalledTimes(1);
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
});
