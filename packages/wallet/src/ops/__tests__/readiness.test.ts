import type { GoLiveReadiness } from '@agentaos/pay';
import { describe, expect, it } from 'vitest';
import { auditLabel, nextStep, verifyLabel } from '../readiness.js';

/** A brand-new account: logged in, nothing done. Every test starts here and
 *  changes only the field under test, so a passing assertion can only be
 *  explained by that field. */
function fresh(over: Partial<GoLiveReadiness> = {}): GoLiveReadiness {
	return {
		triedIt: false,
		verifyState: 'unverified',
		hasPayoutAccount: false,
		canGoLive: false,
		progress: { done: 0, total: 3 },
		rejectReason: null,
		cooldownUntil: null,
		heldReason: null,
		rfi: null,
		audit: null,
		milestones: {
			firstProductAt: null,
			firstTestPaymentAt: null,
			firstLivePaymentAt: null,
			livePaymentCount: 0,
		},
		...over,
	};
}

/** Asked for, not yet written — the state an audit spends most of its life in. */
function requestedAudit(): GoLiveReadiness['audit'] {
	return {
		requestedAt: '2026-08-26T09:00:00.000Z',
		publishedAt: null,
		reportUrl: null,
		grade: null,
	};
}

function withRfi(text: string): GoLiveReadiness['rfi'] {
	return {
		question: text,
		askedAt: '2026-08-26T09:00:00.000Z',
		items: [{ id: 'a', text, at: '2026-08-26T09:00:00.000Z' }],
	};
}

// ---------------------------------------------------------------------------
// verifyLabel
// ---------------------------------------------------------------------------

describe('verifyLabel', () => {
	it('reads "Not submitted" for a brand-new account', () => {
		expect(verifyLabel(fresh())).toBe('Not submitted');
	});

	it.each([
		['verified', 'Verified'],
		['in_review', 'In review'],
		['on_hold', 'On hold'],
		['rejected', 'Rejected'],
	] as const)('maps %s to %s', (state, label) => {
		expect(verifyLabel(fresh({ verifyState: state }))).toBe(label);
	});

	// The merchant is the one being waited on, and "In review" would tell them to
	// sit still while we wait for them.
	it('says changes are requested even while the state is still in_review', () => {
		const r = fresh({ verifyState: 'in_review', rfi: withRfi('Publish your Terms.') });
		expect(verifyLabel(r)).toBe('Changes requested');
	});
});

// ---------------------------------------------------------------------------
// auditLabel
// ---------------------------------------------------------------------------

describe('auditLabel', () => {
	it('reads "Not requested" before they ask', () => {
		expect(auditLabel(fresh())).toBe('Not requested');
	});

	it('reads "Being written" once asked but before the report exists', () => {
		expect(auditLabel(fresh({ audit: requestedAudit() }))).toBe('Being written');
	});

	it('reads the grade once the report is published', () => {
		const r = fresh({
			audit: {
				requestedAt: '2026-08-26T09:00:00.000Z',
				publishedAt: '2026-08-26T12:00:00.000Z',
				reportUrl: 'https://example.test/report.pdf',
				grade: 'C',
			},
		});
		expect(auditLabel(r)).toBe('Ready (graded C)');
	});

	// A published report with no grade must still read as ready, not as pending.
	it('reads "Ready" for a published report with no grade', () => {
		const r = fresh({
			audit: {
				requestedAt: '2026-08-26T09:00:00.000Z',
				publishedAt: '2026-08-26T12:00:00.000Z',
				reportUrl: 'https://example.test/report.pdf',
				grade: null,
			},
		});
		expect(auditLabel(r)).toBe('Ready');
	});
});

// ---------------------------------------------------------------------------
// nextStep — the precedence is the whole point, so test the ORDER, not just
// each branch in isolation.
// ---------------------------------------------------------------------------

describe('nextStep', () => {
	it('starts a new merchant on the free audit', () => {
		expect(nextStep(fresh())?.command).toBe('agenta audit request');
	});

	it('moves to verification once the audit is requested', () => {
		expect(nextStep(fresh({ audit: requestedAudit() }))?.command).toBe('agenta verify submit');
	});

	// Payout accounts are added in the dashboard; there is no CLI command, so the
	// step carries no command — only the reason. Naming a command that does not
	// exist would send an agent into a wall.
	it('asks for a payout account once verified, as a dashboard step', () => {
		const r = fresh({ verifyState: 'verified', hasPayoutAccount: false, audit: requestedAudit() });
		const step = nextStep(r);
		expect(step?.command).toBeNull();
		expect(step?.why).toMatch(/payout account in the dashboard/);
	});

	// The audit is a gift, never a gate. A verified merchant who skipped it needs
	// a payout account, and telling them to go get an audit first would put a
	// present in front of getting paid.
	it('does not send a verified merchant back for an audit they never asked for', () => {
		const r = fresh({ verifyState: 'verified', hasPayoutAccount: false, audit: null });
		const step = nextStep(r);
		expect(step?.command).toBeNull();
		expect(step?.why).toMatch(/payout account/);
	});

	it('has nothing to chase once the merchant can go live', () => {
		const r = fresh({
			verifyState: 'verified',
			hasPayoutAccount: true,
			canGoLive: true,
			audit: requestedAudit(),
		});
		expect(nextStep(r)).toBeNull();
	});

	// An open change request is the ONLY state where we are waiting on them, so
	// it has to beat every other candidate step.
	it('puts an open change request ahead of everything else', () => {
		const r = fresh({
			verifyState: 'in_review',
			rfi: withRfi('Add a currency next to your price.'),
			audit: null,
			hasPayoutAccount: false,
		});
		expect(nextStep(r)?.command).toBe('agenta verify resubmit');
	});

	// Nothing a terminal can do about these, and inventing a step would be worse
	// than saying nothing.
	it.each(['in_review', 'on_hold', 'rejected'] as const)(
		'offers no step while %s with no open request',
		(state) => {
			expect(nextStep(fresh({ verifyState: state, audit: requestedAudit() }))).toBeNull();
		},
	);
});
