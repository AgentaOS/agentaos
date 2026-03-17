import type { Invoice, ListInvoiceParams, PaginatedList } from '../types.js';
import { BaseResource } from './base.js';

const BASE_PATH = '/api/v1/gateway/invoices';

export class InvoicesResource extends BaseResource {
	async list(params?: ListInvoiceParams): Promise<PaginatedList<Invoice>> {
		return this.get<PaginatedList<Invoice>>(
			BASE_PATH,
			params as Record<string, string | number | undefined>,
		);
	}

	async retrieve(id: string): Promise<Invoice> {
		return this.get<Invoice>(`${BASE_PATH}/${id}`);
	}

	async void(id: string): Promise<{ success: boolean }> {
		return this.del<{ success: boolean }>(`${BASE_PATH}/${id}`);
	}

	async downloadPdf(id: string): Promise<Buffer> {
		return this.getRaw(`${BASE_PATH}/${id}/pdf`);
	}

	async downloadStatement(params: { from: string; to: string }): Promise<Buffer> {
		return this.getRaw(`${BASE_PATH}/statement`, params);
	}

	async exportCsv(params?: {
		from?: string;
		to?: string;
		status?: string;
	}): Promise<string> {
		return this.getText(
			`${BASE_PATH}/export`,
			params as Record<string, string | number | undefined>,
		);
	}
}
