import type { AgentaOS } from '@agentaos/pay';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { Command } from 'commander';
import { beforeAll, describe, expect, it } from 'vitest';
import { inputKeysOf } from '../cli/from-operation.js';
import { buildProgram } from '../cli/index.js';
import { registerAgentaTools } from '../mcp/tools/index.js';
import { OPERATIONS, cliCommand, mcpToolName } from '../ops/index.js';

/**
 * The guard against divergence: whatever `agenta` can do, the MCP server can
 * do, with the same name and the same inputs. One operation missing from
 * either renderer, or one flag that is not a tool argument, is a red build.
 */

const never = async (): Promise<never> => {
	throw new Error('parity never connects');
};
const program = buildProgram({ connect: never });

function resolve(root: Command, words: string[]): Command | undefined {
	return words.reduce<Command | undefined>(
		(parent, word) => parent?.commands.find((command) => command.name() === word),
		root,
	);
}

let listedTools: Array<{ name: string; inputSchema: { properties?: Record<string, unknown> } }>;

beforeAll(async () => {
	const server = new McpServer({ name: 'parity', version: '0.0.0' });
	registerAgentaTools(server, () => ({}) as AgentaOS);
	const [clientSide, serverSide] = InMemoryTransport.createLinkedPair();
	await server.connect(serverSide);
	const client = new Client({ name: 'parity', version: '0.0.0' });
	await client.connect(clientSide);
	listedTools = (await client.listTools()).tools;
	await client.close();
});

describe.each(OPERATIONS.map((op) => [op.name, op] as const))('%s', (_name, op) => {
	it(`the CLI resolves \`agenta ${cliCommand(op)}\``, () => {
		expect(resolve(program, cliCommand(op).split(' '))).toBeDefined();
	});

	it(`the MCP server lists ${mcpToolName(op)}`, () => {
		expect(listedTools.map((tool) => tool.name)).toContain(mcpToolName(op));
	});

	// Connect (PRD §6.1 R9-3): every command and tool can act for a business you manage.
	const catalogueKeys = [...Object.keys(op.input.shape), 'business'].sort();

	it('the CLI argument and flags are exactly the catalogue keys, plus --business', () => {
		const command = resolve(program, cliCommand(op).split(' ')) as Command;
		expect([...inputKeysOf(command)].sort()).toEqual(catalogueKeys);
	});

	it('the tool schema properties are exactly the catalogue keys, plus business', () => {
		const tool = listedTools.find((candidate) => candidate.name === mcpToolName(op));
		expect(Object.keys(tool?.inputSchema.properties ?? {}).sort()).toEqual(catalogueKeys);
	});
});

it('the MCP server lists nothing the catalogue does not have', () => {
	expect(listedTools.map((tool) => tool.name).sort()).toEqual(OPERATIONS.map(mcpToolName).sort());
});
