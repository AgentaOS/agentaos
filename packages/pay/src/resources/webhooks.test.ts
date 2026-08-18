// @vitest-environment node
import { createHmac } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { WebhookVerificationError } from '../errors.js';
import { WebhooksResource } from './webhooks.js';

const SECRET = 'whsec_test_secret';

function nowSec(): number {
	return Math.floor(Date.now() / 1000);
}

/** Produce a Stripe-style `t=<ts>,v1=<hmac>` header over `${ts}.${payload}`. */
function sign(payload: string, secret: string, timestamp: number): string {
	const hmac = createHmac('sha256', secret).update(`${timestamp}.${payload}`).digest('hex');
	return `t=${timestamp},v1=${hmac}`;
}

const VALID_PAYLOAD = JSON.stringify({
	type: 'checkout.session.completed',
	data: { session_id: 's_1', link_id: 'l_1', payer_type: 'agent' },
});

describe('webhooks.verify — valid signatures', () => {
	it('verifies a correct signature and returns the camelized event', () => {
		const ts = nowSec();
		const signature = sign(VALID_PAYLOAD, SECRET, ts);
		const event = new WebhooksResource().verify(VALID_PAYLOAD, signature, SECRET);
		expect(event.type).toBe('checkout.session.completed');
		expect(event.data).toMatchObject({ sessionId: 's_1', linkId: 'l_1', payerType: 'agent' });
	});

	it('accepts a Buffer payload', () => {
		const ts = nowSec();
		const signature = sign(VALID_PAYLOAD, SECRET, ts);
		const event = new WebhooksResource().verify(
			Buffer.from(VALID_PAYLOAD, 'utf-8'),
			signature,
			SECRET,
		);
		expect(event.type).toBe('checkout.session.completed');
	});

	it('verifies a timestamp still inside the tolerance window', () => {
		const ts = nowSec() - 200;
		const signature = sign(VALID_PAYLOAD, SECRET, ts);
		expect(() =>
			new WebhooksResource().verify(VALID_PAYLOAD, signature, SECRET, 300),
		).not.toThrow();
	});
});

describe('webhooks.verify — rejects bad signatures', () => {
	it('throws when the payload is tampered after signing', () => {
		const ts = nowSec();
		const signature = sign(VALID_PAYLOAD, SECRET, ts);
		const tampered = VALID_PAYLOAD.replace('s_1', 's_2');
		expect(() => new WebhooksResource().verify(tampered, signature, SECRET)).toThrow(
			WebhookVerificationError,
		);
	});

	it('throws when the v1 digest is altered (same length)', () => {
		const ts = nowSec();
		const hmac = createHmac('sha256', SECRET).update(`${ts}.${VALID_PAYLOAD}`).digest('hex');
		const flipped = (hmac[0] === '0' ? '1' : '0') + hmac.slice(1);
		const signature = `t=${ts},v1=${flipped}`;
		expect(() => new WebhooksResource().verify(VALID_PAYLOAD, signature, SECRET)).toThrow(
			WebhookVerificationError,
		);
	});

	it('throws when the v1 digest has the wrong length', () => {
		const ts = nowSec();
		const signature = `t=${ts},v1=deadbeef`;
		expect(() => new WebhooksResource().verify(VALID_PAYLOAD, signature, SECRET)).toThrow(
			WebhookVerificationError,
		);
	});

	it('throws when verified with the wrong secret', () => {
		const ts = nowSec();
		const signature = sign(VALID_PAYLOAD, SECRET, ts);
		expect(() => new WebhooksResource().verify(VALID_PAYLOAD, signature, 'whsec_wrong')).toThrow(
			WebhookVerificationError,
		);
	});
});

describe('webhooks.verify — format and freshness', () => {
	it('throws on a malformed signature header (missing v1)', () => {
		const ts = nowSec();
		expect(() => new WebhooksResource().verify(VALID_PAYLOAD, `t=${ts}`, SECRET)).toThrow(
			/Invalid webhook signature format/,
		);
	});

	it('throws on a malformed signature header (missing t)', () => {
		const hmac = createHmac('sha256', SECRET).update(`x.${VALID_PAYLOAD}`).digest('hex');
		expect(() => new WebhooksResource().verify(VALID_PAYLOAD, `v1=${hmac}`, SECRET)).toThrow(
			/Invalid webhook signature format/,
		);
	});

	it('throws when the timestamp is older than the tolerance', () => {
		const ts = nowSec() - 400;
		const signature = sign(VALID_PAYLOAD, SECRET, ts);
		expect(() => new WebhooksResource().verify(VALID_PAYLOAD, signature, SECRET, 300)).toThrow(
			/expired/,
		);
	});

	it('throws when the timestamp is in the future', () => {
		const ts = nowSec() + 400;
		const signature = sign(VALID_PAYLOAD, SECRET, ts);
		expect(() => new WebhooksResource().verify(VALID_PAYLOAD, signature, SECRET, 300)).toThrow(
			/expired/,
		);
	});

	it('throws when a correctly signed payload is not valid JSON', () => {
		const ts = nowSec();
		const notJson = 'this is not json';
		const signature = sign(notJson, SECRET, ts);
		expect(() => new WebhooksResource().verify(notJson, signature, SECRET)).toThrow(
			/not valid JSON/,
		);
	});
});

describe('webhooks.verify — raw-body guidance (the #1 integration mistake)', () => {
	it('rejects a parsed object with an actionable "pass the raw body" message', () => {
		const signature = sign(VALID_PAYLOAD, SECRET, nowSec());
		// A JSON body parser (e.g. express.json()) hands you an object, not the raw bytes.
		const parsed = JSON.parse(VALID_PAYLOAD) as unknown;
		let message = '';
		try {
			// @ts-expect-error — deliberately passing the parsed object a body parser produces
			new WebhooksResource().verify(parsed, signature, SECRET);
		} catch (err) {
			message = (err as Error).message;
		}
		expect(message).toMatch(/raw request body/i);
		expect(message).toMatch(/express\.raw/);
	});

	it('rejects null with the raw-body message', () => {
		const signature = sign(VALID_PAYLOAD, SECRET, nowSec());
		expect(() =>
			// @ts-expect-error — null is not a valid payload
			new WebhooksResource().verify(null, signature, SECRET),
		).toThrow(/raw request body/i);
	});

	it('a genuine signature mismatch also hints at the raw body', () => {
		const signature = sign(VALID_PAYLOAD, SECRET, nowSec());
		const tampered = VALID_PAYLOAD.replace('s_1', 's_2');
		expect(() => new WebhooksResource().verify(tampered, signature, SECRET)).toThrow(
			/RAW request body/i,
		);
	});
});
