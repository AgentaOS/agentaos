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
import { isJsonMode } from '../output.js';
import { brand, dim, failMark, successMark } from '../theme.js';

interface PublicCreateResponse {
	signerId: string;
	ethAddress: string;
	apiKey: string;
	signerShare: string;
	userShare: string;
}

// ---------------------------------------------------------------------------
// agenta sub init --create --name <name>
// agenta sub init --import --name <name> --api-key <key> --api-secret <secret>
// ---------------------------------------------------------------------------

export const initCommand = new Command('init')
	.description('Create or import a sub-account')
	.requiredOption('--name <name>', 'Sub-account name')
	.option('--create', 'Create a new sub-account')
	.option('--import', 'Import an existing sub-account')
	.option('--server <url>', 'Server URL')
	.option('--api-key <key>', 'API key (for --import)')
	.option('--api-secret <secret>', 'API secret base64 (for --import)')
	.option('--storage <type>', 'Recovery key storage: keychain or file', 'keychain')
	.action(
		async (opts: {
			name: string;
			create?: boolean;
			import?: boolean;
			server?: string;
			apiKey?: string;
			apiSecret?: string;
			storage?: string;
		}) => {
			try {
				// Validate name
				const nameErr = validateSignerName(opts.name);
				if (nameErr) throw new Error(nameErr);
				if (existsSync(getSignerConfigPath(opts.name)))
					throw new Error(`"${opts.name}" already exists.`);

				if (!opts.create && !opts.import) {
					throw new Error('Specify --create or --import. Run agenta sub init --help for usage.');
				}

				if (opts.storage && opts.storage !== 'keychain' && opts.storage !== 'file') {
					throw new Error(`Invalid --storage "${opts.storage}". Use "keychain" or "file".`);
				}
				const storage = (opts.storage ?? 'keychain') as 'keychain' | 'file';

				if (opts.create) {
					await handleCreate(opts.name, opts.server, storage);
				} else if (opts.import) {
					if (!opts.apiKey) throw new Error('--api-key is required for --import');
					if (!opts.apiSecret) throw new Error('--api-secret is required for --import');
					await handleImport(opts.name, opts.apiKey, opts.apiSecret, opts.server, storage);
				}
			} catch (error: unknown) {
				const message = error instanceof Error ? error.message : 'Unknown error';
				if (isJsonMode()) {
					console.error(JSON.stringify({ error: message }));
				} else {
					console.error(`\n  ${failMark(message)}\n`);
				}
				process.exitCode = 1;
			}
		},
	);

// ---------------------------------------------------------------------------
// Create
// ---------------------------------------------------------------------------

async function handleCreate(
	name: string,
	serverOverride?: string,
	storage: 'keychain' | 'file' = 'keychain',
): Promise<void> {
	const session = await ensureSession();
	if (!session.ok) throw new Error('Not logged in. Run agenta login first.');

	const serverUrl = serverOverride || session.serverUrl;

	const response = await fetch(`${serverUrl.replace(/\/+$/, '')}/api/v1/signers`, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.token}` },
		body: JSON.stringify({ name }),
		signal: AbortSignal.timeout(120_000),
	});

	if (!response.ok) {
		const text = await response.text();
		throw new Error(`Server returned ${response.status}: ${text}`);
	}

	const result = (await response.json()) as PublicCreateResponse;
	await storeUserShare(name, result.userShare, storage);

	const config: SignerConfig = {
		version: 1,
		serverUrl,
		apiKey: result.apiKey,
		apiSecret: result.signerShare,
		signerName: name,
		ethAddress: result.ethAddress,
		signerId: result.signerId,
		createdAt: new Date().toISOString(),
	};
	saveSignerConfig(name, config);
	setDefaultSigner(name);

	const out = {
		name,
		address: result.ethAddress || null,
		signerId: result.signerId || null,
		apiKey: result.apiKey || null,
		configPath: getSignerConfigPath(name),
	};
	if (isJsonMode()) {
		console.log(JSON.stringify(out));
	} else {
		console.log(`\n  ${successMark('Sub-account created')}`);
		console.log(`  ${chalk.bold('Name:')}    ${name}`);
		console.log(`  ${chalk.bold('Address:')} ${brand(result.ethAddress)}`);
		console.log(`  ${chalk.bold('ID:')}      ${dim(result.signerId)}`);
		console.log(`  ${chalk.bold('API Key:')} ${dim(result.apiKey)}`);
		console.log(`  ${chalk.bold('Config:')}  ${dim(getSignerConfigPath(name))}\n`);
	}
}

// ---------------------------------------------------------------------------
// Import
// ---------------------------------------------------------------------------

async function handleImport(
	name: string,
	apiKey: string,
	apiSecret: string,
	serverOverride?: string,
	storage: 'keychain' | 'file' = 'keychain',
): Promise<void> {
	const { getSessionServerUrl } = await import('../../lib/keychain.js');
	const serverUrl =
		serverOverride ||
		(await getSessionServerUrl()) ||
		process.env.AGENTA_SERVER ||
		'https://api.agentaos.ai';

	let signerId: string | undefined;
	let ethAddress = '';

	try {
		const { api } = createClientFromConfig({ serverUrl, apiKey });
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
		// Server unreachable — save config anyway
	}

	await storeUserShare(name, apiSecret, storage);

	const config: SignerConfig = {
		version: 1,
		serverUrl,
		apiKey,
		apiSecret,
		signerName: name,
		ethAddress,
		signerId,
		createdAt: new Date().toISOString(),
	};
	saveSignerConfig(name, config);
	setDefaultSigner(name);

	const out = {
		name,
		address: ethAddress || null,
		signerId: signerId || null,
		apiKey: apiKey || null,
		configPath: getSignerConfigPath(name),
	};
	if (isJsonMode()) {
		console.log(JSON.stringify(out));
	} else {
		console.log(`\n  ${successMark('Config saved')}`);
		console.log(`  ${chalk.bold('Name:')}    ${name}`);
		if (ethAddress) console.log(`  ${chalk.bold('Address:')} ${brand(ethAddress)}`);
		if (signerId) console.log(`  ${chalk.bold('ID:')}      ${dim(signerId)}`);
		console.log(`  ${chalk.bold('Config:')}  ${dim(getSignerConfigPath(name))}\n`);
	}
}
