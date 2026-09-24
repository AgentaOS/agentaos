import type { AgentaOS } from './types.js';

/** Where the checkout script and the checkout itself are served from. */
export const DEFAULT_ORIGIN = 'https://app.agentaos.ai';

export interface LoadOptions {
	/**
	 * The AgentaOS app origin. Leave out in production. Point it at a local stack while
	 * developing, e.g. `http://localhost:3000`. Only the first load on a page counts: the script
	 * is loaded once, and later calls reuse it whatever origin they pass.
	 */
	origin?: string;
}

declare global {
	interface Window {
		AgentaOS?: AgentaOS;
	}
}

let loading: Promise<AgentaOS | null> | null = null;

/**
 * Loads `/v1/agentaos.js` once and resolves `window.AgentaOS`. On the server (no `window`) it
 * resolves `null`, so it is safe to call from code that also renders on the server.
 */
export function loadAgentaOS(options: LoadOptions = {}): Promise<AgentaOS | null> {
	if (typeof window === 'undefined') return Promise.resolve(null);
	if (window.AgentaOS) return Promise.resolve(window.AgentaOS);
	loading ??= injectScript(scriptUrl(options.origin ?? DEFAULT_ORIGIN)).catch((error: unknown) => {
		loading = null; // a later call may try again (e.g. after the network comes back)
		throw error;
	});
	return loading;
}

function scriptUrl(origin: string): string {
	return `${origin.replace(/\/+$/, '')}/v1/agentaos.js`;
}

function injectScript(src: string): Promise<AgentaOS> {
	return new Promise((resolve, reject) => {
		const script =
			document.querySelector<HTMLScriptElement>(`script[src="${src}"]`) ??
			document.createElement('script');
		const fail = () => {
			script.remove(); // so a later call inserts a fresh tag instead of waiting on a dead one
			reject(
				new Error(
					`AgentaOS: the checkout script didn't load from ${src}. Check the network, and that the origin is right.`,
				),
			);
		};
		script.addEventListener('load', () => (window.AgentaOS ? resolve(window.AgentaOS) : fail()));
		script.addEventListener('error', fail);
		if (!script.isConnected) {
			script.src = src;
			script.async = true;
			document.head.appendChild(script);
		}
	});
}

/** Test seam: forget a finished or failed load. */
export function resetForTests(): void {
	loading = null;
}
