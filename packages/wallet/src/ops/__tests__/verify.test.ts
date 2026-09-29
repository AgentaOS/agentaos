import type { AgentaOS } from '@agentaos/pay';
import { describe, expect, it } from 'vitest';
import { submitBody, verifyDeclaration, verifySubmit } from '../verify.js';

/** The fewest flags a submit accepts: an individual, with the declaration accepted. */
const MINIMAL_SUBMIT = {
	entity: 'individual' as const,
	legalName: 'Test Founder',
	country: 'EE',
	street: 'Sepapaja 6',
	city: 'Tallinn',
	url: 'https://example.com',
	acceptDeclaration: true,
};

describe('verify declaration — the categories we do not sell', () => {
	it('lists them as not supported and says an application for one is refused', async () => {
		const result = await verifyDeclaration.run({} as AgentaOS, {});

		const text = verifyDeclaration.describe(result);

		expect(text).toContain('Not supported (we do not sell these): Adult content, Gambling');
		expect(text).toContain('An application for one of these is refused, not reviewed.');
	});

	it('no longer offers a flag to declare one', async () => {
		const result = await verifyDeclaration.run({} as AgentaOS, {});

		expect(verifyDeclaration.describe(result)).not.toContain('--restricted');
	});
});

describe('verify submit — no restricted declaration', () => {
	it('has no --restricted flag', () => {
		expect(Object.keys(verifySubmit.input.shape)).not.toContain('restricted');
	});

	it('sends no restricted field and attests the business sells none of them', () => {
		const body = submitBody(MINIMAL_SUBMIT);

		expect(body).not.toHaveProperty('restricted');
		expect(body.checklist.prohibited_ok).toBe(true);
	});
});
