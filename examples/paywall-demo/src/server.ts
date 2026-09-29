import { readFileSync } from 'node:fs';
import { createServer as createHttpsServer } from 'node:https';
import express from 'express';
import { findSubscription, isPro, requirePro } from './access.js';
import { config } from './agentaos.js';
import { success, upgrade } from './checkout.js';
import { downloadInvoice, userInvoices } from './invoices.js';
import { cancel, change, preview } from './plan.js';
import { currentUser, requireUser, signIn, signOut } from './session.js';
import { findUser, listUsers } from './store.js';
import { homePage, loginPage, proPage } from './views.js';
import { webhooks } from './webhooks.js';

const app = express();

// The webhook needs the raw body for the signature, so it is mounted before any body parser.
app.post('/webhooks', express.raw({ type: 'application/json' }), webhooks);
app.use(express.urlencoded({ extended: false }));

app.get('/', async (req, res) => {
	const user = currentUser(req);
	if (!user) {
		res.send(loginPage(listUsers()));
		return;
	}
	const subscription = await findSubscription(user.subscriptionId);
	res.send(
		homePage({
			user,
			subscription,
			pro: isPro(subscription),
			upgradeLinkId: config.proPlusLinkId,
			invoices: await userInvoices(user),
			locked: req.query.locked === '1',
		}),
	);
});

app.post('/login', (req, res) => {
	const user = findUser(String(req.body.userId));
	if (user) signIn(res, user.id);
	res.redirect(303, '/');
});
app.post('/logout', (_req, res) => {
	signOut(res);
	res.redirect(303, '/');
});

app.post('/upgrade', requireUser, upgrade);
app.get('/success', requireUser, success);
app.get('/pro', requireUser, requirePro, (_req, res) => void res.send(proPage(res.locals.user)));
app.get(['/invoices/:id/pdf', '/invoices/:id/receipt'], requireUser, downloadInvoice);
app.post('/plan/cancel', requireUser, cancel);
app.post('/plan/preview', requireUser, preview);
app.post('/plan/change', requireUser, change);

const listening = () => console.log(`Notes demo on ${config.appUrl}`);
if (config.tlsCert && config.tlsKey) {
	const tls = { cert: readFileSync(config.tlsCert), key: readFileSync(config.tlsKey) };
	createHttpsServer(tls, app).listen(config.port, listening);
} else {
	app.listen(config.port, listening);
}
