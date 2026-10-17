#!/usr/bin/env node
import { AgentaOS } from '@agentaos/pay';
import { SOURCE_KEY_ENV, applyPlan, buildPlan, readSource, writeReport } from './index.js';
import { SOURCE_NAMES, type SourceName } from './types.js';

const HELP = `Move your products, plans and discount codes to AgentaOS.

Usage:
  npx @agentaos/migrate --from <paddle|lemonsqueezy|creem|gumroad> [--apply] [options]

Without --apply it is a dry run: it reads your old account and writes the plan,
creating nothing. Your old account is only read, never changed.

Keys come from the environment, never from flags:
  PADDLE_API_KEY | LEMONSQUEEZY_API_KEY | CREEM_API_KEY | GUMROAD_ACCESS_TOKEN
  AGENTAOS_API_KEY   needed for --apply (sk_test_... first, then sk_live_...)

Options:
  --apply         create the products and codes in AgentaOS
  --switch-code   also make a one-off code that makes a moved subscriber's first invoice free
  --test          read Paddle sandbox or Creem test mode
  --out <dir>     where to write the report (default ./agentaos-migration)
  --help`;

interface Args {
	from: SourceName;
	apply: boolean;
	switchCode: boolean;
	test: boolean;
	out: string;
}

function parseArgs(argv: string[]): Args | string {
	const flags = new Set(argv.filter((a) => a.startsWith('--')));
	if (flags.has('--help') || argv.length === 0) return HELP;
	const value = (name: string) => {
		const i = argv.indexOf(name);
		return i >= 0 ? argv[i + 1] : undefined;
	};
	const from = value('--from') as SourceName | undefined;
	if (!from || !SOURCE_NAMES.includes(from)) {
		return `--from must be one of: ${SOURCE_NAMES.join(', ')}\n\n${HELP}`;
	}
	return {
		from,
		apply: flags.has('--apply'),
		switchCode: flags.has('--switch-code'),
		test: flags.has('--test'),
		out: value('--out') ?? 'agentaos-migration',
	};
}

async function main(): Promise<number> {
	const args = parseArgs(process.argv.slice(2));
	if (typeof args === 'string') {
		console.log(args);
		return args === HELP ? 0 : 1;
	}

	const sourceKey = process.env[SOURCE_KEY_ENV[args.from]];
	if (!sourceKey) {
		console.error(`Set ${SOURCE_KEY_ENV[args.from]} to a read key for your ${args.from} account.`);
		return 1;
	}
	const agentaKey = process.env.AGENTAOS_API_KEY;
	if (args.apply && !agentaKey) {
		console.error('Set AGENTAOS_API_KEY (app.agentaos.ai, Settings, Developers) to apply.');
		return 1;
	}

	console.log(`Reading ${args.from}...`);
	const plan = buildPlan(await readSource(args.from, sourceKey, { test: args.test }));
	console.log(
		`Found ${plan.plans.length} products, ${plan.discounts.length} discount codes, ` +
			`${plan.subscribers.length} active subscribers; ${plan.skipped.length} left behind with a reason.`,
	);

	const result =
		args.apply && agentaKey
			? await applyPlan(new AgentaOS(agentaKey), plan, { switchCode: args.switchCode })
			: undefined;
	const files = await writeReport(args.out, plan, result);

	console.log(result ? 'Applied.' : 'Dry run: nothing was created. Add --apply to create it.');
	if (result?.failures.length) console.log(`${result.failures.length} failed; see summary.md.`);
	console.log(`Report:\n${files.map((f) => `  ${f}`).join('\n')}`);
	return result?.failures.length ? 2 : 0;
}

main().then(
	(code) => process.exit(code),
	(err: unknown) => {
		console.error(err instanceof Error ? err.message : err);
		process.exit(1);
	},
);
