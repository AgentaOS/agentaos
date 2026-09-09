import type { DeliveryMethod, SubmitAccountReview, VolumeBand } from '@agentaos/pay';
import { z } from 'zod';
import { CATEGORIES } from './audit.js';
import { type VerificationView, verificationView } from './readiness.js';
import { countryCode, liveUrl, oneOf } from './schema.js';
import { type OperationGroup, operation } from './types.js';
import { lines } from './words.js';

/**
 * Business verification: the human step before live payments, reviewed by a
 * person. Built for AI tools and scripts: every input is a flag, and an error
 * names EVERY missing field at once, because a caller with no terminal cannot
 * be asked twice.
 */

const DELIVERY = [
	'instant_digital',
	'email_delivery',
	'subscription_access',
	'manual',
	'scheduled_service',
	'physical_shipped',
	'other',
] as const satisfies readonly DeliveryMethod[];

const VOLUME_BANDS = [
	'under_1k',
	'1k_10k',
	'10k_50k',
	'over_50k',
] as const satisfies readonly VolumeBand[];

/** The five statements `--accept-declaration` attests to. Its own operation so
 *  an agent can surface them to the merchant who is actually making the
 *  attestation, rather than accepting on their behalf blind. */
const DECLARATION = [
	'My pricing is visible before checkout, not after.',
	"My product name doesn't borrow someone else's brand.",
	'Any reviews or user counts on my site are real.',
	'My site has a public Privacy Policy and Terms.',
	"My product isn't built for spam, fraud or harassment.",
];

/** Regulated and restricted activities. Answering `--restricted` does not block
 *  the application: it means extra checks and a higher chance of a decline. */
const RESTRICTED_ACTIVITIES = [
	'Adult content',
	'Gambling',
	'Weapons',
	'Drugs & supplements',
	'Financial advice',
	'Counterfeit goods',
	'Data scraping',
	'Engagement farming',
];

const CONSEQUENCE =
	'If one turns out not to be true, we stop payouts and may close the account. A review rejected for a prohibited product or fraud cannot be resubmitted for three months.';

const RESTRICTED_WARNING =
	'A regulated or restricted activity was declared. The application still goes to review, but our payment partner runs extra checks and there is a higher chance it comes back declined.';

export const verifyDeclaration = operation({
	name: 'verify.declaration',
	description: 'The five statements --accept-declaration attests to',
	input: z.object({}),
	async run() {
		return {
			declaration: DECLARATION,
			restrictedActivities: RESTRICTED_ACTIVITIES,
			consequence: CONSEQUENCE,
		};
	},
	describe(result) {
		return lines(
			'Submitting verification attests that:',
			...result.declaration.map((statement) => `  - ${statement}`),
			'',
			`Regulated or restricted activities (declare with --restricted): ${result.restrictedActivities.join(', ')}.`,
			result.consequence,
		);
	},
});

const submitInput = z.object({
	entity: oneOf(['business', 'individual'], '--entity')
		.default('business')
		.describe('business | individual (default business)'),
	legalName: z.string().trim().optional().describe('Registered company name, or full legal name'),
	registrationNumber: z
		.string()
		.trim()
		.optional()
		.describe('Company registration number (business only)'),
	displayName: z
		.string()
		.trim()
		.optional()
		.describe('Name buyers see on their statement (default --legal-name)'),
	country: countryCode('--country').optional().describe('Country of registration, 2-letter code'),
	street: z.string().trim().optional().describe('Registered address'),
	city: z.string().trim().optional().describe('City'),
	postal: z.string().trim().optional().describe('Postal code'),
	addressCountry: countryCode('--address-country')
		.optional()
		.describe('2-letter code (defaults to --country)'),
	url: liveUrl('--url').optional().describe('The merchant project page'),
	description: z.string().trim().optional().describe('One sentence on what it does'),
	category: oneOf(CATEGORIES, '--category').optional().describe(CATEGORIES.join(' | ')),
	delivery: oneOf(DELIVERY, '--delivery').optional().describe(DELIVERY.join(' | ')),
	volume: oneOf(VOLUME_BANDS, '--volume').optional().describe(VOLUME_BANDS.join(' | ')),
	customers: z.boolean().optional().describe('The merchant already has paying customers'),
	restricted: z
		.boolean()
		.optional()
		.describe('The merchant sells a regulated or restricted activity'),
	usageClaims: z.boolean().optional().describe('The site shows reviews or user counts'),
	acceptDeclaration: z
		.boolean()
		.optional()
		.describe('Attest to the five statements (agenta verify declaration)'),
});

type SubmitInput = z.infer<typeof submitInput>;

