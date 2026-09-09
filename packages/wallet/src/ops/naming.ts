import type { Operation } from './types.js';

/** `subscriptions.changePlan` → `subscriptions`. */
export function groupOf(op: Operation): string {
	return op.name.slice(0, op.name.indexOf('.'));
}

/** `subscriptions.changePlan` → `changePlan`. */
export function opOf(op: Operation): string {
	return op.name.slice(op.name.indexOf('.') + 1);
}

/** `changePlan` → `change-plan`. */
export function kebab(camel: string): string {
	return camel.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`);
}

/** `changePlan` → `change_plan`. */
export function snake(camel: string): string {
	return camel.replace(/[A-Z]/g, (c) => `_${c.toLowerCase()}`);
}

/** The words a merchant types after `agenta`: `subscriptions change-plan`. */
export function cliCommand(op: Operation): string {
	return `${groupOf(op)} ${kebab(opOf(op))}`;
}

/** The MCP tool name: `agenta_subscriptions_change_plan`. */
export function mcpToolName(op: Operation): string {
	return `agenta_${groupOf(op)}_${snake(opOf(op))}`;
}
