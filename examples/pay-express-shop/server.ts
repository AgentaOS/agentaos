/**
 * Real-world Express shop integration with AgentaOS payments.
 *
 * Flow:
 * 1. POST /checkout       → creates session, stores order, redirects to checkout
 * 2. Webhook /webhooks    → payment confirmed, fulfills order
 * 3. GET /success         → customer lands here after payment
 * 4. GET /order/:id       → check order status (polling fallback)
 */

import { AgentaOS, WebhookVerificationError } from '@agentaos/pay';
import express from 'express';

const app = express();
const PORT = Number(process.env.PORT ?? 3001);
const BASE_URL = process.env.BASE_URL ?? `http://localhost:${PORT}`;

// ---------------------------------------------------------------------------
// Initialize SDK
// ---------------------------------------------------------------------------

const apiKey = process.env.AGENTAOS_API_KEY ?? '';
const agentaos = new AgentaOS(apiKey, {
	debug: true, // logs requests to stderr — disable in production
});

// ---------------------------------------------------------------------------
// Simple in-memory order store (use a real database in production)
// ---------------------------------------------------------------------------

interface Order {
	id: string;
	product: string;
	amount: number;
	currency: string;
	buyerEmail: string;
	sessionId: string;
	checkoutUrl: string;
	status: 'pending' | 'paid' | 'failed';
	txHash: string | null;
	paidAt: string | null;
	createdAt: string;
}

const orders = new Map<string, Order>();
const sessionToOrder = new Map<string, string>(); // sessionId → orderId

// ---------------------------------------------------------------------------
// Routes
// ---------------------------------------------------------------------------

// Parse JSON for all routes except webhooks (needs raw body)
app.use((req, res, next) => {
	if (req.path === '/webhooks') return next();
	express.json()(req, res, next);
});

/**
 * POST /checkout — Customer clicks "Buy"
 *
 * Creates an AgentaOS checkout session, stores the order locally,
 * and returns the checkout URL for redirect.
 */
app.post('/checkout', async (req, res) => {
	try {
		const { product, amount, email } = req.body;

		if (!product || !amount || !email) {
			return res.status(400).json({ error: 'product, amount, and email are required' });
		}

		// 1. Create checkout session via SDK
		const session = await agentaos.checkouts.create({
			amount: Number(amount),
			currency: 'EUR',
			description: product,
			buyerEmail: email,
			successUrl: `${BASE_URL}/success?order=${crypto.randomUUID()}`,
			cancelUrl: `${BASE_URL}/cancel`,
			webhookUrl: `${BASE_URL}/webhooks`,
			metadata: { source: 'express-shop' },
		});

		// 2. Store order locally — link it to the session
		const orderId = crypto.randomUUID();
		const order: Order = {
			id: orderId,
			product,
			amount: Number(amount),
			currency: 'EUR',
			buyerEmail: email,
			sessionId: session.sessionId,
			checkoutUrl: session.checkoutUrl,
			status: 'pending',
			txHash: null,
			paidAt: null,
			createdAt: new Date().toISOString(),
		};
		orders.set(orderId, order);
		sessionToOrder.set(session.sessionId, orderId);

		console.log(`[order] Created ${orderId} → session ${session.sessionId}`);

		// 3. Return checkout URL — frontend redirects the customer here
		return res.json({
			orderId,
			checkoutUrl: session.checkoutUrl,
		});
	} catch (err) {
		console.error('[checkout] Failed:', (err as Error).message);
		return res.status(500).json({ error: 'Failed to create checkout' });
	}
});

/**
 * POST /webhooks — AgentaOS sends payment confirmation here
 *
 * IMPORTANT: Use express.raw() — webhook signature verifies the raw body.
 * If you parse JSON first, the signature won't match.
 */
