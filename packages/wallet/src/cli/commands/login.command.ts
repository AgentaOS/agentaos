import { execFile } from 'node:child_process';
import chalk from 'chalk';
import { Command } from 'commander';
import ora from 'ora';
import { getConfigDir } from '../../lib/config.js';
import {
	deleteSession,
	getRefreshToken,
	getSession,
	getSessionServerUrl,
	storeSession,
} from '../../lib/keychain.js';
import { dim, failMark, section, successMark } from '../theme.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function postJson<T>(url: string, body: unknown): Promise<T> {
	const response = await fetch(url, {
		method: 'POST',
		headers: { 'content-type': 'application/json' },
		body: JSON.stringify(body),
		signal: AbortSignal.timeout(15_000),
	});

	if (!response.ok) {
		const text = await response.text();
		try {
			const json = JSON.parse(text) as { message?: string };
			if (json.message) throw new Error(json.message);
		} catch (e) {
			if (e instanceof Error && e.message !== text) throw e;
		}
		throw new Error(`Server error (${response.status})`);
	}

	return response.json() as Promise<T>;
}

/** Open a URL in the default browser (best-effort, no dependency). */
function openBrowser(url: string): void {
	const cmd =
		process.platform === 'darwin' ? 'open' : process.platform === 'win32' ? 'start' : 'xdg-open';
	execFile(cmd, [url], () => {});
}

// ---------------------------------------------------------------------------
// agenta login — device-code flow (browser-based, human-interactive)
// ---------------------------------------------------------------------------

export const loginCommand = new Command('login')
	.description('Log in via browser')
	.option('--server <url>', 'Server URL', process.env.AGENTA_SERVER ?? 'https://api.agentaos.ai')
	.action(async (opts: { server: string }) => {
		try {
			const existing = await getSession();
			if (existing) {
				console.log(
					`\n  ${dim('Already logged in. Run')} ${chalk.bold('agenta logout')} ${dim('to switch accounts.')}\n`,
				);
				return;
			}

			const baseUrl = opts.server.replace(/\/+$/, '');

			section('Login');

			const { deviceCode, userCode, verificationUrl, interval } = await postJson<{
				deviceCode: string;
				userCode: string;
				verificationUrl: string;
				interval: number;
			}>(`${baseUrl}/api/v1/auth/device-code`, {});

			console.log('');
			console.log('  Open this URL in your browser:');
			console.log(`  ${chalk.bold.underline(verificationUrl)}`);
			console.log('');
			console.log(`  Verification code: ${chalk.bold(userCode)}`);
			console.log('');

			openBrowser(verificationUrl);

			const spinner = ora({ text: 'Waiting for browser confirmation…', indent: 2 }).start();
			const deadline = Date.now() + 10 * 60 * 1000;

			while (Date.now() < deadline) {
				await new Promise((r) => setTimeout(r, interval * 1000));

				const result = await postJson<{
					status: 'pending' | 'completed' | 'expired' | 'denied';
					token?: string;
					refreshToken?: string;
					email?: string;
					orgName?: string;
					walletAddress?: string;
				}>(`${baseUrl}/api/v1/auth/device-code/poll`, { deviceCode });

				if (result.status === 'completed' && result.token) {
					await storeSession(result.token, baseUrl, result.refreshToken);

					if (result.refreshToken) {
						try {
							const refreshRes = await postJson<{ token?: string; refreshToken?: string }>(
								`${baseUrl}/api/v1/auth/refresh`,
								{ refreshToken: result.refreshToken },
							);
							if (refreshRes.token) {
								await storeSession(refreshRes.token, baseUrl, refreshRes.refreshToken);
							}
						} catch {
							/* best-effort */
						}
					}

					spinner.succeed('Logged in');
					console.log('');
					console.log(`  ${successMark(`Authenticated as ${chalk.bold(result.email ?? 'user')}`)}`);
					if (result.orgName) console.log(`  ${dim('Organization:')} ${result.orgName}`);
					if (result.walletAddress) {
						const short = `${result.walletAddress.slice(0, 6)}...${result.walletAddress.slice(-4)}`;
						console.log(`  ${dim('Wallet:')} ${short}`);
					}
					console.log(`  ${dim(`Session stored in ${getConfigDir()}`)}`);
					console.log('');
					console.log(`  ${dim('Next:')} ${chalk.bold('agenta status')}`);
					console.log('');
					return;
				}

				if (result.status === 'expired') {
					spinner.fail('Login expired. Run agenta login again.');
					return;
				}

				if (result.status === 'denied') {
					spinner.fail('Login denied.');
					return;
				}
			}

			spinner.fail('Login timed out.');
		} catch (error: unknown) {
			if (error instanceof Error && error.name === 'ExitPromptError') {
				console.log(dim('\n  Cancelled.\n'));
				return;
			}
			const message = error instanceof Error ? error.message : 'Unknown error';
			console.error(`\n  ${failMark(message)}\n`);
			process.exitCode = 1;
		}
	});

// ---------------------------------------------------------------------------
// agenta logout
// ---------------------------------------------------------------------------

export const logoutCommand = new Command('logout')
	.description('Log out (clear session)')
	.action(async () => {
		try {
			const token = await getSession();
			const refreshToken = await getRefreshToken();
			const serverUrl = await getSessionServerUrl();
			if (serverUrl && (token || refreshToken)) {
				try {
					await fetch(`${serverUrl}/api/v1/auth/logout`, {
						method: 'POST',
						headers: {
							'Content-Type': 'application/json',
							...(token ? { authorization: `Bearer ${token}` } : {}),
						},
						body: JSON.stringify({ refreshToken: refreshToken ?? undefined }),
						signal: AbortSignal.timeout(5_000),
					});
				} catch {
					// Best-effort
				}
			}

			const deleted = await deleteSession();
			if (deleted) {
				console.log(`\n  ${successMark('Logged out')}\n`);
			} else {
				console.log(`\n  ${dim('No active session found.')}\n`);
			}
		} catch (error: unknown) {
			const message = error instanceof Error ? error.message : 'Unknown error';
			console.error(`\n  ${failMark(message)}\n`);
			process.exitCode = 1;
		}
	});
