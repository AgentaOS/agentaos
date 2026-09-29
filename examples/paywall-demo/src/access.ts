import type { Subscription } from '@agentaos/pay';
import type { NextFunction, Request, Response } from 'express';
import { agentaos } from './agentaos.js';
import type { User } from './store.js';

/** Reads one subscription by ID. The list has no metadata, so the stored ID is the key. */
export async function findSubscription(id: string | null): Promise<Subscription | null> {
	if (!id) return null;
	for (let offset = 0; ; offset += 100) {
		const page = await agentaos.subscriptions.list({ limit: 100, offset });
		const found = page.items.find((s) => s.id === id);
		if (found) return found;
		if (!page.hasMore) return null;
	}
}

export function isPro(subscription: Subscription | null): boolean {
	return subscription?.status === 'active' || subscription?.status === 'trialing';
}

/** Put in front of every Pro route. Needs `requireUser` first. */
export async function requirePro(_req: Request, res: Response, next: NextFunction): Promise<void> {
	const user: User = res.locals.user;
	const subscription = await findSubscription(user.subscriptionId);
	if (!isPro(subscription)) {
		res.redirect(303, '/?locked=1');
		return;
	}
	res.locals.subscription = subscription;
	next();
}
