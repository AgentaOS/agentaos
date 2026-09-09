import { writeFileSync } from 'node:fs';
import { Command } from 'commander';
import { ensureSession } from '../../lib/ensure-session.js';
import { auditLabel, fetchGoLive, fetchOrg, postJson, verifyLabel } from '../../lib/go-live.js';

/**
 * Merchant onboarding: the free audit, then business verification.
 *
 * These commands are built for AI tools and scripts, not for a person at a
 * keyboard. That decides three things and they are not negotiable per-command:
 *
 *   - NO PROMPTS. Every input is a flag. A caller with no terminal must be able
 *     to complete the whole journey, so there is no path that waits on stdin.
 *   - JSON ONLY. Output is a single JSON object on stdout, whether or not a TTY
 *     is attached, so the contract never depends on how it was invoked.
 *   - Errors name what to do about them, in one shot: `{"error": "..."}` on
 *     stderr with exit code 1, listing EVERY missing flag rather than the first,
 *     because a caller with no terminal cannot be asked twice.
 */

interface Ctx {
	token: string;
	serverUrl: string;
	orgId: string;
}

async function context(): Promise<Ctx> {
	const session = await ensureSession();
	if (!session.ok) {
		throw new Error(
			session.reason === 'session-expired'
				? 'Your session expired. Run agenta login.'
				: 'Not logged in. Run agenta login first.',
		);
	}
	const org = await fetchOrg(session.serverUrl, session.token);
	if (!org) throw new Error('Could not read your organization. Is the server reachable?');
	return { token: session.token, serverUrl: session.serverUrl, orgId: org.id };
}

function orgQuery(ctx: Ctx, path: string): string {
	return `${path}?orgId=${encodeURIComponent(ctx.orgId)}`;
}

/** The single output path. One JSON object, always. */
function emit(data: Record<string, unknown>): void {
	console.log(JSON.stringify(data));
}

function fail(error: unknown): void {
	const message = error instanceof Error ? error.message : 'Unknown error';
	console.error(JSON.stringify({ error: message }));
	process.exitCode = 1;
}

/** Accepted values, echoed in `--help` so a caller can discover them without
 *  reading our docs. Same values the merchant dashboard writes. */
const CATEGORIES = ['saas', 'digital', 'services', 'marketplace', 'physical', 'other'] as const;
const DELIVERY = [
	'instant_digital',
	'email_delivery',
	'subscription_access',
	'manual',
	'scheduled_service',
	'physical_shipped',
	'other',
] as const;
const VOLUME_BANDS = ['under_1k', '1k_10k', '10k_50k', 'over_50k'] as const;

function isUrl(value: string): boolean {
	return /^https?:\/\/.+\..+/.test(value.trim());
}

/** Reject an unknown enum value loudly instead of posting it and letting the
 *  server decide — the caller can fix a named mistake. */
function checkEnum(value: string | undefined, allowed: readonly string[], flag: string): void {
	if (value && !allowed.includes(value)) {
		throw new Error(`${flag} must be one of: ${allowed.join(', ')}.`);
	}
}

// ---------------------------------------------------------------------------
// agenta audit — the free Revenue & Pricing Audit, onboarding step 1
// ---------------------------------------------------------------------------

const auditRequestCommand = new Command('request')
	.description('Ask for the free Revenue & Pricing Audit')
	.requiredOption('--url <url>', 'The page on the merchant website where they sell it')
	.option('--description <text>', 'One sentence on what it does')
	.option('--category <value>', CATEGORIES.join(' | '))
	.option('--delivery <value>', DELIVERY.join(' | '))
	.action(
		async (opts: { url: string; description?: string; category?: string; delivery?: string }) => {
			try {
				const productUrl = opts.url.trim();
				if (!isUrl(productUrl)) throw new Error('--url must be a live URL (https://…).');
				checkEnum(opts.category, CATEGORIES, '--category');
				checkEnum(opts.delivery, DELIVERY, '--delivery');

				const ctx = await context();
				const result = await postJson<{ review: unknown }>(
					ctx.serverUrl,
					orgQuery(ctx, '/gateway/account-review/audit'),
					ctx.token,
					{
						productUrl,
						...(opts.description?.trim() ? { productDescription: opts.description.trim() } : {}),
						...(opts.category ? { productCategory: opts.category } : {}),
						...(opts.delivery ? { deliveryMethod: opts.delivery } : {}),
					},
				);
				if (!result.ok) throw new Error(result.message);

				emit({
					audit: {
						requested: true,
						productUrl,
						label: 'Being written',
						// No turnaround promise: a date we miss costs more than a date we
						// never gave (same rule as the app, 2026-09-09).
						writtenBy: 'a person',
					},
				});
			} catch (error: unknown) {
				fail(error);
			}
		},
	);

