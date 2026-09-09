import { createRequire } from 'node:module';
import { Command } from 'commander';

const require = createRequire(import.meta.url);
const { version } = require('../../package.json') as { version: string };
import { groups } from '../ops/index.js';
import { loginCommand, logoutCommand } from './commands/login.command.js';
import { statusCommand } from './commands/status.command.js';
import { type CliContext, connect } from './connect.js';
import { groupCommand } from './from-operation.js';
import { addJsonOption } from './output.js';
import { BRAND_BANNER, dim } from './theme.js';

// ---------------------------------------------------------------------------
// Main CLI
//
// Merchant commands only, rendered from the operations catalogue in
// `ops/` — the same catalogue the MCP server renders its tools from, so the
// two cannot drift. `login` and `logout` are the human step that mints the
// credential, and `status` adds who you are to the catalogue's go-live
// overview; those three are the only hand-written commands.
// ---------------------------------------------------------------------------

export async function runCli(): Promise<void> {
	await buildProgram().parseAsync();
}

export function buildProgram(ctx: CliContext = { connect }): Command {
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

${dim('Products (what you sell):')}
  $ agenta products create -n Pro -a 29  Create a product or a subscription plan
  $ agenta products list                 List products and plans

${dim('Payments (accept & track):')}
  $ agenta pay checkout -a 50            Create a checkout session
  $ agenta pay get <sessionId>           Get checkout details
  $ agenta pay list                      List your checkouts

${dim('Subscriptions & customers (manage):')}
  $ agenta subscriptions list            List subscriptions
  $ agenta subscriptions cancel <id>     Cancel (at period end; --now for immediate)
  $ agenta subscriptions change-plan <id> --to <linkId>   Upgrade or downgrade a plan
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
	for (const group of groups()) {
		program.addCommand(group.name === 'status' ? statusCommand(ctx) : groupCommand(group, ctx));
	}

	for (const command of program.commands) addJsonOption(command);
	return program;
}
