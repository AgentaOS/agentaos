import type { AuditDeliveryMethod, ProductCategory } from '@agentaos/pay';
import { z } from 'zod';
import { auditLabel } from './readiness.js';
import { liveUrl, oneOf } from './schema.js';
import { type OperationGroup, operation } from './types.js';
import { lines } from './words.js';

/**
 * The free Revenue & Pricing Audit, onboarding step 1. It gates nothing: a
 * gift before verification, never a step between a merchant and getting paid.
 */

export const CATEGORIES = [
	'saas',
	'digital',
	'services',
	'marketplace',
	'physical',
	'other',
] as const satisfies readonly ProductCategory[];

/** The subset the audit request accepts (server: `RequestAuditDto.deliveryMethod`). */
const AUDIT_DELIVERY = [
	'instant_digital',
	'scheduled_service',
	'physical_shipped',
	'other',
] as const satisfies readonly AuditDeliveryMethod[];

export const auditRequest = operation({
	name: 'audit.request',
	description: 'Ask for the free Revenue & Pricing Audit',
	input: z.object({
		url: liveUrl('--url').describe('The page on the merchant website where they sell it'),
		description: z.string().trim().optional().describe('One sentence on what it does'),
		category: oneOf(CATEGORIES, '--category').optional().describe(CATEGORIES.join(' | ')),
		delivery: oneOf(AUDIT_DELIVERY, '--delivery').optional().describe(AUDIT_DELIVERY.join(' | ')),
	}),
	async run(sdk, input) {
		await sdk.accountReview.requestAudit({
			productUrl: input.url,
			...(input.description ? { productDescription: input.description } : {}),
			...(input.category ? { productCategory: input.category } : {}),
			...(input.delivery ? { deliveryMethod: input.delivery } : {}),
		});
		return {
			audit: {
				requested: true as const,
				productUrl: input.url,
				label: 'Being written',
				// No turnaround promise: a date we miss costs more than a date we
				// never gave (same rule as the app, 2026-09-09).
				writtenBy: 'a person',
			},
		};
	},
	describe({ audit }) {
		return lines(
			`Your free Revenue & Pricing Audit of ${audit.productUrl} is being written by a person.`,
			'Nothing to do until it is ready; audit show tells you when it is and saves the report.',
		);
	},
});

export interface AuditShowView {
	audit: {
		requested: boolean;
		label: string;
		reportUrl: string | null;
		grade: string | null;
		/** Set by the CLI once it has saved the PDF; null everywhere else. */
		savedTo: string | null;
		next?: string;
	};
}

export const auditShow = operation({
	name: 'audit.show',
	description: 'The audit state, and download the report PDF once it exists',
	input: z.object({
		output: z
			.string()
			.optional()
			.describe('Save the report PDF here (default ./revenue-audit.pdf)'),
		download: z
			.boolean()
			.default(true)
			.describe(
				'Save the report PDF once it exists (a terminal does; a tool call returns the link)',
			),
	}),
	async run(sdk): Promise<AuditShowView> {
		const readiness = await sdk.goLive.get();
		return {
			audit: {
				requested: !!readiness.audit,
				label: auditLabel(readiness),
				reportUrl: readiness.audit?.reportUrl ?? null,
				grade: readiness.audit?.grade ?? null,
				savedTo: null,
				...(readiness.audit ? {} : { next: 'agenta audit request' }),
			},
		};
	},
	describe({ audit }) {
		if (!audit.requested) {
			return 'You have not asked for the free Revenue & Pricing Audit yet. Ask with audit request; it costs nothing and gates nothing.';
		}
		if (!audit.reportUrl) {
			return 'Your audit is being written by a person. Nothing to do until it is ready.';
		}
		return lines(
			audit.grade ? `Your audit is ready, graded ${audit.grade}.` : 'Your audit is ready.',
			audit.savedTo ? `Saved the report to ${audit.savedTo}.` : `Report: ${audit.reportUrl}`,
		);
	},
});

export const AUDIT: OperationGroup = {
	name: 'audit',
	description: 'The free Revenue & Pricing Audit',
	operations: [auditRequest, auditShow],
};
