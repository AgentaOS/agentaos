// Sends signed sample events to the demo's /webhooks route, the way AgentaOS signs them:
// header `X-AgentaOS-Signature: t=<unix seconds>,v1=<HMAC-SHA256 of "<t>.<raw body>">`.
// Use it when AgentaOS cannot reach your machine. Run: pnpm webhook:test
import { createHmac, randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { request } from 'node:https';

const url = new URL('/webhooks', process.env.APP_URL);
const secret = process.env.AGENTAOS_WEBHOOK_SECRET ?? '';

function sign(body: string): string {
	const t = Math.floor(Date.now() / 1000);
	return `t=${t},v1=${createHmac('sha256', secret).update(`${t}.${body}`).digest('hex')}`;
}

function post(body: string, signature: string): Promise<number> {
	return new Promise((resolve, reject) => {
		const req = request(
			url,
			{
				method: 'POST',
				headers: { 'content-type': 'application/json', 'x-agentaos-signature': signature },
				// Local only: the demo's certificate is self-signed.
				rejectUnauthorized: false,
			},
			(res) => resolve(res.statusCode ?? 0),
		);
		req.on('error', reject);
		req.end(body);
	});
}

// Events use the wire format: snake_case keys, as AgentaOS sends them.
const users = JSON.parse(readFileSync('data.json', 'utf8')).users as Array<{
	id: string;
	subscriptionId: string | null;
}>;
const subscribed = users.find((u) => u.subscriptionId);
if (!subscribed?.subscriptionId) throw new Error('Subscribe one user in the app first.');
const subscriptionId = subscribed.subscriptionId;

const renewal = JSON.stringify({
	id: `evt_${randomUUID()}`,
	type: 'checkout.session.completed',
	business: 'test',
	data: {
		session_id: `test_renewal_${Date.now()}`,
		amount: '29.00',
		currency: 'EUR',
		livemode: false,
		metadata: { subscriptionId, subscriptionCycle: true },
	},
});
const updated = JSON.stringify({
	id: `evt_${randomUUID()}`,
	type: 'subscription.updated',
	business: 'test',
	data: { id: subscriptionId, status: 'active', cancel_at_period_end: true, livemode: false },
});

console.log('bad signature        ->', await post(renewal, 't=1,v1=00'));
console.log('renewal              ->', await post(renewal, sign(renewal)));
console.log('same renewal again   ->', await post(renewal, sign(renewal)));
console.log('subscription.updated ->', await post(updated, sign(updated)));
