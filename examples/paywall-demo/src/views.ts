// Plain HTML templates. Every value from the API or the user goes through `esc`.
import type { Checkout, PlanChangePreview, Subscription, SubscriptionInvoice } from '@agentaos/pay';
import type { User } from './store.js';

const esc = (value: unknown): string =>
	String(value ?? '').replace(
		/[&<>"']/g,
		(c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] as string,
	);

// The API does the math; these only print its numbers.
/** Invoices give currency units, such as 60.76. */
const format = (units: number, currency: string): string =>
	new Intl.NumberFormat('en-US', { style: 'currency', currency: currency.toUpperCase() }).format(
		units,
	);
/** Subscriptions and quotes give integer minor units: 3596 is 35.96. */
const money = (minor: number, currency: string): string => format(minor / 100, currency);

const date = (iso: string | null): string =>
	iso
		? new Date(iso).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })
		: '';

function layout(title: string, user: User | null, body: string): string {
	const nav = user
		? `<span>Signed in as <b>${esc(user.name)}</b></span> <form method="post" action="/logout"><button class="link">Sign out</button></form>`
		: '';
	return `<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(title)} · Notes</title>
<style>
body{font:15px/1.5 system-ui,sans-serif;margin:0;background:#f6f7f9;color:#1a1d23}
header{display:flex;justify-content:space-between;align-items:center;padding:14px 32px;background:#fff;border-bottom:1px solid #e3e5e8}
header a{font-weight:700;color:inherit;text-decoration:none}header div{display:flex;gap:12px;align-items:center}
main{max-width:720px;margin:32px auto;padding:0 16px}
.card{background:#fff;border:1px solid #e3e5e8;border-radius:10px;padding:20px 24px;margin-bottom:20px}
h1{font-size:22px;margin:0 0 4px}h2{font-size:16px;margin:0 0 12px}
.badge{display:inline-block;padding:2px 10px;border-radius:99px;font-size:13px;background:#eceef1}
.badge.pro{background:#e6f4ea;color:#1e7a3c}.muted{color:#5f6672}
button,.button{font:inherit;padding:8px 16px;border-radius:8px;border:1px solid #1a1d23;background:#1a1d23;color:#fff;cursor:pointer;text-decoration:none;display:inline-block}
button.secondary{background:#fff;color:#1a1d23}button.link{background:none;border:0;color:#3656d8;padding:0}
form{display:inline}.row{display:flex;gap:10px;flex-wrap:wrap;margin-top:12px}
table{width:100%;border-collapse:collapse}td,th{text-align:left;padding:8px 4px;border-bottom:1px solid #eceef1}
th{font-size:13px;color:#5f6672;font-weight:500}a{color:#3656d8}
</style></head><body><header><a href="/">Notes</a><div>${nav}</div></header><main>${body}</main></body></html>`;
}

export function loginPage(users: User[]): string {
	const buttons = users
		.map(
			(u) =>
				`<form method="post" action="/login"><input type="hidden" name="userId" value="${esc(u.id)}"><button>${esc(u.name)}</button></form>`,
		)
		.join(' ');
	return layout(
		'Sign in',
		null,
		`<div class="card"><h1>Sign in</h1><p class="muted">A fake login: pick a user.</p><div class="row">${buttons}</div></div>`,
	);
}