/** The POST body, or one error naming EVERY missing field. */
export function submitBody(input: SubmitInput): SubmitAccountReview {
	const missing: string[] = [];
	const need = (value: string | undefined, flag: string): string => {
		if (!value) missing.push(flag);
		return value ?? '';
	};

	const legalName = need(input.legalName, '--legal-name');
	const taxCountry = need(input.country, '--country');
	const street = need(input.street, '--street');
	const city = need(input.city, '--city');
	const productUrl = need(input.url, '--url');
	const registrationNumber =
		input.entity === 'business'
			? need(input.registrationNumber, '--registration-number')
			: undefined;
	if (!input.acceptDeclaration) missing.push('--accept-declaration');
	if (missing.length) {
		throw new Error(
			`Missing required flags: ${missing.join(', ')}. Run verify declaration to read what --accept-declaration attests to.`,
		);
	}

	return {
		entityType: input.entity,
		legalName,
		...(registrationNumber ? { registrationNumber } : {}),
		taxCountry,
		address: {
			street,
			city,
			...(input.postal ? { postal: input.postal } : {}),
			// Registered in X, address in X, for very nearly everyone.
			country: input.addressCountry ?? taxCountry,
		},
		productUrl,
		...(input.description ? { productDescription: input.description } : {}),
		displayName: input.displayName || legalName,
		checklist: {
			prohibited_ok: input.restricted !== true,
			checklist_ack: true,
			cooldown_ack: true,
			privacy_ok: true,
			tos_ok: true,
			has_usage_claims: input.usageClaims === true,
			no_false_claims_ok: true,
			has_customers: input.customers === true,
			trademark_ok: true,
			pricing_clear_ok: true,
			ethical_ok: true,
			...(input.category ? { product_category: input.category } : {}),
			...(input.delivery ? { delivery_method: input.delivery } : {}),
			...(input.volume ? { volume_band: input.volume } : {}),
		},
	};
}

export interface VerifySubmitView {
	verification: Partial<VerificationView> & {
		state: VerificationView['state'];
		label: string;
		submitted: boolean;
		reason?: 'already_submitted';
		reviewedBy?: string;
		warning?: string;
	};
}

export const verifySubmit = operation({
	name: 'verify.submit',
	description: 'Submit business verification so the merchant can accept live payments',
	input: submitInput,
	async run(sdk, input): Promise<VerifySubmitView> {
		const readiness = await sdk.goLive.get();
		// Already submitted: say so explicitly rather than silently re-posting.
		if (readiness.verifyState !== 'unverified') {
			return {
				verification: {
					...verificationView(readiness),
					submitted: false,
					reason: 'already_submitted',
				},
			};
		}

		await sdk.accountReview.submit(submitBody(input));
		return {
			verification: {
				state: 'in_review',
				label: 'In review',
				submitted: true,
				reviewedBy: 'a person, usually within 24 to 48 hours',
				...(input.restricted ? { warning: RESTRICTED_WARNING } : {}),
			},
		};
	},
	describe({ verification }) {
		if (!verification.submitted) {
			return lines(
				`Nothing was sent: your verification is already on file (${verification.label.toLowerCase()}).`,
				verification.changesRequested?.length
					? `We asked you to: ${verification.changesRequested.join('; ')}. Send it back with verify resubmit once done.`
					: 'Nothing to do until we write back.',
			);
		}
		return lines(
			'Your business verification is with us; a person reviews it, usually within 24 to 48 hours.',
			'Nothing to do until we write back. verify status tells you where it has got to.',
			verification.warning,
		);
	},
});

export const verifyStatus = operation({
	name: 'verify.status',
	description: 'Where the verification has got to',
	input: z.object({}),
	async run(sdk) {
		const readiness = await sdk.goLive.get();
		return {
			verification: {
				...verificationView(readiness),
				...(readiness.rfi ? { next: 'agenta verify resubmit' } : {}),
			},
		};
	},
	describe({ verification }) {
		return lines(
			describeVerification(verification),
			verification.changesRequested.length
				? `We asked you to: ${verification.changesRequested.join('; ')}. Send it back with verify resubmit once done.`
				: null,
			verification.heldReason ? `On hold because: ${verification.heldReason}` : null,
			verification.rejectReason ? `Rejected because: ${verification.rejectReason}` : null,
			verification.cooldownUntil
				? `You can apply again after ${verification.cooldownUntil.slice(0, 10)}.`
				: null,
		);
	},
});

function describeVerification(v: VerificationView): string {
	switch (v.state) {
		case 'verified':
			return 'Your business is verified.';
		case 'in_review':
			return v.changesRequested.length
				? 'Your verification is waiting on changes from you.'
				: 'Your business verification is with us; nothing to do until we write back.';
		case 'on_hold':
			return 'Your account is on hold.';
		case 'rejected':
			return 'Your verification was rejected.';
		default:
			return 'You have not submitted business verification yet. Read verify declaration, then verify submit.';
	}
}

export const verifyResubmit = operation({
	name: 'verify.resubmit',
	description: 'Send back for review after making the changes we asked for',
	input: z.object({}),
	async run(sdk) {
		await sdk.accountReview.resubmit();
		return {
			verification: {
				state: 'in_review' as const,
				label: 'In review',
				resubmitted: true as const,
				note: 'Nothing was retyped: the application already on file was reused.',
			},
		};
	},
	describe() {
		return lines(
			'Your verification is back with us for review; the application already on file was reused.',
			'Nothing to do until we write back.',
		);
	},
});

export const VERIFY: OperationGroup = {
	name: 'verify',
	description: 'Business verification, so the merchant can accept live payments',
	operations: [verifySubmit, verifyStatus, verifyResubmit, verifyDeclaration],
};
