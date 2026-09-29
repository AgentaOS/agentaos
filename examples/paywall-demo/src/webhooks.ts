import { type WebhookEvent, WebhookVerificationError } from '@agentaos/pay';
import type { Request, Response } from 'express';
import { agentaos, config } from './agentaos.js';
import { grantPro, recordRenewal } from './grant.js';
import { findUserBySubscription, updateUser } from './store.js';

// POST /webhooks, mounted with express.raw() so req.body is the raw bytes.
export function webhooks(req: Request, res: Response): void {
	let event: WebhookEvent;
	try {
		event = agentaos.webhooks.verify(
			req.body as Buffer,
			req.header('x-agentaos-signature') ?? '',
			config.webhookSecret,
		);
	} catch (err) {
		if (err instanceof WebhookVerificationError) {
			res.status(400).send('Invalid signature');
			return;
		}
		throw err;
	}

	switch (event.type) {
		case 'checkout.session.completed': {
			const { sessionId, metadata } = event.data;
			const subscriptionId =
				typeof metadata.subscriptionId === 'string' ? metadata.subscriptionId : null;
			if (typeof metadata.customerId === 'string') {
				// First payment, or the start of a free trial.
				grantPro({ userId: metadata.customerId, subscriptionId, sessionId });
			} else if (subscriptionId) {
				// A renewal carries no customerId: match it by the stored subscription ID.
				recordRenewal({ subscriptionId, sessionId });
			}
			break;
		}
		case 'subscription.updated':
		case 'subscription.canceled': {
			const user = findUserBySubscription(event.data.id);
			if (user) updateUser(user.id, { subscriptionStatus: event.data.status });
			break;
		}
	}
	res.sendStatus(200);
}
