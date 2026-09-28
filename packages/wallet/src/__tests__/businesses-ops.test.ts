/**
 * Connect (PRD §6.1 R9-3): what `agenta businesses …` says — plain words and the next step.
 */
import { describe, expect, it, vi } from 'vitest';
import { businessesCreate, businessesIdLink, businessesList } from '../ops/businesses.js';

const business = {
	id: 'biz_1',
	name: 'ClientCo',
	country: 'EE',
	status: 'test_only' as const,
	platformOrgId: 'plat',
	createdAt: '2026-09-28T00:00:00Z',
	platformFee: { bps: 1000, fixedMinor: 50 },
	sameLegalEntity: false,
	feesThisMonth: [],
	invitedEmail: 'ana@clientco.com',
	identityVerified: false,
};

describe('agenta businesses', () => {
	it('create, white-label: hands back the link to send', async () => {
		const sdk = {
			businesses: {
				create: vi
					.fn()
					.mockResolvedValue({ business, inviteToken: 't', inviteUrl: 'https://app/invite/t' }),
			},
		};
		const input = businessesCreate.input.parse({
			name: 'ClientCo',
			country: 'ee',
			clientEmail: 'ana@clientco.com',
			inviteEmail: false,
		});

		const result = await businessesCreate.run(sdk as never, input);

		expect(sdk.businesses.create).toHaveBeenCalledWith({
			name: 'ClientCo',
			country: 'EE',
			clientEmail: 'ana@clientco.com',
			sendInvitationEmail: false,
		});
		expect(businessesCreate.describe(result)).toContain(
			'Send ClientCo this link to accept: https://app/invite/t',
		);
	});

	it('create, emailed: says who we emailed', async () => {
		const sdk = {
			businesses: {
				create: vi
					.fn()
					.mockResolvedValue({ business, inviteToken: 't', inviteUrl: 'https://app/invite/t' }),
			},
		};
		const input = businessesCreate.input.parse({
			name: 'ClientCo',
			country: 'EE',
			clientEmail: 'ana@clientco.com',
		});

		const result = await businessesCreate.run(sdk as never, input);

		expect(businessesCreate.describe(result)).toContain(
			'We emailed the invitation to ana@clientco.com.',
		);
	});

	it('list names each business with its state', () => {
		expect(businessesList.describe({ items: [business] })).toContain(
			'ClientCo (test mode, invitation open for ana@clientco.com) — biz_1',
		);
	});

	it('id-link: the link, or "already verified"', () => {
		expect(businessesIdLink.describe({ url: 'https://verify/x', status: 'Not Started' })).toContain(
			'only they can complete the identity check: https://verify/x',
		);
		expect(businessesIdLink.describe({ url: null, status: 'Approved' })).toContain(
			'already verified',
		);
	});
});
