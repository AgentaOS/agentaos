import type { RequestOptions } from '../types.js';
import { request, requestRaw, requestText } from '../utils/fetch.js';

type Query = Record<string, string | number | undefined>;

export class BaseResource {
	constructor(
		protected readonly baseUrl: string,
		protected readonly apiKey: string,
		protected readonly options: {
			timeout: number;
			maxRetries: number;
			debug?: boolean;
			logger?: (level: string, message: string) => void;
			authMode?: 'api-key' | 'jwt';
			/** Session users may belong to several orgs; this one goes on every request. */
			orgId?: string;
			/** The managed business every request of this client acts for (`AgentaOS-Account`). */
			business?: string;
		},
	) {}

	protected async getJson<T>(path: string, query?: Query, req?: RequestOptions): Promise<T> {
		return request<T>({
			...this.transport(req),
			method: 'GET',
			path,
			query: this.scoped(query),
		});
	}

	protected async postJson<T>(path: string, body?: unknown, req?: RequestOptions): Promise<T> {
		return request<T>({
			...this.transport(req),
			method: 'POST',
			path,
			query: this.scoped(),
			body,
		});
	}

	protected async del<T>(path: string, req?: RequestOptions): Promise<T> {
		return request<T>({
			...this.transport(req),
			method: 'DELETE',
			path,
			query: this.scoped(),
		});
	}

	protected async getRaw(path: string, query?: Query, req?: RequestOptions): Promise<Buffer> {
		return requestRaw({
			...this.transport(req),
			method: 'GET',
			path,
			query: this.scoped(query),
		});
	}

	protected async getText(path: string, query?: Query, req?: RequestOptions): Promise<string> {
		return requestText({
			...this.transport(req),
			method: 'GET',
			path,
			query: this.scoped(query),
		});
	}

	private transport(req?: RequestOptions) {
		return {
			baseUrl: this.baseUrl,
			apiKey: this.apiKey,
			timeout: this.options.timeout,
			maxRetries: this.options.maxRetries,
			debug: this.options.debug,
			logger: this.options.logger,
			authMode: this.options.authMode,
			// Per call (Stripe's per-request `stripeAccount`) wins over the client's.
			business: req?.business ?? this.options.business,
		};
	}

	/** The query with `orgId` added when the client was given one. */
	private scoped(query?: Query): Query | undefined {
		if (!this.options.orgId) return query;
		return { ...query, orgId: this.options.orgId };
	}
}
