/**
 * Merchant onboarding state, read from the server.
 *
 * `GET /gateway/go-live` already returns a render-ready object: the server
 * decides what "ready" means and this module only prints it. Nothing here
 * recomputes readiness from parts, which is the whole reason that endpoint
 * exists.
 */

/** Mirrors `GoLiveVerifyState` (server: gateway/domain/mor-verification-readiness.ts). */
export type VerifyState = 'unverified' | 'in_review' | 'on_hold' | 'verified' | 'rejected';

/** One thing ops asked the merchant to change. Mirrors `RfiItem`. */
export interface RfiItem {
	id: string;
	text: string;
	at: string;
}

/** Mirrors `GoLiveReadiness` (server: gateway/go-live/go-live.service.ts). Only
 *  the fields the CLI actually prints are declared. */
export interface GoLiveReadiness {
	triedIt: boolean;
	verifyState: VerifyState;
	hasPayoutAccount: boolean;
	canGoLive: boolean;
	progress: { done: number; total: number };
	rejectReason: string | null;
	cooldownUntil: string | null;
	heldReason: string | null;
	/** Open change requests only. Non-null means the merchant owes us something. */
	rfi: { question: string; askedAt: string; items: RfiItem[] } | null;
	/** Null until they ask for one. `reportUrl` is null while it is being written. */
	audit: {
		requestedAt: string;
		publishedAt: string | null;
		reportUrl: string | null;
		grade: string | null;
	} | null;
	milestones: {
		firstProductAt: string | null;
		firstTestPaymentAt: string | null;
		firstLivePaymentAt: string | null;
		livePaymentCount: number;
	};
}

export interface Org {
	id: string;
	name: string | null;
	walletAddress: string | null;
}

const REQUEST_TIMEOUT_MS = 8_000;

function apiUrl(serverUrl: string, path: string): string {
	return `${serverUrl.replace(/\/+$/, '')}/api/v1${path}`;
}

async function getJson<T>(serverUrl: string, path: string, token: string): Promise<T | null> {
	try {
		const res = await fetch(apiUrl(serverUrl, path), {
			headers: { authorization: `Bearer ${token}` },
			signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
		});
		if (!res.ok) return null;
		return (await res.json()) as T;
	} catch {
		return null;
	}
}

export async function postJson<T>(
	serverUrl: string,
	path: string,
	token: string,
	body: unknown,
): Promise<{ ok: true; data: T } | { ok: false; status: number; message: string }> {
	try {
		const res = await fetch(apiUrl(serverUrl, path), {
			method: 'POST',
			headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
			body: JSON.stringify(body),
			signal: AbortSignal.timeout(30_000),
		});
		const text = await res.text();
		if (!res.ok) {
			// Nest validation errors arrive as { message: string | string[] }.
			let message = text || `Server returned ${res.status}`;
			try {
				const parsed = JSON.parse(text) as { message?: string | string[] };
				if (Array.isArray(parsed.message)) message = parsed.message.join('; ');
				else if (parsed.message) message = parsed.message;
			} catch {
				// Not JSON — the raw body is the best message we have.
			}
			return { ok: false, status: res.status, message };
		}
		return { ok: true, data: (text ? JSON.parse(text) : {}) as T };
	} catch (error: unknown) {
		return {
			ok: false,
			status: 0,
			message: error instanceof Error ? error.message : 'Request failed',
		};
	}
}

/** The caller's first org. Every merchant command needs its id, because the
 *  server resolves the org from `?orgId=` on a session token. */
export async function fetchOrg(serverUrl: string, token: string): Promise<Org | null> {
	const orgs = await getJson<Array<{ id?: string; name?: string; wallet_address?: string }>>(
		serverUrl,
		'/orgs',
		token,
	);
	const first = orgs?.[0];
	if (!first?.id) return null;
	return {
		id: first.id,
		name: first.name ?? null,
		walletAddress: first.wallet_address ?? null,
	};
}

export async function fetchGoLive(
	serverUrl: string,
	token: string,
	orgId: string,
): Promise<GoLiveReadiness | null> {
	return getJson<GoLiveReadiness>(
		serverUrl,
		`/gateway/go-live?orgId=${encodeURIComponent(orgId)}`,
		token,
	);
}

/** One line for the verification row. Plain words, because a merchant reading a
 *  terminal has no chip colour to read it with. */
export function verifyLabel(r: GoLiveReadiness): string {
	if (r.rfi) return 'Changes requested';
	switch (r.verifyState) {
		case 'verified':
			return 'Verified';
		case 'in_review':
			return 'In review';
		case 'on_hold':
			return 'On hold';
		case 'rejected':
			return 'Rejected';
		default:
			return 'Not submitted';
	}
}

export function auditLabel(r: GoLiveReadiness): string {
	if (!r.audit) return 'Not requested';
	if (!r.audit.reportUrl) return 'Being written';
	return r.audit.grade ? `Ready (graded ${r.audit.grade})` : 'Ready';
}

/**
 * The single most useful next command, or null when there is nothing to chase.
 *
 * Ordered the way the journey actually blocks: a change request is the
 * merchant's move and outranks everything, then verification, then payouts.
 * States we cannot act on from a terminal (in review, on hold, rejected)
 * deliberately return null rather than inventing busywork.
 */
export function nextStep(r: GoLiveReadiness): { command: string; why: string } | null {
	if (r.rfi) {
		return { command: 'agenta verify changes', why: 'we asked you to change something' };
	}
	if (r.verifyState === 'unverified') {
		// The audit is offered FIRST only to someone who has not started verifying:
		// it is a gift, not a gate, so it must never stand between a verified
		// merchant and getting paid.
		return r.audit
			? { command: 'agenta verify submit', why: 'verify your business to accept live payments' }
			: { command: 'agenta audit request', why: 'start with the free audit' };
	}
	if (r.verifyState === 'verified' && !r.hasPayoutAccount) {
		return { command: 'agenta payouts add', why: 'add a payout account to get paid' };
	}
	return null;
}
