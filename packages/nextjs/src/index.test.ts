import { createHmac } from 'node:crypto';
import { AgentaOS } from '@agentaos/pay';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Checkout, Webhooks } from './index.js';

const SECRET = 'whsec_test';

afterEach(() => vi.restoreAllMocks());

// The route makes its own client, so spy on the checkouts resource every client shares.
const checkoutsPrototype = Object.getPrototypeOf(new AgentaOS('sk_test_dummy').checkouts);
function mockCreate() {
	return vi.spyOn(checkoutsPrototype, 'create').mockResolvedValue({
		sessionId: 'cs_1',
		checkoutUrl: 'https://app.agentaos.ai/pay/cs_1',
	} as never);
}

function sign(payload: string, secret = SECRET) {
	const t = Math.floor(Date.now() / 1000);
	return `t=${t},v1=${createHmac('sha256', secret).update(`${t}.${payload}`).digest('hex')}`;
}

describe('Checkout', () => {
	const route = (customer?: Parameters<typeof Checkout>[0]['customer']) =>
		Checkout({
			apiKey: 'sk_test_dummy',
			products: { pro: 'link_pro' },
			successUrl: 'https://example.com/thanks',
			customer,
		});

	it('redirects to a checkout for a listed product, with the buyer from the server', async () => {
		const create = mockCreate();
		const res = await route(() => ({ email: 'ana@example.com', metadata: { userId: 'u_1' } }))(
			new Request('https://example.com/checkout?product=pro&metadata=evil'),
		);
		expect(res.status).toBe(303);
		expect(res.headers.get('location')).toBe('https://app.agentaos.ai/pay/cs_1');
		expect(create).toHaveBeenCalledWith({
			linkId: 'link_pro',
			buyerEmail: 'ana@example.com',
			buyerName: undefined,
			metadata: { userId: 'u_1', product: 'pro' },
			successUrl: 'https://example.com/thanks',
			cancelUrl: 'https://example.com/thanks',
		});
	});

	it('refuses a product that is not in the list, including inherited keys', async () => {
		const create = mockCreate();
		for (const product of ['link_pro', 'toString', '']) {
			const res = await route()(new Request(`https://example.com/checkout?product=${product}`));
			expect(res.status).toBe(400);
		}
		expect(create).not.toHaveBeenCalled();
	});

	it('opens no checkout for a HEAD request or a router prefetch', async () => {
		const create = mockCreate();
		const url = 'https://example.com/checkout?product=pro';
		const requests = [
			new Request(url, { method: 'HEAD' }),
			new Request(url, { headers: { 'next-router-prefetch': '1' } }),
			new Request(url, { headers: { 'sec-purpose': 'prefetch;prerender' } }),
		];
		for (const request of requests) {
			expect((await route()(request)).status).toBe(204);
		}
		expect(create).not.toHaveBeenCalled();
	});

	it('uses the client it is given', async () => {
		const client = new AgentaOS('sk_test_other');
		const create = vi
			.spyOn(client.checkouts, 'create')
			.mockResolvedValue({ checkoutUrl: 'https://app.agentaos.ai/pay/cs_2' } as never);
		const GET = Checkout({
			client,
			products: { pro: 'link_pro' },
			successUrl: 'https://example.com/t',
		});
		const res = await GET(new Request('https://example.com/checkout?product=pro'));
		expect(res.headers.get('location')).toBe('https://app.agentaos.ai/pay/cs_2');
		expect(create).toHaveBeenCalledTimes(1);
	});
});

describe('Webhooks', () => {
	const handlers = () => ({
		onCheckoutCompleted: vi.fn(),
		onSubscriptionRenewed: vi.fn(),
		onEvent: vi.fn(),
	});
	const deliver = (route: ReturnType<typeof Webhooks>, body: string, signature = sign(body)) =>
		route(
			new Request('https://example.com/api/webhooks/agentaos', {
				method: 'POST',
				headers: { 'x-agentaos-signature': signature },
				body,
			}),
		);

	it('calls the handler for the event, then onEvent', async () => {
		const h = handlers();
		const body = JSON.stringify({
			type: 'subscription.renewed',
			business: 'biz_1',
			data: { id: 'sub_1', customer_email: 'ana@example.com', livemode: false },
		});
		const res = await deliver(Webhooks({ webhookSecret: SECRET, ...h }), body);
		expect(res.status).toBe(200);
		expect(h.onSubscriptionRenewed).toHaveBeenCalledWith(
			expect.objectContaining({
				type: 'subscription.renewed',
				data: expect.objectContaining({ customerEmail: 'ana@example.com' }),
			}),
		);
		expect(h.onEvent).toHaveBeenCalledTimes(1);
		expect(h.onCheckoutCompleted).not.toHaveBeenCalled();
	});

	it('works without an API key', async () => {
		vi.stubEnv('AGENTAOS_API_KEY', '');
		const h = handlers();
		const body = JSON.stringify({ type: 'webhook.test', business: 'biz_1', data: {} });
		const res = await deliver(Webhooks({ webhookSecret: SECRET, ...h }), body);
		expect(res.status).toBe(200);
		expect(h.onEvent).toHaveBeenCalledTimes(1);
		vi.unstubAllEnvs();
	});

	it('refuses to start without a secret', () => {
		for (const webhookSecret of ['', '  ', undefined]) {
			expect(() => Webhooks({ webhookSecret: webhookSecret as unknown as string })).toThrow(
				/webhookSecret/,
			);
		}
	});

	it('calls a handler written as a method with its options as `this`', async () => {
		const seen: string[] = [];
		const route = Webhooks({
			webhookSecret: SECRET,
			log: seen,
			onSubscriptionRenewed() {
				(this as unknown as { log: string[] }).log.push('renewed');
			},
		} as Parameters<typeof Webhooks>[0]);
		const body = JSON.stringify({ type: 'subscription.renewed', business: 'b', data: { id: 's' } });
		expect((await deliver(route, body)).status).toBe(200);
		expect(seen).toEqual(['renewed']);
	});

	it('rejects a wrong secret or a changed body, and calls nothing', async () => {
		const h = handlers();
		const route = Webhooks({ webhookSecret: SECRET, ...h });
		const body = JSON.stringify({
			type: 'checkout.session.completed',
			business: 'b',
			data: { metadata: {} },
		});
		const wrongSecret = await deliver(route, body, sign(body, 'whsec_other'));
		const tampered = await deliver(route, body.replace('b', 'x'), sign(body));
		expect([wrongSecret.status, tampered.status]).toEqual([400, 400]);
		expect(h.onEvent).not.toHaveBeenCalled();
	});
});
