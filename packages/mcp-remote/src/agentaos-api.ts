const API_PREFIX = '/api/v1';

export interface DeviceCode {
	deviceCode: string;
	userCode: string;
	verificationUrl: string;
	expiresIn: number;
	interval: number;
}

export type DeviceCodePollStatus = 'pending' | 'completed' | 'expired' | 'denied';

export interface DeviceCodePoll {
	status: DeviceCodePollStatus;
	token?: string;
	email?: string;
	orgName?: string;
}

export interface Network {
	name: string;
	isTestnet: boolean;
}

export interface SecretKey {
	id: string;
	key_prefix: string;
	rawKey: string;
}

/** The four platform calls the connection flow needs. Throws on any non-2xx. */
export class AgentaosApi {
	constructor(
		private readonly baseUrl: string,
		// Wrapped, not passed bare: a bare `fetch` stored on the instance is
		// invoked with the instance as `this`, which Workers reject as an
		// illegal invocation. Node tolerates it, so a test would not catch it.
		private readonly fetchFn: typeof fetch = (input, init) => fetch(input, init),
	) {}

	createDeviceCode(): Promise<DeviceCode> {
		return this.request<DeviceCode>('POST', '/auth/device-code', {});
	}

	pollDeviceCode(deviceCode: string): Promise<DeviceCodePoll> {
		return this.request<DeviceCodePoll>('POST', '/auth/device-code/poll', { deviceCode });
	}

	listNetworks(): Promise<Network[]> {
		return this.request<Network[]>('GET', '/networks');
	}

	/** `label` is what the Developers tab shows as the key's name (max 40 chars). */
	createSecretKey(
		sessionToken: string,
		supportedNetworks: string[],
		label: string,
	): Promise<SecretKey> {
		return this.request<SecretKey>(
			'POST',
			'/gateway/secret-keys',
			{ supportedNetworks, label: label.slice(0, 40) },
			{ authorization: `Bearer ${sessionToken}` },
		);
	}

	private async request<T>(
		method: 'GET' | 'POST',
		path: string,
		body?: unknown,
		headers: Record<string, string> = {},
	): Promise<T> {
		const response = await this.fetchFn(`${this.baseUrl}${API_PREFIX}${path}`, {
			method,
			headers: { 'content-type': 'application/json', ...headers },
			body: body === undefined ? undefined : JSON.stringify(body),
		});
		if (!response.ok) {
			throw new Error(
				`AgentaOS API ${method} ${path} -> ${response.status}: ${await response.text()}`,
			);
		}
		return (await response.json()) as T;
	}
}
