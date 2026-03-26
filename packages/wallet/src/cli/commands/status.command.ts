import chalk from 'chalk';
import { Command } from 'commander';
import ora from 'ora';
import { formatUnits } from 'viem';
import {
	type SignerConfig,
	createClientFromConfig,
	getConfigDir,
	getDefaultSignerName,
	listSigners,
	loadSignerConfig,
} from '../../lib/config.js';
import { decodeJwt, ensureSession } from '../../lib/ensure-session.js';
import { isJsonMode } from '../output.js';
import { brand, brandBold, brandDot, dim, failMark, statusColor, successMark } from '../theme.js';

// ---------------------------------------------------------------------------
// JWT decode (display only, no verification)
// ---------------------------------------------------------------------------

const decodeJwtPayload = decodeJwt;

function formatExpiry(exp: number): string {
	const remaining = exp * 1000 - Date.now();
	if (remaining <= 0) return chalk.red('Expired');
	const hours = Math.floor(remaining / 3_600_000);
	const mins = Math.floor((remaining % 3_600_000) / 60_000);
	const timeStr = new Date(exp * 1000)
		.toISOString()
		.replace('T', ' ')
		.replace(/\.\d+Z$/, ' UTC');
	return `${timeStr} (${hours}h ${mins}m remaining)`;
}

// ---------------------------------------------------------------------------
// Wallet helpers (existing)
// ---------------------------------------------------------------------------

