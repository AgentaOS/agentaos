'use client';

import { useCallback, useEffect, useRef } from 'react';
import { loadAgentaOS } from './load.js';
import type {
	CheckoutBehaviour,
	CheckoutEvent,
	CheckoutHandle,
	CheckoutSource,
	OpenOptions,
} from './types.js';

export type AgentaOSCheckoutProps = CheckoutSource & {
	/** Prefill; read when the checkout opens. */
	email?: string;
	/** Prefill (ISO country code); read when the checkout opens. */
	country?: string;
	/** Read when the checkout opens; switching `link` later does not change it. */
	successUrl?: string | false;
	onEvent?: (event: CheckoutEvent) => void;
	/** The AgentaOS app origin; leave out in production (see `loadAgentaOS`). */
	origin?: string;
	className?: string;
};

/** What the overlay opens with: exactly one of `link` or `session`, never a `target`. */
export type OverlayOptions = CheckoutSource & Omit<CheckoutBehaviour, 'target'>;

/**
 * The checkout inline, where this component sits. Changing `link` or `session` switches the
 * open checkout (e.g. a Monthly/Yearly toggle); unmounting removes it. If the checkout script
 * cannot load, `onEvent` hears `checkout.error` with `code: 'not_loaded'`.
 */
export function AgentaOSCheckout({
	link,
	session,
	email,
	country,
	successUrl,
	onEvent,
	origin,
	className,
}: AgentaOSCheckoutProps) {
	const container = useRef<HTMLDivElement>(null);
	const handle = useRef<CheckoutHandle | null>(null);
	// The latest callback, without reopening the checkout whenever a parent re-renders.
	const onEventRef = useRef(onEvent);
	onEventRef.current = onEvent;
	const source = sourceOf(link, session);
	// The latest product, so a switch made while the script is still loading is not lost.
	const sourceRef = useRef(source);
	sourceRef.current = source;

	// Opens once per origin; later product switches go through update(). Prefill is a one-time hint.
	// biome-ignore lint/correctness/useExhaustiveDependencies: opening again on every prop change would reset the buyer's form
	useEffect(() => {
		let cancelled = false;
		loadAgentaOS({ origin })
			.then((agentaos) => {
				if (cancelled || !agentaos || !container.current) return;
				handle.current = agentaos.checkout.open({
					...sourceRef.current,
					target: container.current,
					email,
					country,
					successUrl,
					onEvent: (event) => onEventRef.current?.(event),
				} as OpenOptions);
			})
			.catch((error: Error) => {
				if (cancelled) return;
				onEventRef.current?.({
					name: 'checkout.error',
					data: { code: 'not_loaded', message: error.message },
				});
			});
		return () => {
			cancelled = true;
			handle.current?.close();
			handle.current = null;
		};
	}, [origin]);

	// biome-ignore lint/correctness/useExhaustiveDependencies: keyed on the product itself, not the object identity
	useEffect(() => {
		handle.current?.update(sourceRef.current);
	}, [source.link, source.session]);

	return <div ref={container} className={className} />;
}

/**
 * The overlay: `open()` shows the checkout over the page, e.g. from a Buy button. The overlay
 * lives as long as the component that called this hook: unmounting it closes the overlay, even
 * mid-payment, and `onEvent` then hears `checkout.closed`.
 */
export function useAgentaOSCheckout({ origin }: { origin?: string } = {}) {
	const handle = useRef<CheckoutHandle | null>(null);
	const mounted = useRef(true);

	useEffect(() => {
		mounted.current = true;
		return () => {
			mounted.current = false;
			handle.current?.close();
			handle.current = null;
		};
	}, []);

	const open = useCallback(
		async (options: OverlayOptions): Promise<CheckoutHandle | null> => {
			const agentaos = await loadAgentaOS({ origin });
			// The component that asked may be gone by the time the script arrives.
			if (!agentaos || !mounted.current) return null;
			handle.current?.close();
			handle.current = agentaos.checkout.open(options);
			return handle.current;
		},
		[origin],
	);

	return { open };
}

function sourceOf(link: string | undefined, session: string | undefined): CheckoutSource {
	if (link) return { link };
	if (session) return { session };
	throw new Error('AgentaOSCheckout: pass `link` or `session`.');
}
