import { describe, expect, it } from 'vitest';
import { headline } from '../status.js';

type Verification = Parameters<typeof headline>[0]['verification'];

function verification(state: Verification['state']): Verification {
	return {
		state,
		label: '',
		heldReason: null,
		rejectReason: null,
		cooldownUntil: null,
		changesRequested: [],
	};
}

describe('status headline', () => {
	it('says live payments are on once the server says the merchant can go live', () => {
		expect(headline({ canGoLive: true, verification: verification('verified') })).toBe(
			'You can take live payments.',
		);
	});

	// A server that still counted the payout account as a go-live step answers
	// canGoLive false for a verified merchant without one. Live checkout never
	// needed that account, so the headline follows the verification.
	it('says live payments are on for a verified merchant without a payout account', () => {
		expect(headline({ canGoLive: false, verification: verification('verified') })).toBe(
			'You can take live payments.',
		);
	});

	it.each(['unverified', 'in_review', 'on_hold', 'rejected'] as const)(
		'says live money waits on verification while the business is %s',
		(state) => {
			const line = headline({ canGoLive: false, verification: verification(state) });
			expect(line).toBe('Test payments work now. Live money waits on verification.');
			expect(line).not.toMatch(/payout account/);
		},
	);
});