const auditShowCommand = new Command('show')
	.description('The audit state, and download the report PDF once it exists')
	.option('-o, --output <path>', 'Save the report PDF here (default ./revenue-audit.pdf)')
	.option('--no-download', 'Return the link without saving the PDF')
	.action(async (opts: { output?: string; download?: boolean }) => {
		try {
			const ctx = await context();
			const readiness = await fetchGoLive(ctx.serverUrl, ctx.token, ctx.orgId);
			if (!readiness) throw new Error('Could not read your account.');

			const reportUrl = readiness.audit?.reportUrl ?? null;
			// Saving is the point of asking, so it is the default. Only ever the
			// merchant's OWN report, from the URL the server just handed us.
			let savedTo: string | null = null;
			if (opts.download !== false && reportUrl) {
				savedTo = opts.output ?? './revenue-audit.pdf';
				const res = await fetch(reportUrl, { signal: AbortSignal.timeout(30_000) });
				if (!res.ok) throw new Error(`Could not download the report (${res.status}).`);
				writeFileSync(savedTo, Buffer.from(await res.arrayBuffer()));
			}

			emit({
				audit: {
					requested: !!readiness.audit,
					label: auditLabel(readiness),
					reportUrl,
					grade: readiness.audit?.grade ?? null,
					savedTo,
					...(readiness.audit ? {} : { next: 'agenta audit request' }),
				},
			});
		} catch (error: unknown) {
			fail(error);
		}
	});

/** Named for the revenue audit specifically: this CLI already has an
 *  `auditCommand` for the sub-account signing log (`agenta sub audit`), which is
 *  an unrelated thing that happens to share the word. */
export const revenueAuditCommand = new Command('audit')
	.description('The free Revenue & Pricing Audit')
	.addCommand(auditRequestCommand)
	.addCommand(auditShowCommand);

// ---------------------------------------------------------------------------
// agenta verify — business verification
// ---------------------------------------------------------------------------

/** The five statements `--accept-declaration` attests to. Exposed as its own
 *  command so an agent can surface them to the merchant who is actually making
 *  the attestation, rather than accepting on their behalf blind. */
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

interface SubmitOptions {
	entity?: string;
	legalName?: string;
	registrationNumber?: string;
	displayName?: string;
	country?: string;
	street?: string;
	city?: string;
	postal?: string;
	addressCountry?: string;
	url?: string;
	description?: string;
	category?: string;
	delivery?: string;
	volume?: string;
	customers?: boolean;
	restricted?: boolean;
	usageClaims?: boolean;
	acceptDeclaration?: boolean;
}

/** Build the POST body from flags, reporting EVERY missing field at once. */
function bodyFromOptions(opts: SubmitOptions): Record<string, unknown> {
	const entityType = opts.entity ?? 'business';
	if (entityType !== 'business' && entityType !== 'individual') {
		throw new Error('--entity must be "business" or "individual".');
	}

	const missing: string[] = [];
	const need = (value: string | undefined, flag: string): string => {
		if (!value?.trim()) missing.push(flag);
		return value?.trim() ?? '';
	};

	const legalName = need(opts.legalName, '--legal-name');
	const taxCountry = need(opts.country, '--country');
	const street = need(opts.street, '--street');
	const city = need(opts.city, '--city');
	const productUrl = need(opts.url, '--url');
	const registrationNumber =
		entityType === 'business' ? need(opts.registrationNumber, '--registration-number') : undefined;
	if (!opts.acceptDeclaration) missing.push('--accept-declaration');
	if (missing.length) {
		throw new Error(
			`Missing required flags: ${missing.join(', ')}. Run agenta verify declaration to read what --accept-declaration attests to.`,
		);
	}

	if (!/^[A-Za-z]{2}$/.test(taxCountry)) throw new Error('--country must be a 2-letter code.');
	// Registered in X, address in X, for very nearly everyone.
	const addressCountry = (opts.addressCountry ?? taxCountry).trim();
	if (!/^[A-Za-z]{2}$/.test(addressCountry)) {
		throw new Error('--address-country must be a 2-letter code.');
	}
	if (!isUrl(productUrl)) throw new Error('--url must be a live URL (https://…).');
	checkEnum(opts.category, CATEGORIES, '--category');
	checkEnum(opts.delivery, DELIVERY, '--delivery');
	checkEnum(opts.volume, VOLUME_BANDS, '--volume');

	return {
		entityType,
		legalName,
		...(registrationNumber ? { registrationNumber } : {}),
		taxCountry: taxCountry.toUpperCase(),
		address: {
			street,
			city,
			...(opts.postal?.trim() ? { postal: opts.postal.trim() } : {}),
			country: addressCountry.toUpperCase(),
		},
		productUrl,
		...(opts.description?.trim() ? { productDescription: opts.description.trim() } : {}),
		displayName: (opts.displayName ?? legalName).trim(),
		checklist: {
			prohibited_ok: opts.restricted !== true,
			checklist_ack: true,
			cooldown_ack: true,
			privacy_ok: true,
			tos_ok: true,
			has_usage_claims: opts.usageClaims === true,
			no_false_claims_ok: true,
			has_customers: opts.customers === true,
			trademark_ok: true,
			pricing_clear_ok: true,
			ethical_ok: true,
			...(opts.category ? { product_category: opts.category } : {}),
			...(opts.delivery ? { delivery_method: opts.delivery } : {}),
			...(opts.volume ? { volume_band: opts.volume } : {}),
		},
	};
}

