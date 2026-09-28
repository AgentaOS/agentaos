import type { Business } from '@agentaos/pay';
import { z } from 'zod';
import { countryCode } from './schema.js';
import { type OperationGroup, operation } from './types.js';
import { count, lines } from './words.js';

/**
 * Connect (PRD §6.1 R9-3): the businesses you manage — your clients' businesses and other apps
 * of your own company — as Stripe Connect's connected accounts. To do anything AS one of them,
 * add `--business <id>` to any command (`agenta products create … --business <id>`).
 */

const STATUS_WORDS: Record<Business['status'], string> = {
	test_only: 'test mode',
	in_review: 'in review',
	changes_needed: 'changes needed',
	on_hold: 'on hold',
	rejected: 'rejected',
	live: 'live',
};

function businessLine(b: Business): string {
	const facts = [
		STATUS_WORDS[b.status] ?? b.status,
		b.sameLegalEntity ? 'your own company' : null,
		b.identityVerified ? 'identity verified' : null,
		b.invitedEmail ? `invitation open for ${b.invitedEmail}` : null,
	].filter(Boolean);
	return `  - ${b.name} (${facts.join(', ')}) — ${b.id}`;
}

const id = z.string().min(1).describe('The business id');

export const businessesList = operation({
	name: 'businesses.list',
	description: 'List the businesses you manage',
	input: z.object({}),
	async run(sdk) {
		return { items: await sdk.businesses.list() };
	},
	describe({ items }) {
		if (!items.length) {
			return 'You manage no businesses yet. Add one with: agenta businesses create --name … --country …';
		}
		return lines(`${count(items.length, 'business', 'businesses')}:`, ...items.map(businessLine));
	},
});

export const businessesGet = operation({
	name: 'businesses.get',
	description: 'Show one business you manage',
	input: z.object({ id }),
	positional: 'id',
	async run(sdk, input) {
		return sdk.businesses.retrieve(input.id);
	},
	describe(b) {
		return lines(
			businessLine(b).trimStart().slice(2),
			`Act as it: add --business ${b.id} to any command.`,
		);
	},
});

export const businessesCreate = operation({
	name: 'businesses.create',
	description: "Add a business you manage — a client's business, or another app of your company",
	input: z.object({
		name: z.string().min(1).describe('Name buyers see'),
		country: countryCode('--country').describe('Where it is registered, e.g. EE'),
		clientEmail: z
			.string()
			.email()
			.optional()
			.describe('Invite your client as its admin. Omit to run it yourself'),
		sameCompany: z
			.boolean()
			.optional()
			.describe(
				'Another app of your own company (verified and priced with you) instead of a client',
			),
		inviteEmail: z
			.boolean()
			.default(true)
			.describe('Email the invitation (switch off to send the link yourself)'),
	}),
	async run(sdk, input) {
		const created = await sdk.businesses.create({
			name: input.name,
			country: input.country,
			...(input.clientEmail ? { clientEmail: input.clientEmail } : {}),
			...(input.sameCompany ? { sameLegalEntity: true } : {}),
			...(input.clientEmail ? { sendInvitationEmail: input.inviteEmail } : {}),
		});
		return {
			...created,
			emailedTo: input.clientEmail && input.inviteEmail ? input.clientEmail : null,
		};
	},
	describe(result) {
		const b = result.business;
		return lines(
			`Added ${b.name}. It starts in test mode and goes live after its own verification.`,
			`Business id: ${b.id} — add --business ${b.id} to any command to act as it.`,
			result.inviteUrl
				? result.emailedTo
					? `We emailed the invitation to ${result.emailedTo}.`
					: `Send ${b.name} this link to accept: ${result.inviteUrl}`
				: null,
		);
	},
});

export const businessesInvite = operation({
	name: 'businesses.invite',
	description: "Send your client's invitation again (a new link; the old one stops working)",
	input: z.object({
		id,
		email: z.boolean().default(true).describe('Email it (switch off to send the link yourself)'),
	}),
	positional: 'id',
	async run(sdk, input) {
		const invitation = await sdk.businesses.resendInvitation(input.id, {
			sendInvitationEmail: input.email,
		});
		return { ...invitation, emailed: input.email };
	},
	describe(result) {
		return result.emailed
			? `Emailed a new invitation. The link, if you need it: ${result.inviteUrl}`
			: `Send your client this link to accept: ${result.inviteUrl}`;
	},
});

export const businessesRevokeInvite = operation({
	name: 'businesses.revokeInvite',
	description: "Withdraw your client's open invitation",
	input: z.object({ id }),
	positional: 'id',
	async run(sdk, input) {
		await sdk.businesses.revokeInvitation(input.id);
		return { id: input.id, revoked: true as const };
	},
	describe() {
		return 'Invitation withdrawn: its link no longer works.';
	},
});

export const businessesIdLink = operation({
	name: 'businesses.idLink',
	description: 'Get the identity check link for your client (only they can complete it)',
	input: z.object({ id }),
	positional: 'id',
	async run(sdk, input) {
		return sdk.businesses.createVerificationLink(input.id);
	},
	describe(link) {
		return link.url
			? `Send your client this link — only they can complete the identity check: ${link.url}`
			: 'Their identity is already verified. Nothing to send.';
	},
});

export const BUSINESSES: OperationGroup = {
	name: 'businesses',
	description: "Businesses you manage (Connect): your clients' businesses and your other apps",
	operations: [
		businessesList,
		businessesGet,
		businessesCreate,
		businessesInvite,
		businessesRevokeInvite,
		businessesIdLink,
	],
};
