// Classes
export { ThresholdSigner } from './threshold-signer.js';
export { HttpClient, HttpClientError } from './http-client.js';
export { AgentaApi } from './agenta-api.js';
export { Agenta } from './agenta.js';

// Backward-compat re-exports (deprecated)
export { Agenta as Guardian } from './agenta.js';
export { AgentaApi as GuardianApi } from './agenta-api.js';

// Functions (share-loader)
export { wipeShare } from './share-loader.js';

// Types — ThresholdSigner
export type {
	FromSecretOptions,
	SignMessageResult,
	SignTransactionResult,
	ViemAccount,
} from './threshold-signer.js';

// Types — HttpClient
export type {
	CompleteMessageSignResponse,
	CompleteSignRequest,
	CompleteSignResponse,
	CreateMessageSignSessionRequest,
	CreateMessageSignSessionResponse,
	CreateSignSessionRequest,
	CreateSignSessionResponse,
	HttpClientConfig,
	HttpErrorBody,
	ProcessSignRoundRequest,
	ProcessSignRoundResponse,
} from './http-client.js';

// Types — AgentaApi
export type {
	AuditEntry,
	AuditMeta,
	AuditOpts,
	AuditResult,
	BalanceResult,
	HealthStatus,
	NetworkBalance,
	NetworkInfo,
	PolicyInfo,
	PolicyRule,
	ResolvedAddress,
	ResolvedToken,
	SignerInfo,
	SimulateRequest,
	SimulateResult,
	TokenBalance,
	TokenInfo,
} from './agenta-api.js';

// Types — Agenta
export type { AgentaConnectOptions, GuardianConnectOptions } from './agenta.js';