function verificationPayload(
	readiness: NonNullable<Awaited<ReturnType<typeof fetchGoLive>>>,
): Record<string, unknown> {
	return {
		state: readiness.verifyState,
		label: verifyLabel(readiness),
		heldReason: readiness.heldReason,
		rejectReason: readiness.rejectReason,
		cooldownUntil: readiness.cooldownUntil,
		/** Non-empty means we are waiting on the merchant, not the other way round. */
		changesRequested: readiness.rfi?.items.map((i) => i.text) ?? [],
		...(readiness.rfi ? { next: 'agenta verify resubmit' } : {}),
	};
}

const verifyDeclarationCommand = new Command('declaration')
	.description('The five statements --accept-declaration attests to')
	.action(() => {
		emit({
			declaration: DECLARATION,
			restrictedActivities: RESTRICTED_ACTIVITIES,
			consequence:
				'If one turns out not to be true, we stop payouts and may close the account. A review rejected for a prohibited product or fraud cannot be resubmitted for three months.',
		});
	});

const verifyStatusCommand = new Command('status')
	.description('Where the verification has got to')
	.action(async () => {
		try {
			const ctx = await context();
			const readiness = await fetchGoLive(ctx.serverUrl, ctx.token, ctx.orgId);
			if (!readiness) throw new Error('Could not read your account.');
			emit({ verification: verificationPayload(readiness) });
		} catch (error: unknown) {
			fail(error);
		}
	});

const verifyResubmitCommand = new Command('resubmit')
	.description('Send back for review after making the changes we asked for')
	.action(async () => {
		try {
			const ctx = await context();
			const result = await postJson<{ review: unknown }>(
				ctx.serverUrl,
				orgQuery(ctx, '/gateway/account-review/resubmit'),
				ctx.token,
				{},
			);
			if (!result.ok) throw new Error(result.message);
			emit({
				verification: {
					state: 'in_review',
					label: 'In review',
					resubmitted: true,
					note: 'Nothing was retyped: the application already on file was reused.',
				},
			});
		} catch (error: unknown) {
			fail(error);
		}
	});

const verifySubmitCommand = new Command('submit')
	.description('Submit business verification so the merchant can accept live payments')
	.option('--entity <type>', 'business | individual (default business)')
	.option('--legal-name <name>', 'Registered company name, or full legal name')
	.option('--registration-number <number>', 'Company registration number (business only)')
	.option('--display-name <name>', 'Name buyers see on their statement (default --legal-name)')
	.option('--country <code>', 'Country of registration, 2-letter code')
	.option('--street <street>', 'Registered address')
	.option('--city <city>', 'City')
	.option('--postal <code>', 'Postal code')
	.option('--address-country <code>', '2-letter code (defaults to --country)')
	.option('--url <url>', 'The merchant project page')
	.option('--description <text>', 'One sentence on what it does')
	.option('--category <value>', CATEGORIES.join(' | '))
	.option('--delivery <value>', DELIVERY.join(' | '))
	.option('--volume <band>', VOLUME_BANDS.join(' | '))
	.option('--customers', 'The merchant already has paying customers')
	.option('--restricted', 'The merchant sells a regulated or restricted activity')
	.option('--usage-claims', 'The site shows reviews or user counts')
	.option('--accept-declaration', 'Attest to the five statements (agenta verify declaration)')
	.action(async (opts: SubmitOptions) => {
		try {
			const ctx = await context();
			const readiness = await fetchGoLive(ctx.serverUrl, ctx.token, ctx.orgId);
			// Already submitted: say so explicitly rather than silently re-posting.
			if (readiness && readiness.verifyState !== 'unverified') {
				emit({
					verification: {
						...verificationPayload(readiness),
						submitted: false,
						reason: 'already_submitted',
					},
				});
				return;
			}

			const body = bodyFromOptions(opts);
			const result = await postJson<{ review: unknown }>(
				ctx.serverUrl,
				orgQuery(ctx, '/gateway/account-review'),
				ctx.token,
				body,
			);
			if (!result.ok) throw new Error(result.message);

			emit({
				verification: {
					state: 'in_review',
					label: 'In review',
					submitted: true,
					reviewedBy: 'a person, usually within 24 to 48 hours',
					...(opts.restricted
						? {
								warning:
									'A regulated or restricted activity was declared. The application still goes to review, but our payment partner runs extra checks and there is a higher chance it comes back declined.',
							}
						: {}),
				},
			});
		} catch (error: unknown) {
			fail(error);
		}
	});

export const verifyCommand = new Command('verify')
	.description('Business verification, so the merchant can accept live payments')
	.addCommand(verifySubmitCommand)
	.addCommand(verifyStatusCommand)
	.addCommand(verifyResubmitCommand)
	.addCommand(verifyDeclarationCommand);
