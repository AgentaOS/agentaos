export interface Org {
	id: string;
	name: string | null;
}

/**
 * The caller's first org. A session token names a person, not an org, and a
 * person can belong to several; the server resolves the one to act for from
 * `?orgId=`, which the SDK stamps on every request once it knows it.
 */
export async function fetchOrg(serverUrl: string, token: string): Promise<Org | null> {
	try {
		const res = await fetch(`${serverUrl.replace(/\/+$/, '')}/api/v1/orgs`, {
			headers: { authorization: `Bearer ${token}` },
			signal: AbortSignal.timeout(8_000),
		});
		if (!res.ok) return null;
		const orgs = (await res.json()) as Array<{ id?: string; name?: string }>;
		const first = orgs[0];
		return first?.id ? { id: first.id, name: first.name ?? null } : null;
	} catch {
		return null;
	}
}
