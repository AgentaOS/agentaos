import { useCallback, useEffect, useRef } from 'react';
import { loadAgentaOS } from './load.js';
import type { CheckoutEvent, CheckoutHandle, CheckoutSource, OpenOptions } from './types.js';

export type AgentaOSCheckoutProps = CheckoutSource & {
	email?: string;
	country?: string;
	successUrl?: string | false;
	onEvent?: (event: CheckoutEvent) => void;
	/** The AgentaOS app origin; leave out in production (see `loadAgentaOS`). */
	origin?: string;
	className?: string;
};

/**
 * The checkout inline, where this component sits. Changing `link` or `session` switches the
 * open checkout (e.g. a Monthly/Yearly toggle); unmounting removes it.
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
		loadAgentaOS({ origin }).then((agentaos) => {
			if (cancelled || !agentaos || !container.current) return;
			handle.current = agentaos.checkout.open({
				...sourceRef.current,
				target: container.current,
				email,
				country,
				successUrl,
				onEvent: (event) => onEventRef.current?.(event),
			} as OpenOptions);
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

/** The overlay: `open()` shows the checkout over the page, e.g. from a Buy button. */
export function useAgentaOSCheckout({ origin }: { origin?: string } = {}) {
	const handle = useRef<CheckoutHandle | null>(null);

	useEffect(() => () => handle.current?.close(), []);

	const open = useCallback(
		async (options: Omit<OpenOptions, 'target'>): Promise<CheckoutHandle | null> => {
			const agentaos = await loadAgentaOS({ origin });
			if (!agentaos) return null;
			handle.current?.close();
			handle.current = agentaos.checkout.open(options as OpenOptions);
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