// biome-ignore lint/suspicious/noControlCharactersInRegex: ANSI escape stripping is intentional
const ANSI_RE = /\u001B\[[0-9;]*m/g;

function pad(str: string, width: number): string {
	const visible = str.replace(ANSI_RE, '');
	return str + ' '.repeat(Math.max(0, width - visible.length));
}

function fmtAddr(address: string): string {
	if (!address || address.length < 10) return dim('—');
	return dim(`${address.slice(0, 6)}…${address.slice(-4)}`);
}

interface WalletInfo {
	name: string;
	address: string;
	status: string;
	balance: string | undefined;
	policies: number | undefined;
	isDefault: boolean;
}

async function fetchWalletInfo(name: string, config: SignerConfig): Promise<WalletInfo> {
	const info: WalletInfo = {
		name,
		address: config.ethAddress || '',
		status: 'unknown',
		balance: undefined,
		policies: undefined,
		isDefault: false,
	};
	try {
		const { api } = createClientFromConfig(config);
		const signers = await api.listSigners();
		const [s] = signers;
		if (s) {
			info.status = s.status;
			info.balance = s.balance;
			info.policies = s.policyCount;
			if (s.ethAddress) info.address = s.ethAddress;
		}
	} catch {
		info.status = 'offline';
	}
	return info;
}

// ---------------------------------------------------------------------------
// Command
// ---------------------------------------------------------------------------

export const statusCommand = new Command('status')
	.alias('whoami')
	.description('Show account and connection status')
	.option('--json', 'Output as JSON')
	.action(async () => {
		try {
			const session = await ensureSession();

			// --- JSON mode ---
			if (isJsonMode()) {
				await outputStatusJson(session);
				return;
			}

			// --- Human mode ---
			console.log('');
			console.log(`  ${chalk.bold('AgentaOS')} ${dim('CLI')}`);
			console.log(`  ${dim('─'.repeat(35))}`);

			// --- Account info from JWT ---
			if (!session.ok) {
				if (session.reason === 'session-expired') {
					console.log(`  ${dim('Account:')}      ${chalk.red('Session expired')}`);
					console.log(
						`  ${dim('            ')}  Run ${chalk.bold('agenta login')} to re-authenticate.`,
					);
				} else {
					console.log(`  ${dim('Account:')}      ${chalk.yellow('Not logged in')}`);
					console.log(
						`  ${dim('            ')}  Run ${chalk.bold('agenta login')} to get started.`,
					);
				}
			}

			const token = session.ok ? session.token : null;
			const serverUrl = session.ok ? session.serverUrl : null;
			const payload = token ? decodeJwtPayload(token) : null;
			const email = payload?.email as string | undefined;
			const exp = payload?.exp as number | undefined;

			if (email) console.log(`  ${dim('Account:')}      ${email}`);

			// --- Fetch org info from server ---
			let orgName: string | undefined;
			let walletAddress: string | null = null;
			if (token && serverUrl) {
				try {
					const orgsRes = await fetch(`${serverUrl}/api/v1/orgs`, {
						headers: { authorization: `Bearer ${token}` },
						signal: AbortSignal.timeout(5_000),
					});
					if (orgsRes.ok) {
						const orgs = (await orgsRes.json()) as Array<{
							name?: string;
							wallet_address?: string;
						}>;
						if (orgs[0]) {
							orgName = orgs[0].name;
							walletAddress = orgs[0].wallet_address ?? null;
						}
					}
				} catch {
					// Offline — show what we can from JWT
				}
			}

			if (orgName) console.log(`  ${dim('Organization:')} ${orgName}`);
			if (walletAddress) {
				const short = `${walletAddress.slice(0, 6)}...${walletAddress.slice(-4)}`;
				console.log(`  ${dim('Wallet:')}       ${short}`);
			} else if (orgName) {
				console.log(`  ${dim('Wallet:')}       ${chalk.yellow('Not activated')}`);
			}
			if (exp) console.log(`  ${dim('JWT expires:')}  ${formatExpiry(exp)}`);
			if (serverUrl) console.log(`  ${dim('Server:')}       ${serverUrl}`);
			console.log(`  ${dim('Config:')}       ${getConfigDir()}`);

			// --- Tool readiness ---
			console.log('');
			if (walletAddress) {
				console.log(`  ${dim('Payment tools:')}  ${successMark('Ready')}`);
			} else {
				console.log(
					`  ${dim('Payment tools:')}  ${failMark('Activate wallet first')} → ${dim('agenta login')}`,
				);
			}

			const signerNames = listSigners();
			if (signerNames.length > 0) {
				console.log(
					`  ${dim('Agent accounts:')} ${successMark(`Ready (${signerNames.length} sub-account${signerNames.length > 1 ? 's' : ''})`)}`,
				);
			} else {
				console.log(
					`  ${dim('Agent accounts:')} ${dim('Run')} ${chalk.bold('agenta sub create')} ${dim('to create a sub-account')}`,
				);
			}

			// --- Next steps ---
			console.log('');
			if (!walletAddress) {
				console.log(
					`  ${dim('Next:')} ${chalk.bold('agenta login')} ${dim('to activate your wallet')}`,
				);
			} else if (signerNames.length === 0) {
				console.log(
					`  ${dim('Next:')} ${chalk.bold('agenta pay checkout -a 50')} ${dim('to create a checkout')}`,
				);
				console.log(
					`        ${chalk.bold('agenta sub create')} ${dim('to create an agent sub-account')}`,
				);
			} else {
				console.log(
					`  ${dim('Next:')} ${chalk.bold('agenta pay checkout -a 50')} ${dim('to create a checkout')}`,
				);
				console.log(`        ${chalk.bold('agenta pay list')} ${dim('to view your checkouts')}`);
			}

			// --- Signer wallets (if any) ---
			if (signerNames.length > 0) {
				const defaultName = getDefaultSignerName();
				const spinner = ora({
					text: `Checking ${signerNames.length} sub-account${signerNames.length > 1 ? 's' : ''}…`,
					indent: 2,
				}).start();

				const wallets = await Promise.all(
					signerNames.map(async (name) => {
						try {
							const config = loadSignerConfig(name);
							const info = await fetchWalletInfo(name, config);
							info.isDefault = name === defaultName;
							return info;
						} catch {
							return {
								name,
								address: '',
								status: 'error',
								balance: undefined,
								policies: undefined,
								isDefault: name === defaultName,
							};
						}
					}),
				);

				spinner.stop();
				console.log('');
				console.log(`  ${dim('Sub-accounts:')}`);

				const nw = Math.max(4, ...wallets.map((w) => w.name.length)) + 3;
				for (const w of wallets) {
					const dot = brandDot(w.isDefault);
					const name = w.isDefault ? brandBold(w.name) : w.name;
					const addr = fmtAddr(w.address);
					const status = statusColor(w.status);
					console.log(`    ${dot} ${pad(name, nw)} ${pad(addr, 15)} ${status}`);
				}
			}

			console.log('');
		} catch (error: unknown) {
			const message = error instanceof Error ? error.message : 'Unknown error';
			if (isJsonMode()) {
				console.error(JSON.stringify({ error: message }));
			} else {
				console.error(`\n  ${failMark(message)}\n`);
			}
			process.exitCode = 1;
		}
	});

// ---------------------------------------------------------------------------
// JSON output for AI/scripts
// ---------------------------------------------------------------------------

import type { SessionResult } from '../../lib/ensure-session.js';

async function outputStatusJson(session: SessionResult): Promise<void> {
	const result: Record<string, unknown> = {};

	if (!session.ok) {
		result.account = {
			authenticated: false,
			reason: session.reason,
			hint:
				session.reason === 'session-expired'
					? 'Run agenta login to re-authenticate.'
					: 'Run agenta login to get started.',
		};
	} else {
		const { token, serverUrl } = session;
		const payload = decodeJwt(token);
		const exp = typeof payload?.exp === 'number' ? payload.exp : null;

		const account: Record<string, unknown> = {
			authenticated: true,
			email: (payload?.email as string) ?? null,
			server: serverUrl,
			configDir: getConfigDir(),
		};
		if (exp) {
			account.jwtExpiresAt = new Date(exp * 1000).toISOString();
			account.jwtSecondsRemaining = Math.max(0, Math.floor((exp * 1000 - Date.now()) / 1000));
		}

		try {
			const orgsRes = await fetch(`${serverUrl}/api/v1/orgs`, {
				headers: { authorization: `Bearer ${token}` },
				signal: AbortSignal.timeout(5_000),
			});
			if (orgsRes.ok) {
				const orgs = (await orgsRes.json()) as Array<{ name?: string; wallet_address?: string }>;
				if (orgs[0]) {
					account.organization = orgs[0].name ?? null;
					account.walletAddress = orgs[0].wallet_address ?? null;
					account.walletActivated = !!orgs[0].wallet_address;
				}
			}
		} catch {
			account.serverReachable = false;
		}

		const walletReady = !!account.walletAddress;
		account.paymentTools = {
			ready: walletReady,
			hint: walletReady
				? 'Run agenta pay checkout -a 50 to create a checkout.'
				: 'Activate wallet first via agenta login.',
		};
		result.account = account;
	}

	const signerNames = listSigners();
	result.subAccounts = {
		count: signerNames.length,
		hint:
			signerNames.length === 0
				? 'Run agenta sub create --name <name> to create a sub-account.'
				: `${signerNames.length} sub-account(s). Run agenta sub info <name> for details.`,
		items: signerNames.map((name) => {
			try {
				const c = loadSignerConfig(name);
				return { name, address: c.ethAddress || null, isDefault: name === getDefaultSignerName() };
			} catch {
				return { name, address: null, isDefault: false };
			}
		}),
	};

	console.log(JSON.stringify(result));
}
