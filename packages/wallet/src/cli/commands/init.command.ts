import { existsSync } from 'node:fs';
import chalk from 'chalk';
import { Command } from 'commander';
import {
	type SignerConfig,
	createClientFromConfig,
	getSignerConfigPath,
	saveSignerConfig,
	setDefaultSigner,
	validateSignerName,
} from '../../lib/config.js';
import { ensureSession } from '../../lib/ensure-session.js';
import { storeUserShare } from '../../lib/keychain.js';
import { isJsonMode, outputError } from '../output.js';
import { brand, dim, failMark, successMark } from '../theme.js';

interface PublicCreateResponse {
	signerId: string;
	ethAddress: string;
	apiKey: string;
	signerShare: string;
	userShare: string;
}

function validateName(name: string): void {
	const err = validateSignerName(name);
	if (err) throw new Error(err);
	if (existsSync(getSignerConfigPath(name))) throw new Error(`"${name}" already exists.`);
}

function validateStorage(storage?: string): 'keychain' | 'file' {
	if (storage && storage !== 'keychain' && storage !== 'file') {
		throw new Error(`Invalid --storage "${storage}". Use "keychain" or "file".`);
	}
	return (storage ?? 'keychain') as 'keychain' | 'file';
}

// ---------------------------------------------------------------------------
// agenta sub create --name <name>
// ---------------------------------------------------------------------------

export const createCommand = new Command('create')
	.description('Create a new sub-account')
	.requiredOption('--name <name>', 'Sub-account name')
	.option('--server <url>', 'Server URL')
	.option('--storage <type>', 'Recovery key storage: keychain or file', 'keychain')
	.option('--json', 'Output as JSON')
	.action(async (opts: { name: string; server?: string; storage?: string }) => {
		try {
			validateName(opts.name);
			const storage = validateStorage(opts.storage);

			const session = await ensureSession();
			if (!session.ok) throw new Error('Not logged in. Run agenta login first.');

			const serverUrl = opts.server || session.serverUrl;

			const response = await fetch(`${serverUrl.replace(/\/+$/, '')}/api/v1/signers`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.token}` },
				body: JSON.stringify({ name: opts.name }),
				signal: AbortSignal.timeout(120_000),
			});

			if (!response.ok) {
				const text = await response.text();
				throw new Error(`Server returned ${response.status}: ${text}`);
			}

			const result = (await response.json()) as PublicCreateResponse;
			await storeUserShare(opts.name, result.userShare, storage);

			const config: SignerConfig = {
				version: 1,
				serverUrl,
				apiKey: result.apiKey,
				apiSecret: result.signerShare,
				signerName: opts.name,
				ethAddress: result.ethAddress,
				signerId: result.signerId,
				createdAt: new Date().toISOString(),
			};
			saveSignerConfig(opts.name, config);
			setDefaultSigner(opts.name);

			const out = {
				name: opts.name,
				address: result.ethAddress || null,
				signerId: result.signerId || null,
				apiKey: result.apiKey || null,
				configPath: getSignerConfigPath(opts.name),
			};
			if (isJsonMode()) {
				console.log(JSON.stringify(out));
			} else {
				console.log(`\n  ${successMark('Sub-account created')}`);
				console.log(`  ${chalk.bold('Name:')}    ${opts.name}`);
				console.log(`  ${chalk.bold('Address:')} ${brand(result.ethAddress)}`);
				console.log(`  ${chalk.bold('ID:')}      ${dim(result.signerId)}`);
				console.log(`  ${chalk.bold('API Key:')} ${dim(result.apiKey)}`);
				console.log(`  ${chalk.bold('Config:')}  ${dim(getSignerConfigPath(opts.name))}\n`);
			}
		} catch (error: unknown) {
			const msg = error instanceof Error ? error.message : 'Unknown error';
			if (isJsonMode()) {
				console.error(JSON.stringify({ error: msg }));
			} else {
				console.error(`\n  ${failMark(msg)}\n`);
			}
			process.exitCode = 1;
		}
	});

// ---------------------------------------------------------------------------
// agenta sub import --name <name> --api-key <key> --api-secret <secret>
// ---------------------------------------------------------------------------

export const importCommand = new Command('import')
	.description('Import an existing sub-account')
	.requiredOption('--name <name>', 'Sub-account name')
	.requiredOption('--api-key <key>', 'API key')
	.requiredOption('--api-secret <secret>', 'API secret base64')
	.option('--server <url>', 'Server URL')
	.option('--storage <type>', 'Recovery key storage: keychain or file', 'keychain')
	.option('--json', 'Output as JSON')
	.action(
		async (opts: {
			name: string;
			apiKey: string;
			apiSecret: string;
			server?: string;
			storage?: string;
		}) => {
			try {
				validateName(opts.name);
				const storage = validateStorage(opts.storage);

				const { getSessionServerUrl } = await import('../../lib/keychain.js');
				const serverUrl =
					opts.server ||
					(await getSessionServerUrl()) ||
					process.env.AGENTA_SERVER ||
					'https://api.agentaos.ai';

				let signerId: string | undefined;
				let ethAddress = '';

				try {
					const { api } = createClientFromConfig({ serverUrl, apiKey: opts.apiKey });
					const signers = await api.listSigners();
					const [s] = signers;
					if (s) {
						signerId = s.id;
						ethAddress = s.ethAddress;
					}
				} catch (err: unknown) {
					const msg = err instanceof Error ? err.message : '';
					if (
						msg.includes('401') ||
						msg.includes('403') ||
						msg.includes('nauthorized') ||
						msg.includes('orbidden')
					) {
						throw new Error('Invalid API key or secret');
					}
				}

				await storeUserShare(opts.name, opts.apiSecret, storage);

				const config: SignerConfig = {
					version: 1,
					serverUrl,
					apiKey: opts.apiKey,
					apiSecret: opts.apiSecret,
					signerName: opts.name,
					ethAddress,
					signerId,
					createdAt: new Date().toISOString(),
				};
				saveSignerConfig(opts.name, config);
				setDefaultSigner(opts.name);

				const out = {
					name: opts.name,
					address: ethAddress || null,
					signerId: signerId || null,
					apiKey: opts.apiKey,
					configPath: getSignerConfigPath(opts.name),
				};
				if (isJsonMode()) {
					console.log(JSON.stringify(out));
				} else {
					console.log(`\n  ${successMark('Config saved')}`);
					console.log(`  ${chalk.bold('Name:')}    ${opts.name}`);
					if (ethAddress) console.log(`  ${chalk.bold('Address:')} ${brand(ethAddress)}`);
					if (signerId) console.log(`  ${chalk.bold('ID:')}      ${dim(signerId)}`);
					console.log(`  ${chalk.bold('Config:')}  ${dim(getSignerConfigPath(opts.name))}\n`);
				}
			} catch (error: unknown) {
				const msg = error instanceof Error ? error.message : 'Unknown error';
				if (isJsonMode()) {
					console.error(JSON.stringify({ error: msg }));
				} else {
					console.error(`\n  ${failMark(msg)}\n`);
				}
				process.exitCode = 1;
			}
		},
	);
