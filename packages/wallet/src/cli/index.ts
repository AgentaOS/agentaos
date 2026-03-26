import { createRequire } from 'node:module';
import { Command } from 'commander';

const require = createRequire(import.meta.url);
const { version } = require('../../package.json') as { version: string };
import {
	auditCommand,
	pauseCommand,
	policiesCommand,
	resumeCommand,
} from './commands/admin.command.js';
import { balanceCommand } from './commands/balance.command.js';
import { deployCommand } from './commands/deploy.command.js';
import { infoCommand } from './commands/info.command.js';
import { createCommand, importCommand } from './commands/init.command.js';
import { linkCommand } from './commands/link.command.js';
import { loginCommand, logoutCommand } from './commands/login.command.js';
import { networkCommand } from './commands/network.command.js';
import { payCommand } from './commands/pay.command.js';
import { proxyCommand } from './commands/proxy.command.js';
import { receiveCommand } from './commands/receive.command.js';
import { sendCommand } from './commands/send.command.js';
import { signMessageCommand } from './commands/sign.command.js';
import { statusCommand } from './commands/status.command.js';
import { switchCommand } from './commands/switch.command.js';
import { x402Command } from './commands/x402.command.js';
import { BRAND_BANNER, dim } from './theme.js';

// ---------------------------------------------------------------------------
// agenta sub — agent sub-account commands
// ---------------------------------------------------------------------------

const subCommand = new Command('sub')
	.description('Agent sub-account operations (send, sign, deploy)')
	.addCommand(createCommand)
	.addCommand(importCommand)
	.addCommand(switchCommand)
	.addCommand(infoCommand)
	.addCommand(balanceCommand)
	.addCommand(sendCommand)
	.addCommand(signMessageCommand)
	.addCommand(policiesCommand)
	.addCommand(pauseCommand)
	.addCommand(resumeCommand)
	.addCommand(auditCommand)
	.addCommand(x402Command)
	.addCommand(deployCommand)
	.addCommand(proxyCommand)
	.addCommand(networkCommand)
	.addCommand(linkCommand)
	.addCommand(receiveCommand);

// ---------------------------------------------------------------------------
// Main CLI
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
  $ agenta status                        Account, wallet & readiness overview
  $ agenta logout                        Clear session

${dim('Payments (accept & track):')}
  $ agenta pay checkout -a 50            Create a checkout session
  $ agenta pay get <sessionId>           Get checkout details
  $ agenta pay list                      List your checkouts

${dim('Agent sub-accounts (send & sign):')}
  $ agenta sub create --name bot1             Create a sub-account
  $ agenta sub import --name bot1 \\
      --api-key gw_... --api-secret <b64>    Import existing
  $ agenta sub switch <name>                 Switch active sub-account
  $ agenta sub switch                        List sub-accounts
  $ agenta sub info <name>                   Sub-account details
  $ agenta sub balance                       ETH & token balances
  $ agenta sub send 0x... 0.01               Send ETH
  $ agenta sub sign-message "hello"          Sign a message
  $ agenta sub policies get [--json]         View policies
  $ agenta sub policies set --file p.json    Set policies from JSON
  $ agenta sub pause / resume                Pause or resume signing
  $ agenta sub audit                         View signing audit log

${dim('x402 (agent-to-agent payments):')}
  $ agenta sub x402 check <url>              Check if URL requires payment
  $ agenta sub x402 discover <domain>        Find x402 endpoints on a domain
  $ agenta sub x402 fetch <url>              Pay and fetch a 402-protected resource

${dim('Docs: https://github.com/AgentaOS/agentaos')}
`,
		);

	program.addCommand(loginCommand);
	program.addCommand(logoutCommand);
	program.addCommand(statusCommand);
	program.addCommand(payCommand);
	program.addCommand(subCommand);

	await program.parseAsync();
}
