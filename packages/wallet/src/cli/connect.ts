import { AgentaOS } from '@agentaos/pay';
import { getConfigDir } from '../lib/config.js';
import { decodeJwt, ensureSession } from '../lib/ensure-session.js';
import { fetchOrg } from '../lib/org.js';

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
	connect(): Promise<Connection>;
}

/**
 * The stored session, refreshed if needed, as an SDK client. A session names
 * a person, who may belong to several orgs; the first one is the one every
 * request acts for, the same way the dashboard picks it.
 */
export async function connect(): Promise<Connection> {
	const session = await ensureSession();
	if (!session.ok) {
		throw new Error(
			session.reason === 'session-expired'
				? 'Session expired. Run agenta login.'
				: 'Not logged in. Run agenta login.',
		);
	}

	const { token, serverUrl } = session;
	const org = await fetchOrg(serverUrl, token);
	const sdk = new AgentaOS(token, { baseUrl: serverUrl, orgId: org?.id });
	return { sdk, account: accountOf(token, serverUrl, org) };
}

function accountOf(
	token: string,
	serverUrl: string,
	org: { id: string; name: string | null } | null,
): CliAccount {
	const payload = decodeJwt(token);
	const exp = typeof payload?.exp === 'number' ? payload.exp : null;
	return {
		authenticated: true,
		email: typeof payload?.email === 'string' ? payload.email : null,
		server: serverUrl,
		configDir: getConfigDir(),
		orgId: org?.id ?? null,
		organization: org?.name ?? null,
		...(exp
			? {
					jwtExpiresAt: new Date(exp * 1000).toISOString(),
					jwtSecondsRemaining: Math.max(0, Math.floor((exp * 1000 - Date.now()) / 1000)),
				}
			: {}),
	};
}
