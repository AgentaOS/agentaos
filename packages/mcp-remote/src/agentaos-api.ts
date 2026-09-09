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
		private readonly fetchFn: typeof fetch = fetch,
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

	createSecretKey(sessionToken: string, supportedNetworks: string[]): Promise<SecretKey> {
		return this.request<SecretKey>(
			'POST',
			'/gateway/secret-keys',
			{ supportedNetworks },
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
