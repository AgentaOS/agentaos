import { createRequire } from 'node:module';
import { Command } from 'commander';
import { adminCommand } from './commands/admin.command.js';

const require = createRequire(import.meta.url);
const { version } = require('../../package.json') as { version: string };
import { balanceCommand } from './commands/balance.command.js';
import { deployCommand } from './commands/deploy.command.js';
import { infoCommand } from './commands/info.command.js';
import { initCommand } from './commands/init.command.js';
import { linkCommand } from './commands/link.command.js';
import { loginCommand, logoutCommand } from './commands/login.command.js';
import { networkCommand } from './commands/network.command.js';
import { proxyCommand } from './commands/proxy.command.js';
import { receiveCommand } from './commands/receive.command.js';
import { sendCommand } from './commands/send.command.js';
import { signMessageCommand } from './commands/sign.command.js';
import { statusCommand } from './commands/status.command.js';
import { BRAND_BANNER, dim } from './theme.js';

export async function runCli(): Promise<void> {
	const program = new Command();

	program
		.name('agenta')
		.description(BRAND_BANNER)
		.version(version)
		.option('-s, --signer <name>', 'Signer name (default: auto-detected)')
		.addHelpText(
			'after',
			`
${dim('Getting started:')}
  $ agenta login             Log in with email + OTP
  $ agenta init              Create your first wallet
  $ agenta status            See all your wallets
  $ agenta send 0x... 0.01   Send ETH
  $ agenta link <name>       Export share to another device
  $ agenta receive <name>    Import share from another device

${dim('Docs: https://github.com/AgentaOS/agentaos')}
`,
		);

	program.addCommand(loginCommand);
	program.addCommand(logoutCommand);
	program.addCommand(initCommand);
	program.addCommand(statusCommand);
	program.addCommand(infoCommand);
	program.addCommand(balanceCommand);
	program.addCommand(sendCommand);
	program.addCommand(signMessageCommand);
	program.addCommand(deployCommand);
	program.addCommand(proxyCommand);
	program.addCommand(networkCommand);
	program.addCommand(linkCommand);
	program.addCommand(receiveCommand);
	program.addCommand(adminCommand);

	await program.parseAsync();
}
