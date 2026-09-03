import { homedir } from 'node:os';
import { join } from 'node:path';

/**
 * Where the CLI keeps its state.
 *
 * This file used to hold the agent sub-account config: per-signer JSON files,
 * a default-signer pointer, name validation and an SDK client factory. All of
 * it went with the sub-account surface, which is wallet-era legacy. Only the
 * config directory itself is still meaningful, because the session lives there.
 */
const CONFIG_DIR = join(homedir(), '.agenta');

export function getConfigDir(): string {
	return CONFIG_DIR;
}
