import { defineConfig } from 'vitest/config';

/**
 * `@cloudflare/workers-oauth-provider` imports `cloudflare:workers`, which only
 * exists inside workerd. The tests run on Node, so that one import is aliased
 * to a stub and the provider is inlined so the alias reaches it.
 */
export default defineConfig({
	resolve: {
		alias: {
			'cloudflare:workers': new URL('./src/__tests__/cloudflare-workers.stub.ts', import.meta.url)
				.pathname,
		},
	},
	test: {
		server: { deps: { inline: ['@cloudflare/workers-oauth-provider'] } },
	},
});
