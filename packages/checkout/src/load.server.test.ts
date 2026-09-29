// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { loadAgentaOS } from './load.js';

describe('loadAgentaOS on the server', () => {
	it('resolves null, so it is safe in code that also renders on the server', async () => {
		await expect(loadAgentaOS()).resolves.toBeNull();
	});
});
