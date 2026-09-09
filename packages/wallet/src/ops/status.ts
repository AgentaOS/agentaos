import type { GoLiveReadiness } from '@agentaos/pay';
import { z } from 'zod';
import { type NextStep, auditLabel, nextStep, verificationView } from './readiness.js';
import { type OperationGroup, operation } from './types.js';
import { lines } from './words.js';

/**
 * `status.get` — how far along going live the merchant is.
 *
 * Test mode is usable the moment you are authenticated; only LIVE money waits
 * on verification and a payout account. Who you are (email, organization)
 * lives in the CLI session, so the CLI adds it to `account` when it prints.
 */

export interface StatusView {
	account: {
		paymentTools: { ready: true; mode: 'test'; next: string };
	};
	goLive: {
		canGoLive: boolean;
		progress: GoLiveReadiness['progress'];
		verification: ReturnType<typeof verificationView>;
		audit: { label: string; requested: boolean; reportUrl: string | null; grade: string | null };
		payouts: { connected: boolean };
		milestones: GoLiveReadiness['milestones'];
		next: NextStep | null;
	};
}

export function statusView(readiness: GoLiveReadiness): StatusView {
	return {
		account: {
			paymentTools: { ready: true, mode: 'test', next: 'agenta pay checkout -a 50' },
		},
		goLive: {
			canGoLive: readiness.canGoLive,
			progress: readiness.progress,
			verification: verificationView(readiness),
			audit: {
				label: auditLabel(readiness),
				requested: !!readiness.audit,
				reportUrl: readiness.audit?.reportUrl ?? null,
				grade: readiness.audit?.grade ?? null,
			},
			payouts: { connected: readiness.hasPayoutAccount },
			milestones: readiness.milestones,
			next: nextStep(readiness),
		},
	};
}

function headline(goLive: StatusView['goLive']): string {
	if (goLive.canGoLive) return 'You can take live payments.';
	if (goLive.verification.state === 'verified') {
		return 'Test payments work now. Live money waits on a payout account.';
	}
	return 'Test payments work now. Live money waits on verification and a payout account.';
}

export function describeNext(next: NextStep | null): string | null {
	if (!next) return null;
	return next.command ? `Next: ${next.why} (${next.command}).` : `Next: ${next.why}.`;
}

export const statusGet = operation({
	name: 'status.get',
	description: 'Account and go-live overview',
	input: z.object({}),
	async run(sdk) {
		return statusView(await sdk.goLive.get());
	},
	describe({ goLive }) {
		const { verification, audit, payouts, progress } = goLive;
		return lines(
			headline(goLive),
			`Go-live steps done: ${progress.done} of ${progress.total}.`,
			`Business verification: ${verification.label}.`,
			verification.changesRequested.length
				? `We asked you to: ${verification.changesRequested.join('; ')}.`
				: null,
			verification.heldReason ? `On hold because: ${verification.heldReason}` : null,
			verification.rejectReason ? `Rejected because: ${verification.rejectReason}` : null,
			`Free Revenue & Pricing Audit: ${audit.label}.`,
			`Payout account: ${payouts.connected ? 'connected' : 'not yet added'}.`,
			describeNext(goLive.next),
		);
	},
});

export const STATUS: OperationGroup = {
	name: 'status',
	description: 'Account and go-live overview',
	operations: [statusGet],
};
