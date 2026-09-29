import { AUDIT } from './audit.js';
import { BUSINESSES } from './businesses.js';
import { CUSTOMERS } from './customers.js';
import { DISCOUNTS } from './discounts.js';
import { INVOICES } from './invoices.js';
import { PAY } from './pay.js';
import { PRODUCTS } from './products.js';
import { STATUS } from './status.js';
import { SUBSCRIPTIONS } from './subscriptions.js';
import type { Operation, OperationGroup } from './types.js';
import { VERIFY } from './verify.js';

/**
 * The one catalogue of merchant operations. The CLI and the MCP server are
 * both rendered from it, in this order, and a parity test holds them to it.
 * Login and logout are not here: they are the human step that mints the
 * credential.
 */
const GROUPS: readonly OperationGroup[] = [
	STATUS,
	AUDIT,
	VERIFY,
	PRODUCTS,
	PAY,
	SUBSCRIPTIONS,
	DISCOUNTS,
	CUSTOMERS,
	INVOICES,
	BUSINESSES,
];

export const OPERATIONS: readonly Operation[] = GROUPS.flatMap((group) => group.operations);

export function groups(): readonly OperationGroup[] {
	return GROUPS;
}

export { cliCommand, groupOf, kebab, mcpToolName, opOf } from './naming.js';
export type { Operation, OperationGroup, OperationInput } from './types.js';
