// @vitest-environment jsdom
import { act } from 'react';
import { type Root, createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { resetForTests } from './load.js';
import { AgentaOSCheckout, useAgentaOSCheckout } from './react.js';
import type { CheckoutEvent, OpenOptions } from './types.js';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const MONTHLY = 'https://app.agentaos.ai/pay/monthly0000000000000A';
const YEARLY = 'https://app.agentaos.ai/pay/yearly00000000000000A';

let handle: { update: ReturnType<typeof vi.fn>; close: ReturnType<typeof vi.fn> };
let open: ReturnType<typeof vi.fn<(options: OpenOptions) => typeof handle>>;
let root: Root;
let host: HTMLDivElement;

beforeEach(() => {
	handle = { update: vi.fn(), close: vi.fn() };
	open = vi.fn(() => handle);
	window.AgentaOS = { checkout: { open } } as never;
	host = document.createElement('div');
	document.body.appendChild(host);
	root = createRoot(host);
});

afterEach(() => {
	act(() => root.unmount());
	host.remove();
	window.AgentaOS = undefined;
	resetForTests();
});

/** Renders and lets the loader's promise settle. */
async function render(node: React.ReactNode) {
	await act(async () => {
		root.render(node);
	});
}

describe('<AgentaOSCheckout>', () => {
	it('opens the checkout inline, into its own element, with the prefill', async () => {
		await render(
			<AgentaOSCheckout link={MONTHLY} email="ann@acme.com" country="DE" className="pay" />,
		);

		expect(open).toHaveBeenCalledTimes(1);
		const options = open.mock.calls[0]?.[0] as OpenOptions;
		expect(options).toMatchObject({ link: MONTHLY, email: 'ann@acme.com', country: 'DE' });
		expect(options.target).toBe(host.querySelector('div.pay'));
	});

	it('switches the open checkout when the product changes, without opening another', async () => {
		await render(<AgentaOSCheckout link={MONTHLY} />);
		await render(<AgentaOSCheckout link={YEARLY} />);

		expect(open).toHaveBeenCalledTimes(1);
		expect(handle.update).toHaveBeenCalledWith({ link: YEARLY });
	});

	it('passes events to the latest onEvent', async () => {
		const first = vi.fn();
		const latest = vi.fn();
		await render(<AgentaOSCheckout link={MONTHLY} onEvent={first} />);
		await render(<AgentaOSCheckout link={MONTHLY} onEvent={latest} />);

		const event: CheckoutEvent = { name: 'checkout.closed', data: {} };
		(open.mock.calls[0]?.[0] as OpenOptions).onEvent?.(event);

		expect(latest).toHaveBeenCalledWith(event);
		expect(first).not.toHaveBeenCalled();
	});

	it('removes the checkout when it unmounts', async () => {
		await render(<AgentaOSCheckout link={MONTHLY} />);
		act(() => root.render(null));

		expect(handle.close).toHaveBeenCalled();
	});

	it('opens a checkout your server created', async () => {
		await render(<AgentaOSCheckout session="cs_abc" />);

		expect(open.mock.calls[0]?.[0]).toMatchObject({ session: 'cs_abc' });
	});
});

describe('useAgentaOSCheckout', () => {
	function BuyButton() {
		const { open: openOverlay } = useAgentaOSCheckout();
		return (
			<button type="button" onClick={() => void openOverlay({ link: MONTHLY, successUrl: false })}>
				Buy
			</button>
		);
	}

	it('opens the overlay (no target) from a click', async () => {
		await render(<BuyButton />);

		await act(async () => {
			host.querySelector('button')?.click();
		});

		expect(open).toHaveBeenCalledWith({ link: MONTHLY, successUrl: false });
	});
});
