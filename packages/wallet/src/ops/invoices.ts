import { z } from 'zod';
import { pageLimit } from './schema.js';
import { type OperationGroup, operation } from './types.js';
import { count, day, lines, money, moreLine } from './words.js';

/** Tax-correct invoices, newest first, and their receipts. */

export const invoicesList = operation({
	name: 'invoices.list',
	guidance:
		"Returns the merchant's invoices with their id, amount, currency, status and buyer, up to limit (1 to 100). Changes nothing. Use an id with agenta_invoices_receipt or agenta_invoices_send_receipt.",
	title: 'List invoices',
	effect: 'read',
	description: 'List invoices',
	input: z.object({ limit: pageLimit }),
	async run(sdk, input) {
		return sdk.invoices.list({ limit: input.limit });
	},
	describe(page) {
		if (!page.items.length) return 'No invoices yet. Every completed checkout issues one.';
		return lines(
			`${count(page.total, 'invoice')}:`,
			...page.items.map(
				(inv) =>
					`  - ${inv.invoiceNumber} — ${money(inv.amount, inv.currency)} — ${inv.status} — ${inv.buyerEmail ?? 'no buyer email'} — issued ${day(inv.issuedAt)} — ${inv.id}`,
			),
			moreLine(page.items.length, page.total, page.hasMore),
		);
	},
});

export interface ReceiptView {
	invoiceId: string;
	sizeBytes: number;
	/** The PDF, base64. Null once the CLI has written it to disk. */
	pdfBase64: string | null;
	/** Set by the CLI once it has saved the PDF; null everywhere else. */
	saved: string | null;
}

/** There is no public link to a receipt (the endpoint needs your key), so the
 *  bytes themselves are the result; the CLI writes them to a file. */
export const invoicesReceipt = operation({
	name: 'invoices.receipt',
	guidance:
		'Returns the receipt PDF for one paid invoice; a tool call gets the link, the CLI saves the file. Changes nothing.',
	title: 'Download receipt',
	effect: 'read',
	description: 'Download the receipt PDF for a paid invoice',
	input: z.object({
		id: z.string().min(1).describe('The invoice id'),
		output: z.string().optional().describe('File path to save the PDF to'),
	}),
	positional: 'id',
	async run(sdk, input): Promise<ReceiptView> {
		const pdf = await sdk.invoices.getReceipt(input.id);
		return {
			invoiceId: input.id,
			sizeBytes: pdf.length,
			pdfBase64: pdf.toString('base64'),
			saved: null,
		};
	},
	describe(receipt) {
		const size = `${Math.max(1, Math.round(receipt.sizeBytes / 1024))} KB`;
		return receipt.saved
			? `Saved the receipt for invoice ${receipt.invoiceId} to ${receipt.saved} (${size}).`
			: `The receipt PDF for invoice ${receipt.invoiceId} (${size}) is in pdfBase64; decode it to a .pdf file to read or forward it.`;
	},
});

export const invoicesSendReceipt = operation({
	name: 'invoices.sendReceipt',
	guidance:
		"Emails the receipt for one paid invoice again to the buyer's address on file. Sends an email to the buyer.",
	title: 'Re-send receipt email',
	effect: 'write',
	description: 'Re-send the receipt email to the buyer on file',
	input: z.object({ id: z.string().min(1).describe('The invoice id') }),
	positional: 'id',
	async run(sdk, input) {
		return sdk.invoices.sendReceipt(input.id);
	},
	describe(result) {
		return `Receipt sent to ${result.sentTo}.`;
	},
});

export const INVOICES: OperationGroup = {
	name: 'invoices',
	description: 'Invoice & receipt management (list, receipt, send-receipt)',
	operations: [invoicesList, invoicesReceipt, invoicesSendReceipt],
};
