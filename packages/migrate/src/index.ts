import { readCreem } from './sources/creem.js';
import { readGumroad } from './sources/gumroad.js';
import { readLemonSqueezy } from './sources/lemonsqueezy.js';
import { readPaddle } from './sources/paddle.js';
import type { Catalog, SourceName } from './types.js';

export { applyPlan } from './apply.js';
export type { ApplyOptions, ApplyResult, CreatedPlan, Failure } from './apply.js';
export { buildPlan } from './plan.js';
export type { MigrationPlan, PlannedDiscount, PlannedPlan } from './plan.js';
export { writeReport } from './report.js';
export * from './types.js';

/** The environment variable each source reads its key from. */
export const SOURCE_KEY_ENV: Record<SourceName, string> = {
	paddle: 'PADDLE_API_KEY',
	lemonsqueezy: 'LEMONSQUEEZY_API_KEY',
	creem: 'CREEM_API_KEY',
	gumroad: 'GUMROAD_ACCESS_TOKEN',
};

export interface ReadOptions {
	/** Paddle sandbox or Creem test mode. */
	test?: boolean;
}

/** Reads the old account. Only GET requests; nothing there changes. */
export function readSource(
	source: SourceName,
	apiKey: string,
	options: ReadOptions = {},
): Promise<Catalog> {
	switch (source) {
		case 'paddle':
			return readPaddle(apiKey, options.test);
		case 'lemonsqueezy':
			return readLemonSqueezy(apiKey);
		case 'creem':
			return readCreem(apiKey, options.test);
		case 'gumroad':
			return readGumroad(apiKey);
	}
}
