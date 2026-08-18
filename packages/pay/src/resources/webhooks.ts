import { createHmac, timingSafeEqual } from 'node:crypto';
import { WebhookVerificationError } from '../errors.js';
import type { WebhookEvent } from '../types.js';
import { snakeToCamel } from '../utils/transform.js';

export class WebhooksResource {
	verify(
		payload: string | Buffer,
		signature: string,
		secret: string,
		toleranceSec = 300,
	): WebhookEvent {
		// The signature is over the RAW request body. A parsed/re-serialized object never
		// matches, so reject a non-string/Buffer payload up front with an actionable message
		// instead of letting `[object Object]` fall through to a generic mismatch error.
		if (typeof payload !== 'string' && !Buffer.isBuffer(payload)) {
			const received = payload === null ? 'null' : typeof payload;
			throw new WebhookVerificationError(
				`Webhook payload must be the raw request body (a string or Buffer), but received ${received}. You are likely passing an already-parsed JSON body — verification signs the RAW bytes, so a parsed or re-serialized object never matches the signature. Read the raw body instead, e.g. in Express: app.post('/webhooks', express.raw({ type: 'application/json' }), handler).`,
			);
		}

		const payloadStr = typeof payload === 'string' ? payload : payload.toString('utf-8');

		// Parse signature: t=<timestamp>,v1=<hmac>
		const parts = Object.fromEntries(
			signature.split(',').map((p) => {
				const [k, ...v] = p.split('=');
				return [k, v.join('=')] as const;
			}),
		) as Record<string, string>;

		const timestamp = Number.parseInt(parts.t ?? '', 10);
		const v1 = parts.v1;

		if (!timestamp || !v1) {
			throw new WebhookVerificationError(
				'Invalid webhook signature format. Expected format: t=<timestamp>,v1=<hmac>.',
			);
		}

		// Validate timestamp within tolerance
		const age = Math.floor(Date.now() / 1000) - timestamp;
		if (age > toleranceSec || age < 0) {
			throw new WebhookVerificationError(
				`Webhook signature expired. Timestamp is ${age}s old (tolerance: ${toleranceSec}s).`,
			);
		}

		// Compute HMAC-SHA256 of `${timestamp}.${payload}`
		const signedContent = `${timestamp}.${payloadStr}`;
		const expected = createHmac('sha256', secret).update(signedContent).digest('hex');

		// Timing-safe compare
		if (expected.length !== v1.length) {
			throw new WebhookVerificationError(
				'Webhook signature verification failed: no matching signature for the payload. ' +
					'Are you passing the RAW request body you received (not a parsed or re-serialized object)? ' +
					'A JSON body parser running before verification is the most common cause.',
			);
		}

		const isValid = timingSafeEqual(Buffer.from(expected, 'hex'), Buffer.from(v1, 'hex'));
		if (!isValid) {
			throw new WebhookVerificationError(
				'Webhook signature verification failed: no matching signature for the payload. ' +
					'Are you passing the RAW request body you received (not a parsed or re-serialized object)? ' +
					'A JSON body parser running before verification is the most common cause.',
			);
		}

		// Parse payload JSON and return typed WebhookEvent
		try {
			const parsed = JSON.parse(payloadStr) as unknown;
			return snakeToCamel(parsed) as WebhookEvent;
		} catch {
			throw new WebhookVerificationError('Webhook payload is not valid JSON.');
		}
	}
}
