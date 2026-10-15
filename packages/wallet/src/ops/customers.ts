import { z } from 'zod';
import { pageLimit } from './schema.js';
import { type OperationGroup, operation } from './types.js';
import { count, lines, moreLine } from './words.js';

/** The customers who have paid you (mirrors the dashboard Customers list). */

export const customersList = operation({
	name: 'customers.list',
	guidance:
		'Returns the people who bought from the merchant, with their email, name, country and customer id, up to limit (1 to 100). Changes nothing.',
	title: 'List customers',
	effect: 'read',
	description: 'List customers',
	input: z.object({ limit: pageLimit }),
	async run(sdk, input) {
		const page = await sdk.customers.list({ limit: input.limit });
		return { total: page.total, hasMore: page.hasMore, items: page.items };
	},
	describe(page) {
		if (!page.items.length) return 'No customers yet. Someone paying you creates the first one.';
		return lines(
			`${count(page.total, 'customer')}:`,
			...page.items.map(
				(c) =>
					`  - ${c.email}${c.name ? ` (${c.name})` : ''}${c.country ? `, ${c.country}` : ''} — ${c.id}`,
			),
			moreLine(page.items.length, page.total, page.hasMore),
		);
	},
});

export const CUSTOMERS: OperationGroup = {
	name: 'customers',
	description: 'Customer management (list)',
	operations: [customersList],
};