function planCard(sub: Subscription | null, pro: boolean, upgradeLinkId: string | null): string {
	if (!pro || !sub) {
		return `<div class="card"><h2>Your plan <span class="badge">Free</span></h2>
<p>Pro unlocks unlimited notes and sharing.</p>
<form method="post" action="/upgrade"><button>Upgrade to Pro</button></form></div>`;
	}
	const renewal = sub.cancelAtPeriodEnd
		? `Pro ends on <b>${date(sub.effectiveCancelDate ?? sub.currentPeriodEnd)}</b>. You keep it until then.`
		: `${sub.status === 'trialing' ? 'Free trial. First charge' : 'Renews'} on <b>${date(sub.currentPeriodEnd)}</b>: ${money(sub.unitAmountMinor, sub.currency)} per ${esc(sub.billingInterval)}.`;
	const pending = sub.pendingPlanChange
		? `<p class="muted">Switches to ${esc(sub.pendingPlanChange.planName)} on ${date(sub.pendingPlanChange.effectiveAt)}.</p>`
		: '';
	const canUpgrade = upgradeLinkId !== null && sub.linkId !== upgradeLinkId;
	const upgrade = canUpgrade
		? '<form method="post" action="/plan/preview"><button class="secondary">Upgrade to Pro Plus</button></form>'
		: '';
	const actions = sub.cancelAtPeriodEnd
		? ''
		: `<div class="row">${upgrade}<form method="post" action="/plan/cancel"><button class="secondary">Cancel plan</button></form></div>`;
	return `<div class="card"><h2>Your plan <span class="badge pro">${esc(sub.planName)}</span> <span class="badge">${esc(sub.status)}</span></h2>
<p>${renewal}</p>${pending}<p><a href="/pro">Open Pro notes</a></p>
<h2 style="margin-top:20px">Manage plan</h2>${actions || '<p class="muted">Cancellation scheduled.</p>'}</div>`;
}

function invoicesCard(invoices: SubscriptionInvoice[]): string {
	const rows = invoices
		.map(
			(
				i,
			) => `<tr><td>${esc(i.invoiceNumber)}</td><td>${date(i.issuedAt)}</td><td>${format(i.amount, i.currency)}</td><td>${esc(i.status)}</td>
<td><a href="/invoices/${esc(i.id)}/pdf">Invoice PDF</a> · <a href="/invoices/${esc(i.id)}/receipt">Receipt</a></td></tr>`,
		)
		.join('');
	const table = rows
		? `<table><tr><th>Number</th><th>Date</th><th>Amount</th><th>Status</th><th></th></tr>${rows}</table>`
		: '<p class="muted">No invoices yet. The first one comes with the first charge.</p>';
	return `<div class="card"><h2>My invoices</h2>${table}</div>`;
}

export function homePage(input: {
	user: User;
	subscription: Subscription | null;
	pro: boolean;
	upgradeLinkId: string | null;
	invoices: SubscriptionInvoice[];
	locked: boolean;
}): string {
	const locked = input.locked ? '<div class="card">Pro notes need the Pro plan.</div>' : '';
	const invoices = input.user.subscriptionId ? invoicesCard(input.invoices) : '';
	return layout(
		'Home',
		input.user,
		`<h1>Hello, ${esc(input.user.name)}</h1><p class="muted">${esc(input.user.email)}</p>
${locked}${planCard(input.subscription, input.pro, input.upgradeLinkId)}${invoices}`,
	);
}

export function successPage(user: User, status: Checkout['status']): string {
	const body =
		status === 'completed'
			? '<h1>You are on Pro</h1><p>Thanks. Your payment is confirmed and Pro is unlocked.</p><a class="button" href="/">Go to Notes</a>'
			: status === 'open'
				? '<h1>Still processing</h1><p>We are waiting for the payment to confirm.</p><a class="button" href="">Refresh</a>'
				: `<h1>Payment not completed</h1><p>The checkout is ${esc(status)}.</p><form method="post" action="/upgrade"><button>Try again</button></form>`;
	return layout('Upgrade', user, `<div class="card">${body}</div>`);
}

export function quotePage(user: User, quote: PlanChangePreview): string {
	return layout(
		'Upgrade',
		user,
		`<div class="card"><h1>Upgrade to Pro Plus</h1>
<p>Due today: <b>${money(quote.dueTodayMinor, quote.currency)}</b></p>
<p>Then ${money(quote.nextInvoiceMinor, quote.currency)} on ${date(quote.nextInvoiceAt)}.</p>
<div class="row"><form method="post" action="/plan/change"><input type="hidden" name="prorationDate" value="${esc(quote.prorationDate)}"><button>Confirm upgrade</button></form>
<a class="button" style="background:#fff;color:#1a1d23" href="/">Back</a></div></div>`,
	);
}

export function proPage(user: User): string {
	return layout(
		'Pro notes',
		user,
		'<div class="card"><h1>Pro notes</h1><p>Only Pro users see this page.</p></div>',
	);
}
