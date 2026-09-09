import { writeFileSync } from 'node:fs';
import type { z } from 'zod';
import { auditShow } from '../ops/audit.js';
import { invoicesReceipt } from '../ops/invoices.js';
import type { Operation, OperationInput } from '../ops/types.js';

/**
 * The two things only a CLI can do with a result: write a file next to the
 * merchant. The operations return the bytes or the link; this layer saves them
 * and says where, so `describe` can name the file.
 */

interface SideEffect<I extends OperationInput = OperationInput, O = unknown> {
	op: Operation<I, O>;
	apply(input: z.infer<I>, result: O): Promise<O>;
}

function sideEffect<I extends OperationInput, O>(
	op: Operation<I, O>,
	apply: (input: z.infer<I>, result: O) => Promise<O>,
): SideEffect<I, O> {
	return { op, apply };
}

/** Saving is the point of asking, so it is the default. Only ever the
 *  merchant's OWN report, from the URL the server just handed us. */
const saveAuditReport = sideEffect(auditShow, async (input, result) => {
	const reportUrl = result.audit.reportUrl;
	if (!input.download || !reportUrl) return result;
	const savedTo = input.output ?? './revenue-audit.pdf';
	const res = await fetch(reportUrl, { signal: AbortSignal.timeout(30_000) });
	if (!res.ok) throw new Error(`Could not download the report (${res.status}).`);
	writeFileSync(savedTo, Buffer.from(await res.arrayBuffer()));
	return { audit: { ...result.audit, savedTo } };
});

const saveReceipt = sideEffect(invoicesReceipt, async (input, result) => {
	const saved = input.output ?? `./receipt-${input.id}.pdf`;
	writeFileSync(saved, Buffer.from(result.pdfBase64 ?? '', 'base64'));
	return { ...result, pdfBase64: null, saved };
});

const SIDE_EFFECTS: readonly SideEffect[] = [saveAuditReport, saveReceipt];

export async function applySideEffect(
	op: Operation,
	input: Record<string, unknown>,
	result: unknown,
): Promise<unknown> {
	const effect = SIDE_EFFECTS.find((candidate) => candidate.op === op);
	return effect ? effect.apply(input, result) : result;
}
