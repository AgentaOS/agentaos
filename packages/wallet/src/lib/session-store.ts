import {
	existsSync,
	mkdirSync,
	readFileSync,
	renameSync,
	unlinkSync,
	writeFileSync,
} from 'node:fs';
import { join } from 'node:path';
import { getConfigDir } from './config.js';

/**
 * The CLI session on disk: `~/.agenta/session.json`, mode 0600.
 *
 * This was `keychain.ts`, and most of it was the macOS `security` integration
 * that held agent sub-account signing shares behind Touch ID. That went with
 * the sub-account surface. Sessions never used the keychain — a short-lived JWT
 * does not need a biometric gate, and the prompt-per-read was pure friction —
 * so what is left is a plain file store, now named for what it does.
 *
 * Writes go through a temp file and `rename`, which is atomic on POSIX: a
 * crash mid-write can never leave a half-written session behind.
 */

interface StoredSession {
	token?: string;
	refreshToken?: string;
	serverUrl?: string;
	createdAt?: string;
	/** The org every request acts for; a session names a person, not an org. */
	orgId?: string;
	orgName?: string;
}

export interface StoredOrg {
	orgId: string;
	orgName: string | null;
}

function sessionFilePath(): string {
	return join(getConfigDir(), 'session.json');
}

function read(): StoredSession | null {
	const p = sessionFilePath();
	if (!existsSync(p)) return null;
	try {
		return JSON.parse(readFileSync(p, 'utf-8')) as StoredSession;
	} catch {
		return null;
	}
}

export async function storeSession(
	token: string,
	serverUrl?: string,
	refreshToken?: string,
): Promise<void> {
	const dir = getConfigDir();
	if (!existsSync(dir)) mkdirSync(dir, { recursive: true, mode: 0o700 });

	const payload: StoredSession = { token, createdAt: new Date().toISOString() };
	if (serverUrl) payload.serverUrl = serverUrl;
	if (refreshToken) payload.refreshToken = refreshToken;
	// A refresh rotates tokens, not the person: the org stays.
	const existing = read();
	if (existing?.orgId) payload.orgId = existing.orgId;
	if (existing?.orgName) payload.orgName = existing.orgName;
	write(payload);
}

function write(payload: StoredSession): void {
	const p = sessionFilePath();
	const tmp = `${p}.tmp`;
	writeFileSync(tmp, JSON.stringify(payload), { mode: 0o600 });
	renameSync(tmp, p);
}

export async function storeSessionOrg(org: StoredOrg): Promise<void> {
	const existing = read();
	if (!existing) return;
	write({ ...existing, orgId: org.orgId, orgName: org.orgName ?? undefined });
}

export async function getSessionOrg(): Promise<StoredOrg | null> {
	const stored = read();
	return stored?.orgId ? { orgId: stored.orgId, orgName: stored.orgName ?? null } : null;
}

export async function getSession(): Promise<string | null> {
	return read()?.token ?? null;
}

export async function getRefreshToken(): Promise<string | null> {
	return read()?.refreshToken ?? null;
}

/** The server this session was created against, so every later command talks to
 *  the same one without needing `--server` again. */
export async function getSessionServerUrl(): Promise<string | null> {
	return read()?.serverUrl ?? null;
}

export async function deleteSession(): Promise<boolean> {
	const p = sessionFilePath();
	if (!existsSync(p)) return false;
	unlinkSync(p);
	return true;
}
