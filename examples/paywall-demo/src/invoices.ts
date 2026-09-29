import type { SubscriptionInvoice } from '@agentaos/pay';
import type { Request, Response } from 'express';
import { agentaos } from './agentaos.js';
import type { User } from './store.js';

/** Every invoice of this user's subscription, newest first. */
export async function userInvoices(user: User): Promise<SubscriptionInvoice[]> {
	if (!user.subscriptionId) return [];
	return agentaos.subscriptions.invoices(user.subscriptionId);
}

// GET /invoices/:id/pdf and /invoices/:id/receipt. The SDK returns the PDF bytes;
// your server streams them, after it checks that the invoice is this user's.
export async function downloadInvoice(req: Request, res: Response): Promise<void> {
	const user: User = res.locals.user;
	const id = String(req.params.id);
	const kind = req.path.endsWith('/receipt') ? 'receipt' : 'invoice';

	const invoice = (await userInvoices(user)).find((i) => i.id === id);
	if (!invoice) {
		res.status(404).send('Not found');
		return;
	}

	const pdf =
		kind === 'receipt'
			? await agentaos.invoices.getReceipt(id)
			: await agentaos.invoices.downloadPdf(id);
	res.type('application/pdf').attachment(`${kind}-${invoice.invoiceNumber}.pdf`).send(pdf);
}
