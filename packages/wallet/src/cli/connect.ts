import { AgentaOS } from '@agentaos/pay';
import { getConfigDir } from '../lib/config.js';
import { type SessionResult, decodeJwt, ensureSession } from '../lib/ensure-session.js';

/** Who the session belongs to. Only the CLI knows this: a key is org-bound and nameless. */
export interface CliAccount {
	authenticated: true;
	email: string | null;
	server: string;
	configDir: string;
	orgId: string | null;
	organization: string | null;
	jwtExpiresAt?: string;
	jwtSecondsRemaining?: number;
}

export interface Connection {
	sdk: AgentaOS;
	account: CliAccount;
}

/** What a command needs to reach the API. Injected so tests can fake it. */
export interface CliContext {
	/** `business`: act for a business you manage (Connect, `--business`). */
	connect(opts?: { business?: string }): Promise<Connection>;
}

/**
 * The stored session, refreshed if needed, as an SDK client. The org it acts
 * for was resolved once at first use and lives with the session; the SDK
 * stamps it on every request.
 */
export async function connect(opts?: { business?: string }): Promise<Connection> {
	const session = await ensureSession();
	if (!session.ok) {
		throw new Error(
			session.reason === 'session-expired'
				? 'Session expired. Run agenta login.'
				: 'Not logged in. Run agenta login.',
		);
	}
	const sdk = new AgentaOS(session.token, {
		baseUrl: session.serverUrl,
		orgId: session.orgId,
		...(opts?.business ? { business: opts.business } : {}),
	});
	return { sdk, account: accountOf(session) };
}

function accountOf(session: Extract<SessionResult, { ok: true }>): CliAccount {
	const { token, serverUrl } = session;
	const payload = decodeJwt(token);
	const exp = typeof payload?.exp === 'number' ? payload.exp : null;
	return {
		authenticated: true,
		email: typeof payload?.email === 'string' ? payload.email : null,
		server: serverUrl,
		configDir: getConfigDir(),
		orgId: session.orgId ?? null,
		organization: session.orgName ?? null,
		...(exp
			? {
					jwtExpiresAt: new Date(exp * 1000).toISOString(),
					jwtSecondsRemaining: Math.max(0, Math.floor((exp * 1000 - Date.now()) / 1000)),
				}
			: {}),
	};
}
