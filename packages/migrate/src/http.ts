const REQUEST_TIMEOUT_MS = 30_000;

/** A read-only GET against the old provider. Retries rate limits and server errors. */
export async function getJson<T>(
	url: string,
	headers: Record<string, string>,
	attempts = 4,
): Promise<T> {
	for (let attempt = 1; ; attempt++) {
		const res = await fetch(url, {
			method: 'GET',
			signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
			headers: { Accept: 'application/json', ...headers },
		});
		if (res.ok) return (await res.json()) as T;

		const retryable = res.status === 429 || res.status >= 500;
		if (!retryable || attempt >= attempts) {
			const body = await res.text().catch(() => '');
			throw new Error(`GET ${redact(url)} failed: ${res.status} ${body.slice(0, 200)}`);
		}
		await sleep(retryDelayMs(res, attempt));
	}
}

function retryDelayMs(res: Response, attempt: number): number {
	const retryAfter = Number(res.headers.get('retry-after'));
	return Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter * 1000 : 500 * 2 ** attempt;
}

function sleep(ms: number): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Keeps tokens passed in the query string (Gumroad) out of error messages. */
export function redact(url: string): string {
	return url.replace(/(access_token=)[^&]+/, '$1***');
}