app.post('/webhooks', express.raw({ type: 'application/json' }), (req, res) => {
	const signature = req.headers['x-agentaos-signature'] as string;
	const secret = process.env.AGENTAOS_WEBHOOK_SECRET ?? '';

	// 1. Verify signature — rejects tampered or replayed events
	let event: ReturnType<typeof agentaos.webhooks.verify> | undefined;
	try {
		event = agentaos.webhooks.verify(req.body, signature, secret);
	} catch (err) {
		if (err instanceof WebhookVerificationError) {
			console.warn('[webhook] Invalid signature — rejecting');
			return res.status(400).send('Invalid signature');
		}
		throw err;
	}

	// 2. Handle the event
	switch (event.type) {
		case 'checkout.session.completed': {
			const { sessionId, txHash, amount, payer } = event.data;
			const orderId = sessionToOrder.get(sessionId);

			if (orderId) {
				const order = orders.get(orderId);
				if (order && order.status === 'pending') {
					// Mark order as paid
					order.status = 'paid';
					order.txHash = txHash;
					order.paidAt = new Date().toISOString();

					console.log(
						`[webhook] Order ${orderId} PAID — tx: ${txHash}, payer: ${payer}, amount: ${amount}`,
					);

					// ==========================================
					// YOUR BUSINESS LOGIC HERE:
					// - Send confirmation email
					// - Grant access to product
					// - Update database
					// - Trigger shipping
					// ==========================================
				}
			} else {
				console.warn(`[webhook] No order found for session ${sessionId}`);
			}
			break;
		}

		default:
			console.log(`[webhook] Unhandled event: ${event.type}`);
	}

	// 3. Always return 200 — AgentaOS retries on non-2xx
	return res.sendStatus(200);
});

/**
 * GET /success — Customer lands here after payment
 *
 * IMPORTANT: Don't fulfill the order here — use the webhook.
 * The customer might close their browser before reaching this page.
 * This page is just a "thank you" screen.
 */
app.get('/success', (req, res) => {
	res.send(`
		<h1>Thank you for your purchase!</h1>
		<p>Your payment has been received. Check your email for confirmation.</p>
		<a href="/">Back to shop</a>
	`);
});

/**
 * GET /cancel — Customer cancelled or went back
 */
app.get('/cancel', (_req, res) => {
	res.send(`
		<h1>Payment cancelled</h1>
		<p>No charge was made. You can try again anytime.</p>
		<a href="/">Back to shop</a>
	`);
});

/**
 * GET /order/:id — Check order status (polling fallback)
 *
 * If webhooks fail, the frontend can poll this endpoint.
 * In production, use webhooks as the primary — polling as backup.
 */
app.get('/order/:id', async (req, res) => {
	const order = orders.get(req.params.id);
	if (!order) return res.status(404).json({ error: 'Order not found' });

	// If order is still pending, check AgentaOS for latest status
	if (order.status === 'pending') {
		try {
			const session = await agentaos.checkouts.retrieve(order.sessionId);
			if (session.status === 'completed' && order.status === 'pending') {
				order.status = 'paid';
				order.paidAt = new Date().toISOString();
				console.log(`[poll] Order ${order.id} marked paid via polling`);
			}
		} catch {
			// Session fetch failed — return current status
		}
	}

	return res.json({
		id: order.id,
		product: order.product,
		amount: order.amount,
		status: order.status,
		txHash: order.txHash,
	});
});

/**
 * GET / — Simple shop page
 */
app.get('/', (_req, res) => {
	res.send(`
		<h1>Stablecoin Shop</h1>
		<form action="/checkout" method="POST" id="form">
			<p><label>Product: <input name="product" value="Pro Plan — Monthly" /></label></p>
			<p><label>Amount (EUR): <input name="amount" type="number" step="0.01" value="49.99" /></label></p>
			<p><label>Email: <input name="email" type="email" placeholder="you@example.com" /></label></p>
			<button type="submit">Pay with Crypto</button>
		</form>
		<script>
			document.getElementById('form').addEventListener('submit', async (e) => {
				e.preventDefault();
				const data = Object.fromEntries(new FormData(e.target));
				const res = await fetch('/checkout', {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify(data),
				});
				const { checkoutUrl } = await res.json();
				window.location.href = checkoutUrl;
			});
		</script>
	`);
});

// ---------------------------------------------------------------------------
// Start
// ---------------------------------------------------------------------------

app.listen(PORT, () => {
	console.log(`\nShop running at ${BASE_URL}\n`);
	console.log('Endpoints:');
	console.log('  GET  /              → Shop page');
	console.log('  POST /checkout      → Create checkout session');
	console.log('  POST /webhooks      → Webhook handler');
	console.log('  GET  /success       → Post-payment page');
	console.log('  GET  /cancel        → Cancellation page');
	console.log('  GET  /order/:id     → Order status (polling)\n');
});
