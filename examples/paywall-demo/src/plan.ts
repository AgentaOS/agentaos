import type { Request, Response } from 'express';
import { agentaos, config } from './agentaos.js';
import type { User } from './store.js';
import { quotePage } from './views.js';

function subscriptionOf(res: Response): string {
	const user: User = res.locals.user;
	if (!user.subscriptionId) throw new Error('No subscription on this user');
	return user.subscriptionId;
}

// POST /plan/cancel: ends at the period end. The user keeps Pro until then.
export async function cancel(_req: Request, res: Response): Promise<void> {
	await agentaos.subscriptions.cancel(subscriptionOf(res));
	res.redirect(303, '/');
}

// POST /plan/preview: quote the move to Pro Plus. Nothing is charged yet.
export async function preview(_req: Request, res: Response): Promise<void> {
	if (!config.proPlusLinkId) {
		res.status(404).send('Set PRO_PLUS_LINK_ID');
		return;
	}
	const quote = await agentaos.subscriptions.previewPlanChange(
		subscriptionOf(res),
		config.proPlusLinkId,
	);
	res.send(quotePage(res.locals.user, quote));
}

// POST /plan/change: apply the quote the user confirmed.
export async function change(req: Request, res: Response): Promise<void> {
	if (!config.proPlusLinkId) {
		res.status(404).send('Set PRO_PLUS_LINK_ID');
		return;
	}
	await agentaos.subscriptions.changePlan(subscriptionOf(res), {
		targetLinkId: config.proPlusLinkId,
		// The quote's prorationDate makes the charge equal the amount the user saw.
		prorationDate: Number(req.body.prorationDate),
	});
	res.redirect(303, '/');
}
