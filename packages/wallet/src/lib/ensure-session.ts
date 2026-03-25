import { getRefreshToken, getSession, getSessionServerUrl, storeSession } from './keychain.js';

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
	const needsUpgrade = jwt?.scope === 'setup'; // passkey was set up after token was issued

	// Still valid and full scope (with 30s buffer)
	if (exp && exp * 1000 > Date.now() + 30_000 && !needsUpgrade) {
		return { ok: true, token, serverUrl };
	}

	// Expired or needs scope upgrade — try refresh
	const refreshToken = await getRefreshToken();
	if (!refreshToken) return { ok: false, reason: 'session-expired' };

	try {
		const res = await fetch(`${serverUrl}/api/v1/auth/refresh`, {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
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
