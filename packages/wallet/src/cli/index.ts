import { createRequire } from 'node:module';
import { Command } from 'commander';

const require = createRequire(import.meta.url);
const { version } = require('../../package.json') as { version: string };
import { customersCommand } from './commands/customers.command.js';
import { invoicesCommand } from './commands/invoices.command.js';
import { loginCommand, logoutCommand } from './commands/login.command.js';
import { revenueAuditCommand, verifyCommand } from './commands/onboarding.command.js';
import { payCommand } from './commands/pay.command.js';
import { statusCommand } from './commands/status.command.js';
import { subscriptionsCommand } from './commands/subscriptions.command.js';
import { BRAND_BANNER, dim } from './theme.js';

// ---------------------------------------------------------------------------
// Main CLI
//
// Merchant commands only. The `agenta sub` tree (MPC sub-accounts: create,
// import, switch, info, balance, send, sign-message, policies, pause, resume,
// audit, deploy, proxy, network, link, receive, x402) was removed as wallet-era
// legacy. That also retired the `agenta sub audit` signing log, which used to
// collide with `agenta audit` — the merchant's Revenue & Pricing Audit — and
// made "audit" ambiguous for the AI tools this CLI is built for.
// ---------------------------------------------------------------------------

export async function runCli(): Promise<void> {
	const program = new Command();

	program
		.name('agenta')
		.description(BRAND_BANNER)
		.version(version)
		.addHelpText(
			'after',
			`
${dim('Getting started:')}
  $ agenta login                         Sign in via browser
  $ agenta status                        Account & go-live overview
  $ agenta logout                        Clear session

${dim('Going live (start here):')}
  $ agenta audit request --url <url>     Get the free Revenue & Pricing Audit
  $ agenta audit show                    Read it and save the PDF once written
  $ agenta verify declaration            What --accept-declaration attests to
  $ agenta verify submit                 Submit business verification
  $ agenta verify status                 Where the review has got to
  $ agenta verify resubmit               Reapply after making changes we asked for

${dim('Payments (accept & track):')}
  $ agenta pay checkout -a 50            Create a checkout session
  $ agenta pay get <sessionId>           Get checkout details
  $ agenta pay list                      List your checkouts

${dim('Subscriptions & customers (manage):')}
  $ agenta subscriptions list            List subscriptions
  $ agenta subscriptions cancel <id>     Cancel (at period end; --now for immediate)
  $ agenta customers list                List customers

${dim('Invoices & receipts:')}
  $ agenta invoices list                 List invoices
  $ agenta invoices receipt <id>         Download the receipt PDF
  $ agenta invoices send-receipt <id>    Re-send the receipt email

${dim('Docs: https://github.com/AgentaOS/agentaos')}
`,
		);

	program.addCommand(loginCommand);
	program.addCommand(logoutCommand);
	program.addCommand(statusCommand);
	program.addCommand(revenueAuditCommand);
	program.addCommand(verifyCommand);
	program.addCommand(payCommand);
	program.addCommand(subscriptionsCommand);
	program.addCommand(customersCommand);
	program.addCommand(invoicesCommand);

	await program.parseAsync();
}
