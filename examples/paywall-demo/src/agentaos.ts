import { AgentaOS } from '@agentaos/pay';

function required(name: string): string {
	const value = process.env[name];
	if (!value) throw new Error(`Set ${name} in .env (copy .env.example to start).`);
	return value;
}

export const config = {
	appUrl: required('APP_URL'),
	port: Number(process.env.PORT ?? 4567),
	proLinkId: required('PRO_LINK_ID'),
	proPlusLinkId: process.env.PRO_PLUS_LINK_ID || null,
	webhookSecret: required('AGENTAOS_WEBHOOK_SECRET'),
	tlsCert: process.env.TLS_CERT || null,
	tlsKey: process.env.TLS_KEY || null,
};

// Server side only: the key gives full access to your account.
export const agentaos = new AgentaOS(required('AGENTAOS_API_KEY'), {
	baseUrl: process.env.AGENTAOS_API_URL || undefined,
});
