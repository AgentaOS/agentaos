// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import { loadAgentaOS, resetForTests } from './load.js';
import type { AgentaOS } from './types.js';

const FAKE = { checkout: { open: () => ({ update() {}, close() {} }) } } as unknown as AgentaOS;

const scripts = () => [...document.querySelectorAll<HTMLScriptElement>('script')];

function scriptLoads(defineGlobal = true) {
	if (defineGlobal) window.AgentaOS = FAKE;
	scripts().at(-1)?.dispatchEvent(new Event('load'));
}

afterEach(() => {
	for (const script of scripts()) script.remove();
	window.AgentaOS = undefined;
	resetForTests();
});

describe('loadAgentaOS', () => {
	it('adds the script once, however many callers ask at the same time', async () => {
		const first = loadAgentaOS();
		const second = loadAgentaOS();
		expect(scripts()).toHaveLength(1);
		expect(scripts()[0]?.src).toBe('https://app.agentaos.ai/v1/agentaos.js');

		scriptLoads();

		await expect(first).resolves.toBe(FAKE);
		await expect(second).resolves.toBe(FAKE);
	});

	it('reuses AgentaOS already on the page (a script tag added by hand)', async () => {
		window.AgentaOS = FAKE;

		await expect(loadAgentaOS()).resolves.toBe(FAKE);
		expect(scripts()).toHaveLength(0);
	});

	it('loads from another origin while developing, trailing slash or not', () => {
		void loadAgentaOS({ origin: 'http://localhost:3000/' });

		expect(scripts()[0]?.src).toBe('http://localhost:3000/v1/agentaos.js');
	});

	it('says in a sentence when the script cannot load, and a later call tries again', async () => {
		const first = loadAgentaOS();
		scripts()[0]?.dispatchEvent(new Event('error'));

		await expect(first).rejects.toThrow(
			/the checkout script didn't load from https:\/\/app\.agentaos\.ai\/v1\/agentaos\.js/,
		);
		expect(scripts()).toHaveLength(0);

		const second = loadAgentaOS();
		expect(scripts()).toHaveLength(1);
		scriptLoads();
		await expect(second).resolves.toBe(FAKE);
	});

	it('rejects when the file loads but is not the checkout script', async () => {
		const loading = loadAgentaOS();
		scriptLoads(false);

		await expect(loading).rejects.toThrow(/didn't load/);
	});
});
