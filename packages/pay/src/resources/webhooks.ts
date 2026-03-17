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
				'Webhook signature verification failed. Signature does not match payload.',
			);
		}

		const isValid = timingSafeEqual(Buffer.from(expected, 'hex'), Buffer.from(v1, 'hex'));
		if (!isValid) {
			throw new WebhookVerificationError(
				'Webhook signature verification failed. Signature does not match payload.',
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
