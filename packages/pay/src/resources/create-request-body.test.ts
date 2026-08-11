// @vitest-environment node
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AgentaOS } from '../client.js';

/**
 * Stub global fetch and capture the JSON body the SDK actually puts on the wire.
 * Asserting the serialized request (not an internal mock) proves what the server
 * would receive.
 */
function captureRequestBodies(): Array<Record<string, unknown>> {
	const bodies: Array<Record<string, unknown>> = [];
	vi.stubGlobal(
		'fetch',
		vi.fn(async (_url: string, init?: { body?: string }) => {
			bodies.push(init?.body ? (JSON.parse(init.body) as Record<string, unknown>) : {});
			return new Response(JSON.stringify({ id: 'test', seller_mode: 'crypto' }), {
				status: 200,
				headers: { 'content-type': 'application/json' },
			});
		}),
	);
	return bodies;
}

/**
 * Seller mode is a property of the merchant's ACCOUNT (Merchant of Record once
 * verified, otherwise on-chain to the wallet on file) and is derived server-side.
 * It is not a create parameter, so the SDK must never put it on the wire — sending
 * it would let a caller override the account's real mode.
 */
describe('create requests never carry sellerMode', () => {
	afterEach(() => vi.unstubAllGlobals());

	it('paymentLinks.create omits sellerMode', async () => {
		const bodies = captureRequestBodies();
		await new AgentaOS('sk_test_x').paymentLinks.create({ amount: 29.99 });
		expect(bodies[0]).not.toHaveProperty('sellerMode');
	});

	it('checkouts.create (link-less) omits sellerMode', async () => {
		const bodies = captureRequestBodies();
		await new AgentaOS('sk_test_x').checkouts.create({ amount: 10 });
		expect(bodies[0]).not.toHaveProperty('sellerMode');
	});

	it('checkouts.create with a linkId omits sellerMode (inherits the link)', async () => {
		const bodies = captureRequestBodies();
		await new AgentaOS('sk_test_x').checkouts.create({ linkId: 'abc123' });
		expect(bodies[0]).not.toHaveProperty('sellerMode');
	});
});

/** The additive new fields ARE forwarded unchanged (camelCase, as the DTO expects). */
describe('create forwards the new additive fields', () => {
	afterEach(() => vi.unstubAllGlobals());

	it('paymentLinks.create forwards subscription fields', async () => {
		const bodies = captureRequestBodies();
		await new AgentaOS('sk_test_x').paymentLinks.create({
			amount: 29.99,
			type: 'subscription',
			billingInterval: 'month',
		});
		expect(bodies[0]?.type).toBe('subscription');
		expect(bodies[0]?.billingInterval).toBe('month');
	});

	it('checkouts.create forwards dueDate', async () => {
		const bodies = captureRequestBodies();
		await new AgentaOS('sk_test_x').checkouts.create({ amount: 10, dueDate: '2026-09-30' });
		expect(bodies[0]?.dueDate).toBe('2026-09-30');
	});
});
