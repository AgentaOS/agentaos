import type { AgentaOS } from '@agentaos/pay';
import type { z } from 'zod';

/** How an operation changes the account; the MCP tool annotations are derived from it. */
export type OperationEffect = 'read' | 'write' | 'destructive';

/** A zod object. Its keys become the CLI flags and the MCP input schema. */
export type OperationInput = z.ZodObject<z.ZodRawShape>;

/**
 * One thing a merchant can do, written once and rendered into both the CLI
 * (`agenta <group> <op>`) and the MCP server (`agenta_<group>_<op>`).
 */
export interface Operation<I extends OperationInput = OperationInput, O = unknown> {
	/** `<group>.<op>`, op in camelCase: `products.create`, `subscriptions.changePlan`. */
	name: `${string}.${string}`;
	/** A short human label for the tool, e.g. `Create product`. */
	title: string;
	/** What the operation does to the account: `read` changes nothing, `destructive` cancels,
	 *  archives or revokes something the merchant cannot simply recreate, `write` is the rest. */
	effect: OperationEffect;
	/** One sentence; the CLI help line and the MCP tool description. */
	description: string;
	/** For AI agents, after the description in the MCP tool: when to use it, what it returns and what it
	 *  changes. Not shown in the CLI help, which stays one line. */
	guidance: string;
	/** Every key carries `.describe()`: that text is the CLI option help and the MCP schema description. */
	input: I;
	/** Answers from the catalogue itself, with no API call, so it works before the merchant has a key.
	 *  `run` then gets {@link NO_CLIENT} instead of a connected SDK. */
	offline?: boolean;
	/** The one required id the CLI takes as an argument (`<id>`) instead of a flag. */
	positional?: string;
	/** SDK only: no fetch, no process.env, no console. Returns the render-ready JSON. */
	run(sdk: AgentaOS, input: z.infer<I>): Promise<O>;
	/** Merchant-facing text: what happened and what they can do next. */
	describe(result: O): string;
}

/** The client an offline operation gets: any use of it is a bug in that operation, so it throws. */
export const NO_CLIENT = new Proxy(
	{},
	{
		get() {
			throw new Error('This operation is offline and cannot call the AgentaOS API.');
		},
	},
) as AgentaOS;

export interface OperationGroup {
	name: string;
	description: string;
	operations: readonly Operation[];
}

/** Identity function that pins the generic parameters from the literal and
 *  checks that `positional` names one of the input's keys. */
export function operation<I extends OperationInput, O>(
	op: Operation<I, O> & { positional?: keyof z.infer<I> & string },
): Operation<I, O> {
	return op;
}
