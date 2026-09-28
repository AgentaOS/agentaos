import type { Invoice, ListInvoiceParams, PaginatedList, RequestOptions } from '../types.js';
import { BaseResource } from './base.js';

const BASE_PATH = '/api/v1/gateway/invoices';

export class InvoicesResource extends BaseResource {
	async list(params?: ListInvoiceParams, req?: RequestOptions): Promise<PaginatedList<Invoice>> {
		return this.getJson<PaginatedList<Invoice>>(
			BASE_PATH,
			params as Record<string, string | number | undefined>,
			req,
		);
	}

	async retrieve(id: string, req?: RequestOptions): Promise<Invoice> {
		return this.getJson<Invoice>(`${BASE_PATH}/${id}`, undefined, req);
	}

	async void(id: string, req?: RequestOptions): Promise<{ success: boolean }> {
		return this.postJson<{ success: boolean }>(`${BASE_PATH}/${id}/void`, undefined, req);
	}

	async downloadPdf(id: string, req?: RequestOptions): Promise<Buffer> {
		return this.getRaw(`${BASE_PATH}/${id}/pdf`, undefined, req);
	}

	async downloadStatement(
		params: { from: string; to: string },
		req?: RequestOptions,
	): Promise<Buffer> {
		return this.getRaw(`${BASE_PATH}/statement`, params, req);
	}

	async exportCsv(
		params?: {
			from?: string;
			to?: string;
			status?: string;
		},
		req?: RequestOptions,
	): Promise<string> {
		return this.getText(
			`${BASE_PATH}/export`,
			params as Record<string, string | number | undefined>,
			req,
		);
	}

	/**
	 * Download the receipt PDF for a paid invoice. Falls back to the invoice PDF
	 * for invoices issued before receipts existed.
	 */
	async getReceipt(id: string, req?: RequestOptions): Promise<Buffer> {
		return this.getRaw(`${BASE_PATH}/${id}/receipt`, undefined, req);
	}

	/** Re-send the receipt email to the buyer on file. Paid invoices only. */
	async sendReceipt(id: string, req?: RequestOptions): Promise<{ ok: true; sentTo: string }> {
		return this.postJson<{ ok: true; sentTo: string }>(
			`${BASE_PATH}/${id}/send-receipt`,
			undefined,
			req,
		);
	}
}
