import { Command, Option } from 'commander';
import { z } from 'zod';
import { kebab, opOf } from '../ops/naming.js';
import { issuesText } from '../ops/schema.js';
import type { Operation, OperationGroup } from '../ops/types.js';
import type { CliContext } from './connect.js';
import { isJsonMode, outputError } from './output.js';
import { applySideEffect } from './side-effects.js';

/**
 * The CLI rendered from the operations catalogue: one commander subcommand
 * per operation, its flags read off the zod input. Today's short flags are
 * kept by name; everything else is `--kebab-case` of the input key.
 */

const SHORT_FLAGS: Record<string, string> = {
	name: '-n',
	amount: '-a',
	currency: '-c',
	description: '-d',
	output: '-o',
};

interface Field {
	key: string;
	inner: z.ZodTypeAny;
	description: string;
	required: boolean;
	defaultValue: unknown;
}

/** Strip optional/default/effects wrappers down to the schema that decides the flag's shape. */
function fieldOf(key: string, schema: z.ZodTypeAny): Field {
	let inner = schema;
	let description = schema.description;
	let defaultValue: unknown;
	for (;;) {
		description ??= inner.description;
		if (inner instanceof z.ZodOptional || inner instanceof z.ZodNullable) {
			inner = inner._def.innerType;
		} else if (inner instanceof z.ZodDefault) {
			defaultValue = inner._def.defaultValue();
			inner = inner._def.innerType;
		} else if (inner instanceof z.ZodEffects) {
			inner = inner._def.schema;
		} else {
			break;
		}
	}
	return {
		key,
		inner,
		description: description ?? '',
		required: !schema.isOptional(),
		defaultValue,
	};
}

function fieldsOf(op: Operation): Field[] {
	return Object.entries(op.input.shape).map(([key, schema]) => fieldOf(key, schema));
}

function optionFor(field: Field): Option {
	const long = `--${kebab(field.key)}`;
	if (field.inner instanceof z.ZodBoolean) {
		// A boolean that defaults to true is switched OFF: `--no-download`.
		return field.defaultValue === true
			? new Option(`--no-${kebab(field.key)}`, negated(field.description))
			: new Option(long, field.description);
	}

	const short = SHORT_FLAGS[field.key];
	const placeholder = field.inner instanceof z.ZodNumber ? '<n>' : '<value>';
	const option = new Option(`${short ? `${short}, ` : ''}${long} ${placeholder}`, helpOf(field));
	if (field.required) option.makeOptionMandatory();
	if (field.defaultValue !== undefined) option.default(field.defaultValue);
	return option;
}

/** `Save the report PDF` → `Don't save the report PDF`, for a `--no-` flag. */
function negated(description: string): string {
	return description ? `Don't ${description.charAt(0).toLowerCase()}${description.slice(1)}` : '';
}

/** The help line: the description, then the accepted values for an enum. */
function helpOf(field: Field): string {
	if (field.inner instanceof z.ZodEnum) {
		const values = (field.inner.options as string[]).join(' | ');
		return field.description ? `${field.description} (${values})` : values;
	}
	return field.description;
}

export function commandFromOperation(op: Operation, ctx: CliContext): Command {
	const command = new Command(kebab(opOf(op))).description(op.description);
	const fields = fieldsOf(op);

	const positional = fields.find((field) => field.key === op.positional);
	if (positional) command.argument(`<${positional.key}>`, positional.description);
	for (const field of fields) {
		if (field !== positional) command.addOption(optionFor(field));
	}

	command.action(async (...args: unknown[]) => {
		const invoked = args[args.length - 1] as Command;
		const raw = { ...invoked.opts(), ...(positional ? { [positional.key]: args[0] } : {}) };
		await runOperation(op, ctx, raw);
	});
	return command;
}

export function groupCommand(group: OperationGroup, ctx: CliContext): Command {
	const command = new Command(group.name).description(group.description);
	for (const op of group.operations) command.addCommand(commandFromOperation(op, ctx));
	return command;
}

/** Validate, connect, run, apply any CLI-only side effect, print. */
export async function runOperation(
	op: Operation,
	ctx: CliContext,
	raw: Record<string, unknown>,
): Promise<void> {
	const parsed = op.input.safeParse(raw);
	if (!parsed.success) {
		fail(issuesText(parsed.error));
		return;
	}
	try {
		const { sdk } = await ctx.connect();
		const result = await applySideEffect(op, parsed.data, await op.run(sdk, parsed.data));
		print(op, result);
	} catch (error: unknown) {
		fail(error instanceof Error ? error.message : 'Unknown error');
	}
}

export function print(op: Operation, result: unknown): void {
	if (isJsonMode()) {
		console.log(JSON.stringify(result));
		return;
	}
	const text = op
		.describe(result)
		.split('\n')
		.map((line) => `  ${line}`)
		.join('\n');
	console.log(`\n${text}\n`);
}

export function fail(message: string): void {
	outputError(message);
	process.exitCode = 1;
}

/** The input keys a command accepts: its argument plus every option except `--json`. */
export function inputKeysOf(command: Command): string[] {
	const argumentNames = command.registeredArguments.map((argument) => argument.name());
	const optionNames = command.options
		.map((option) => option.attributeName())
		.filter((name) => name !== 'json');
	return [...argumentNames, ...optionNames];
}
