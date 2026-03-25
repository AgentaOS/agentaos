import { request, requestRaw, requestText } from '../utils/fetch.js';

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
		},
	) {}

	protected async get<T>(
		path: string,
		query?: Record<string, string | number | undefined>,
	): Promise<T> {
		return request<T>({
			baseUrl: this.baseUrl,
			apiKey: this.apiKey,
			method: 'GET',
			path,
			query,
			timeout: this.options.timeout,
			maxRetries: this.options.maxRetries,
			debug: this.options.debug,
			logger: this.options.logger,
			authMode: this.options.authMode,
		});
	}

	protected async post<T>(path: string, body?: unknown, idempotencyKey?: string): Promise<T> {
		return request<T>({
			baseUrl: this.baseUrl,
			apiKey: this.apiKey,
			method: 'POST',
			path,
			body,
			timeout: this.options.timeout,
			maxRetries: this.options.maxRetries,
			idempotencyKey,
			debug: this.options.debug,
			logger: this.options.logger,
			authMode: this.options.authMode,
		});
	}

	protected async del<T>(path: string): Promise<T> {
		return request<T>({
			baseUrl: this.baseUrl,
			apiKey: this.apiKey,
			method: 'DELETE',
			path,
			timeout: this.options.timeout,
			maxRetries: this.options.maxRetries,
			debug: this.options.debug,
			logger: this.options.logger,
			authMode: this.options.authMode,
		});
	}

	protected async getRaw(
		path: string,
		query?: Record<string, string | number | undefined>,
	): Promise<Buffer> {
		return requestRaw({
			baseUrl: this.baseUrl,
			apiKey: this.apiKey,
			method: 'GET',
			path,
			query,
			timeout: this.options.timeout,
			maxRetries: this.options.maxRetries,
			debug: this.options.debug,
			logger: this.options.logger,
			authMode: this.options.authMode,
		});
	}

	protected async getText(
		path: string,
		query?: Record<string, string | number | undefined>,
	): Promise<string> {
		return requestText({
			baseUrl: this.baseUrl,
			apiKey: this.apiKey,
			method: 'GET',
			path,
			query,
			timeout: this.options.timeout,
			maxRetries: this.options.maxRetries,
			debug: this.options.debug,
			logger: this.options.logger,
			authMode: this.options.authMode,
		});
	}
}
