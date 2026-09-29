import type { GoLiveReadiness } from '@agentaos/pay';

/**
 * Plain words for the go-live readiness the server returns. The server
 * decides what "ready" means; nothing here recomputes readiness from parts.
 */

/** One line for the verification row. Plain words, because a merchant reading a
 *  terminal has no chip colour to read it with. */
export function verifyLabel(r: GoLiveReadiness): string {
	if (r.rfi) return 'Changes requested';
	switch (r.verifyState) {
		case 'verified':
			return 'Verified';
		case 'in_review':
			return 'In review';
		case 'on_hold':
			return 'On hold';
		case 'rejected':
			return 'Rejected';
		default:
			return 'Not submitted';
	}
}

export function auditLabel(r: GoLiveReadiness): string {
	if (!r.audit) return 'Not requested';
	if (!r.audit.reportUrl) return 'Being written';
	return r.audit.grade ? `Ready (graded ${r.audit.grade})` : 'Ready';
}

export interface NextStep {
	/** Null when the step happens in the dashboard (there is no command for it). */
	command: string | null;
	why: string;
}

/**
 * The single most useful next command, or null when there is nothing to chase.
 *
 * Ordered the way the journey actually blocks: a change request is the
 * merchant's move and outranks everything, then verification. A verified
 * merchant can already sell; what is left is the bank account we pay into,
 * which they need before their first payout, not before their first sale.
 * States we cannot act on from a terminal (in review, on hold, rejected)
 * deliberately return null rather than inventing busywork.
 *
 * Every non-null command here MUST be a real `agenta` command — agents run
 * these verbatim. Each has an MCP tool of the same name (`agenta_verify_submit`).
 */
export function nextStep(r: GoLiveReadiness): NextStep | null {
	if (r.rfi) {
		return { command: 'agenta verify resubmit', why: 'we asked you to change something' };
	}
	if (r.verifyState === 'unverified') {
		// The audit is offered FIRST only to someone who has not started verifying:
		// it is a gift, not a gate, so it must never stand between a verified
		// merchant and getting paid.
		return r.audit
			? { command: 'agenta verify submit', why: 'verify your business to accept live payments' }
			: { command: 'agenta audit request', why: 'start with the free audit' };
	}
	if (r.verifyState === 'verified' && !r.hasPayoutAccount) {
		return {
			command: null,
			why: 'add a bank account in the dashboard (Balances → Payout accounts) before your first payout',
		};
	}
	return null;
}

/** The verification block the status and verify operations both return. */
export interface VerificationView {
	state: GoLiveReadiness['verifyState'];
	label: string;
	heldReason: string | null;
	rejectReason: string | null;
	cooldownUntil: string | null;
	/** Non-empty means we are waiting on the merchant, not the other way round. */
	changesRequested: string[];
}

export function verificationView(r: GoLiveReadiness): VerificationView {
	return {
		state: r.verifyState,
		label: verifyLabel(r),
		heldReason: r.heldReason,
		rejectReason: r.rejectReason,
		cooldownUntil: r.cooldownUntil,
		changesRequested: r.rfi?.items.map((item) => item.text) ?? [],
	};
}
