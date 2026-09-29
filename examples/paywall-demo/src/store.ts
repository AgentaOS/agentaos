// The demo's "database": one JSON file. Replace it with your own tables.
import { existsSync, readFileSync, writeFileSync } from 'node:fs';

export interface User {
	id: string;
	name: string;
	email: string;
	/** The checkout this user opened last, so a second click reuses it. */
	pendingSessionId: string | null;
	/** From `metadata.subscriptionId`. Renewals are matched to the user by this ID. */
	subscriptionId: string | null;
	/** Last status a webhook reported. The access check reads the API instead. */
	subscriptionStatus: string | null;
}

interface Data {
	users: User[];
	/** Every checkout already handled. A payment is granted once, whoever reports it first. */
	processedSessionIds: string[];
}

const FILE = 'data.json';

const SEED: Data = {
	users: [
		{ id: 'user_ada', name: 'Ada', email: 'ada@example.com' },
		{ id: 'user_grace', name: 'Grace', email: 'grace@example.com' },
	].map((u) => ({ ...u, pendingSessionId: null, subscriptionId: null, subscriptionStatus: null })),
	processedSessionIds: [],
};

function load(): Data {
	if (!existsSync(FILE)) return structuredClone(SEED);
	return JSON.parse(readFileSync(FILE, 'utf8')) as Data;
}

function save(data: Data): void {
	writeFileSync(FILE, JSON.stringify(data, null, 2));
}

export function listUsers(): User[] {
	return load().users;
}

export function findUser(id: string | undefined): User | null {
	return load().users.find((u) => u.id === id) ?? null;
}

export function findUserBySubscription(subscriptionId: string): User | null {
	return load().users.find((u) => u.subscriptionId === subscriptionId) ?? null;
}

export function updateUser(id: string, patch: Partial<User>): void {
	const data = load();
	const user = data.users.find((u) => u.id === id);
	if (!user) throw new Error(`Unknown user ${id}`);
	Object.assign(user, patch);
	save(data);
}

/**
 * Runs `apply` once per checkout. Returns false when the session was already handled.
 * In a real database, a unique constraint on the session ID does this safely.
 */
export function onceForSession(sessionId: string, apply: () => void): boolean {
	const data = load();
	if (data.processedSessionIds.includes(sessionId)) return false;
	data.processedSessionIds.push(sessionId);
	save(data);
	apply();
	return true;
}
