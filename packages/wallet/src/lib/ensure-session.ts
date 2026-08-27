import { getRefreshToken, getSession, getSessionServerUrl, storeSession } from './session-store.js';

/** Decode JWT payload without verification (display + expiry check only). */
export function decodeJwt(token: string): Record<string, unknown> | null {
	try {
		const parts = token.split('.');
		if (parts.length !== 3) return null;
		return JSON.parse(Buffer.from(parts[1] as string, 'base64url').toString('utf-8'));
	} catch {
		return null;
	}
}

export type SessionResult =
	| { ok: true; token: string; serverUrl: string }
	| { ok: false; reason: 'not-logged-in' | 'session-expired' };

/**
 * Get a valid session token, auto-refreshing if expired.
 * Returns the session or a reason why it failed.
 */
export async function ensureSession(): Promise<SessionResult> {
	const token = await getSession();
	if (!token) return { ok: false, reason: 'not-logged-in' };

	const serverUrl =
		(await getSessionServerUrl()) || process.env.AGENTA_SERVER || 'https://api.agentaos.ai';
	const jwt = decodeJwt(token);
	const exp = typeof jwt?.exp === 'number' ? jwt.exp : undefined;

	// Still valid (with 30s buffer). Deliberately NOT keyed on `scope`: a token's
	// scope reflects what the ACCOUNT can do (crypto signing needs a passkey), not
	// whether the session is fresh, and a merchant who never sets a passkey stays
	// `setup` forever. Refreshing on it rotated the refresh token on EVERY command,
	// and two commands racing that rotation trip the server's reuse detection,
	// which revokes the whole family and logs the user out for good.
	if (exp && exp * 1000 > Date.now() + 30_000) {
		return { ok: true, token, serverUrl };
	}

	// Expired (or unreadable) — try refresh
	const refreshToken = await getRefreshToken();
	if (!refreshToken) return { ok: false, reason: 'session-expired' };

	try {
		const res = await fetch(`${serverUrl}/api/v1/auth/refresh`, {
			method: 'POST',
			// `x-client: cli` is REQUIRED, not decoration. Without it the server
			// treats us as a browser and returns the rotated tokens ONLY as httpOnly
			// cookies, which we cannot read — while still having spent the refresh
			// token server-side. That combination burns the session on every refresh
			// and then reports it expired.
			headers: { 'content-type': 'application/json', 'x-client': 'cli' },
			body: JSON.stringify({ refreshToken }),
			signal: AbortSignal.timeout(10_000),
		});

		if (!res.ok) return { ok: false, reason: 'session-expired' };

		const data = (await res.json()) as {
			token?: string;
			refreshToken?: string;
		};

		if (!data.token) return { ok: false, reason: 'session-expired' };

		await storeSession(data.token, serverUrl, data.refreshToken);
		return { ok: true, token: data.token, serverUrl };
	} catch {
		return { ok: false, reason: 'session-expired' };
	}
}
