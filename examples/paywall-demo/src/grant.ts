// What a payment changes in your app. The success page and the webhook both call these,
// so each one runs once per checkout, whichever arrives first.
import { findUserBySubscription, onceForSession, updateUser } from './store.js';

/** First payment or trial start: link the subscription to the user. */
export function grantPro(input: {
	userId: string;
	subscriptionId: string | null;
	sessionId: string;
}): void {
	const granted = onceForSession(input.sessionId, () =>
		updateUser(input.userId, { subscriptionId: input.subscriptionId, pendingSessionId: null }),
	);
	console.log(
		`grantPro ${input.userId} session=${input.sessionId}: ${granted ? 'granted' : 'already handled'}`,
	);
}

/** A paid renewal. It carries no customerId, so the stored subscription ID finds the user. */
export function recordRenewal(input: { subscriptionId: string; sessionId: string }): void {
	const user = findUserBySubscription(input.subscriptionId);
	if (!user) {
		console.warn(`Renewal for unknown subscription ${input.subscriptionId}`);
		return;
	}
	const recorded = onceForSession(input.sessionId, () =>
		updateUser(user.id, { subscriptionStatus: 'active' }),
	);
	console.log(
		`recordRenewal ${user.id} session=${input.sessionId}: ${recorded ? 'recorded' : 'already handled'}`,
	);
}
