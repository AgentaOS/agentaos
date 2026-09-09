import { describe, expect, it } from 'vitest';
import { formatPayError } from '../mcp/tools/pay-utils.js';

describe('formatPayError', () => {
	it('tells the merchant what to do when the API refuses the key', () => {
		const out = formatPayError(new Error('Invalid API key'), 'Failed to list customers');
		expect(out.isError).toBe(true);
		expect(out.content[0]?.text).toBe(
			'Failed to list customers: Invalid API key. The key may have been revoked in AgentaOS. Create a new key, or reconnect the connector.',
		);
	});

	it('passes every other error through unchanged', () => {
		const out = formatPayError(new Error('Network down'), 'Checkout creation failed');
		expect(out.content[0]?.text).toBe('Checkout creation failed: Network down');
	});
});
