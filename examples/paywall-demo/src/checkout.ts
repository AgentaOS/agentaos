import type { Request, Response } from 'express';
import { agentaos, config } from './agentaos.js';
import { grantPro } from './grant.js';
import type { User } from './store.js';
import { updateUser } from './store.js';
import { successPage } from './views.js';

// POST /upgrade: one checkout per click, tied to the signed-in user.
export async function upgrade(_req: Request, res: Response): Promise<void> {
	const user: User = res.locals.user;

	// A second click reuses the open checkout instead of creating another one.
	if (user.pendingSessionId) {
		const pending = await agentaos.checkouts.retrieve(user.pendingSessionId);
		if (pending.status === 'open') {
			res.redirect(303, pending.checkoutUrl);
			return;
		}
	}

	const checkout = await agentaos.checkouts.create({
		linkId: config.proLinkId,
		buyerEmail: user.email,
		metadata: { customerId: user.id },
		successUrl: `${config.appUrl}/success`,
		cancelUrl: `${config.appUrl}/`,
	});
	updateUser(user.id, { pendingSessionId: checkout.sessionId });
	res.redirect(303, checkout.checkoutUrl);
}

// GET /success?sessionId=...: the buyer lands here after paying.
export async function success(req: Request, res: Response): Promise<void> {
	const user: User = res.locals.user;
	const sessionId = String(req.query.sessionId ?? '');
	if (!sessionId) {
		res.status(400).send('sessionId missing');
		return;
	}

	// Never unlock from the redirect alone: ask the API what happened.
	const checkout = await agentaos.checkouts.retrieve(sessionId);
	if (checkout.metadata.customerId !== user.id) {
		res.status(404).send('Not found');
		return;
	}

	if (checkout.status === 'completed') {
		const { subscriptionId } = checkout.metadata;
		grantPro({
			userId: user.id,
			subscriptionId: typeof subscriptionId === 'string' ? subscriptionId : null,
			sessionId,
		});
	}
	res.send(successPage(user, checkout.status));
}
