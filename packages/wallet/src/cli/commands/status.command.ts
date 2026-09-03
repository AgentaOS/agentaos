import { Command } from 'commander';
import { getConfigDir } from '../../lib/config.js';
import { type SessionResult, decodeJwt, ensureSession } from '../../lib/ensure-session.js';
import { auditLabel, fetchGoLive, fetchOrg, nextStep, verifyLabel } from '../../lib/go-live.js';

/**
 * `agenta status` — who you are, and how far along going live you are.
 *
 * Built for AI tools: one JSON object on stdout, always. It used to lead with
 * wallet activation and sub-account listings, which meant a perfectly healthy
 * merchant-of-record account reported a red "Activate wallet first" forever,
 * because an MoR merchant never has a wallet. Those surfaces are gone.
 */
export const statusCommand = new Command('status')
	.alias('whoami')
	.description('Account and go-live overview')
	.action(async () => {
		try {
			const session = await ensureSession();
			console.log(JSON.stringify(await buildStatus(session)));
		} catch (error: unknown) {
			const message = error instanceof Error ? error.message : 'Unknown error';
			console.error(JSON.stringify({ error: message }));
			process.exitCode = 1;
		}
	});

async function buildStatus(session: SessionResult): Promise<Record<string, unknown>> {
	if (!session.ok) {
		return {
			account: {
				authenticated: false,
				reason: session.reason,
				next: 'agenta login',
			},
		};
	}

	const { token, serverUrl } = session;
	const payload = decodeJwt(token);
	const exp = typeof payload?.exp === 'number' ? payload.exp : null;

	const account: Record<string, unknown> = {
		authenticated: true,
		email: (payload?.email as string) ?? null,
		server: serverUrl,
		configDir: getConfigDir(),
		...(exp
			? {
					jwtExpiresAt: new Date(exp * 1000).toISOString(),
					jwtSecondsRemaining: Math.max(0, Math.floor((exp * 1000 - Date.now()) / 1000)),
				}
			: {}),
	};

	const org = await fetchOrg(serverUrl, token);
	if (!org) {
		account.serverReachable = false;
		return { account };
	}
	account.orgId = org.id;
	account.organization = org.name;

	// Test mode is usable the moment you are authenticated; only LIVE money waits
	// on verification and a payout account.
	account.paymentTools = { ready: true, mode: 'test', next: 'agenta pay checkout -a 50' };

	const readiness = await fetchGoLive(serverUrl, token, org.id);
	if (!readiness) return { account };

	return {
		account,
		goLive: {
			canGoLive: readiness.canGoLive,
			progress: readiness.progress,
			verification: {
				state: readiness.verifyState,
				label: verifyLabel(readiness),
				heldReason: readiness.heldReason,
				rejectReason: readiness.rejectReason,
				cooldownUntil: readiness.cooldownUntil,
				/** Non-empty means we are waiting on the merchant, not the reverse. */
				changesRequested: readiness.rfi?.items.map((i) => i.text) ?? [],
			},
			audit: {
				label: auditLabel(readiness),
				requested: !!readiness.audit,
				reportUrl: readiness.audit?.reportUrl ?? null,
				grade: readiness.audit?.grade ?? null,
			},
			payouts: { connected: readiness.hasPayoutAccount },
			milestones: readiness.milestones,
			next: nextStep(readiness),
		},
	};
}
