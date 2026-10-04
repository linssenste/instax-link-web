import { mount } from '@vue/test-utils';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { cssOf } from '../css';

// the queue card reaches the download module, which pulls in Konva
vi.mock('konva', async () => ({ default: (await import('../polaroid/konva.mock')).konvaMock }));

import PrinterConnection from '../../printer/PrinterConnection.vue';
import PrinterStatusCard from '../../printer/PrinterStatusCard.vue';
// import StatusAlerts from '../../printer/StatusAlerts.vue';
// import QueueElement from '../../printer/QueueElement.vue';
import { InstaxFilmVariant } from '../../../interfaces/PrinterStateConfig';
import { nextTick } from 'vue';

describe('YourComponent', () => {
	let wrapper;
	const mockStatus = {
		type: InstaxFilmVariant.SQUARE,
		polaroidCount: 8,
		battery: {
			level: 75,
			charging: false
		}
	}
	const mockConfig = {
		type: InstaxFilmVariant.SQUARE,
		connection: false,
		connect: vi.fn(),
		disconnect: vi.fn(),
		status: null
	};
	const mockQueue = [
		// Populate with mock queue elements as needed
	];

	beforeEach(async () => {
		wrapper = mount(PrinterConnection, {
			props: { config: mockConfig, queue: mockQueue },
			global: {
				stubs: {
					PrinterStatusCard: true,
					StatusAlerts: true,
					QueueElement: true,
					// the help dialog teleports, so it is rendered in place to be found
					teleport: true
				}
			}
		});

		// enable bluetooth api flag for testing purposes
		wrapper.vm.hasBluetoothAccess = true;
		await nextTick()
	});

	describe('Initial Rendering', () => {

		it('mounts the component', () => {
			expect(wrapper.exists()).toBe(true);
		});
		
		it('renders the connect button', () => {
			const button = wrapper.find('[data-testid="connect-printer-button"]');
			expect(button.exists()).toBe(true);
		});

		it('disables connection button and renders text underneath if no bluetooth API access is detected', async () => {

			expect(wrapper.find('[data-testid="no-support-text"]').exists()).toBe(false);
			wrapper.vm.hasBluetoothAccess = false;

			await nextTick()

			const button = wrapper.find('[data-testid="connect-printer-button"]');

			expect(button.exists()).toBe(true);
			expect(button.element.disabled).toBe(true);
			expect(wrapper.vm.hasBluetoothAccess).toBe(false)

			expect(wrapper.find('[data-testid="no-support-text"]').exists()).toBe(true);
		});


		it('renders connect button when printer is not connected', async () => {
			expect(wrapper.vm.hasBluetoothAccess).toBe(true)
			expect(wrapper.find('[data-testid="connect-printer-button"]').exists()).toBe(true);
		});

		it('renders connected printer info when printer is connected', async () => {
			await wrapper.setProps({ config: { ...mockConfig, connection: true } });
			expect(wrapper.find('[data-testid="connected-printer"]').exists()).toBe(true);
		});
	});


	describe('Interactions', () => {
		it('calls connect function when connect button is clicked', async () => {
			await wrapper.find('[data-testid="connect-printer-button"]').trigger('click');
			expect(mockConfig.connect).toHaveBeenCalled();
		});
	});


	describe('Connection Status ', () => {
		it('passes config prop correctly to PrinterStatusCard', async () => {
			const connectedConfig = { ...mockConfig, connection: true, status: mockStatus }
			await wrapper.setProps({ config: connectedConfig });

			const statusCard = wrapper.findComponent(PrinterStatusCard);

			expect(statusCard.exists()).toBe(true)

			expect(statusCard.props('config')).toEqual(connectedConfig);
		});

	});

	describe('Connecting', () => {
		const mountWith = (config = {}, queue = []) => mount(PrinterConnection, {
			props: {
				config: { type: InstaxFilmVariant.SQUARE, connection: false, disconnect: vi.fn(), status: null, ...config },
				queue
			},
			global: { stubs: { PrinterStatusCard: true, StatusAlerts: true, QueueElement: true } }
		});

		const connectButton = (w) => w.find('[data-testid="connect-printer-button"]');

		it('shows the device picker as pending while the attempt runs', async () => {
			let settle: () => void = () => { };
			const connect = vi.fn(() => new Promise<void>((resolve) => { settle = resolve }));
			const local = mountWith({ connect });

			await connectButton(local).trigger('click');
			await nextTick();

			expect(connect).toHaveBeenCalled();
			expect(connectButton(local).find('.button-spinner').exists()).toBe(true);
			expect(connectButton(local).attributes('disabled')).toBeDefined();
			expect(connectButton(local).text()).toBe('Connecting');

			settle();
			await nextTick();
			await nextTick();

			// the picker closed, so the button is offered again
			expect(connectButton(local).find('.button-spinner').exists()).toBe(false);
			expect(connectButton(local).text()).toBe('Connect');
		});

		it('stops pending when the picker is cancelled', async () => {
			// a cancelled picker rejects inside config.connect, which resolves anyway
			const connect = vi.fn(async () => { /* cancelled, handled upstream */ });
			const local = mountWith({ connect });

			await connectButton(local).trigger('click');
			await nextTick();
			await nextTick();

			expect(connectButton(local).find('.button-spinner').exists()).toBe(false);
			expect(connectButton(local).text()).toBe('Connect');
		});

		it('stops pending even when the attempt throws', async () => {
			const connect = vi.fn(async () => { throw new Error('no device') });
			const logged = vi.spyOn(console, 'error').mockImplementation(() => { });
			const local = mountWith({ connect });

			await connectButton(local).trigger('click');
			await nextTick();
			await nextTick();

			// the failure is contained, rather than escaping as an unhandled rejection
			expect(connectButton(local).find('.button-spinner').exists()).toBe(false);
			expect(logged).toHaveBeenCalled();
			logged.mockRestore();
		});

		it('does not start a second attempt while one is pending', async () => {
			const connect = vi.fn(() => new Promise<void>(() => { /* never settles */ }));
			const local = mountWith({ connect });

			await connectButton(local).trigger('click');
			await nextTick();
			await connectButton(local).trigger('click');

			expect(connect).toHaveBeenCalledTimes(1);
		});
	});

	describe('Print queue', () => {
		const mountWith = (queue) => mount(PrinterConnection, {
			props: {
				config: { ...mockConfig, connection: true, status: mockStatus },
				queue
			},
			global: { stubs: { PrinterStatusCard: true, StatusAlerts: true, QueueElement: true } }
		});

		it('holds no cards while nothing is queued', () => {
			// The box itself stays mounted. It used to be dropped the moment the count
			// reached zero, which destroyed a card that was still animating out - so
			// removing the last photo, which is most removals, never animated at all.
			// With no children it is zero height, so there is nothing to scroll.
			const empty = mountWith([]);

			expect(empty.find('.printing-queue').exists()).toBe(true);
			expect(empty.findAll('queue-element-stub')).toHaveLength(0);
		});

		it('is rendered once something is queued', () => {
			const queued = mountWith([{ base64: 'x', state: 0, quantity: 1, progress: 0 }]);

			expect(queued.find('.printing-queue').exists()).toBe(true);
			expect(queued.findAll('queue-element-stub')).toHaveLength(1);
		});

		it('measures a card before it leaves, so the collapse has a height to run from', () => {
			// `height: auto` is not something CSS can animate away from, and only the
			// element knows what it is
			const wrapper = mountWith([{ base64: 'x', state: 0, quantity: 1, progress: 0 }]);
			const card = wrapper.find('queue-element-stub').element as HTMLElement;

			vi.spyOn(card, 'getBoundingClientRect').mockReturnValue({ height: 123 } as DOMRect);

			const remember = (wrapper.vm as unknown as { rememberCardHeight: (el: Element) => void })
				.rememberCardHeight;
			expect(remember, 'the leave hook is gone').toBeTypeOf('function');
			remember(card);

			expect(card.style.getPropertyValue('--card-height')).toBe('123px');
		});
	});

	describe('The help button', () => {
		it('sits beside the connect button', () => {
			const row = wrapper.find('.connect-row');

			expect(row.find('[data-testid="connect-printer-button"]').exists()).toBe(true);
			expect(row.find('[data-testid="open-help-button"]').exists()).toBe(true);
		});

		it('is a named button, with the mark out of its name', () => {
			const help = wrapper.find('[data-testid="open-help-button"]');

			expect(help.element.tagName).toBe('BUTTON');
			expect(help.attributes('type')).toBe('button');
			expect(help.attributes('aria-label')).toBe('About this app');
			expect(help.find('span').attributes('aria-hidden')).toBe('true');
		});

		it('keeps the dialog shut until it is pressed', async () => {
			expect(wrapper.find('[data-testid="help-dialog"]').exists()).toBe(false);

			await wrapper.find('[data-testid="open-help-button"]').trigger('click');

			expect(wrapper.find('[data-testid="help-dialog"]').exists()).toBe(true);
		});

		it('closes again when the dialog asks to be closed', async () => {
			await wrapper.find('[data-testid="open-help-button"]').trigger('click');
			await wrapper.find('[data-testid="help-done"]').trigger('click');

			expect(wrapper.find('[data-testid="help-dialog"]').exists()).toBe(false);
		});
	});

	describe('the print queue', () => {
		const queued = (count: number) => Array.from({ length: count }, (_, index) => ({
			id: index + 1,
			base64: 'data:image/jpeg;base64,photo',
			thumbnail: 'data:image/jpeg;base64,thumb',
			quantity: 1, state: 0, progress: 0, type: InstaxFilmVariant.SQUARE
		}));

		const mountWithQueue = (count: number) => mount(PrinterConnection, {
			props: {
				config: { ...mockConfig, connection: true, status: mockStatus },
				queue: queued(count)
			},
			global: { stubs: { QueueElement: true, PrinterStatusCard: true, StatusAlerts: true } }
		});

		it('keys each card to its photo, so a removal can be animated', async () => {
			// an index key makes Vue reuse the card for whatever slides up into the
			// slot, which both leaks that card's state and gives it nothing to animate
			const wrapper = mountWithQueue(3);

			expect(wrapper.findAll('queue-element-stub')).toHaveLength(3);
		});

		it('passes the photo id up when a card asks to be removed', async () => {
			const wrapper = mountWithQueue(3);
			const cards = wrapper.findAllComponents({ name: 'QueueElement' });

			await cards[1].vm.$emit('cancel');

			expect(wrapper.emitted('cancel')).toEqual([[2]]);
		});

		it('passes the photo id up with a change of copies', async () => {
			const wrapper = mountWithQueue(2);
            const cards = wrapper.findAllComponents({ name: 'QueueElement' });

			await cards[0].vm.$emit('quantity-change', 4);

			expect(wrapper.emitted('quantity-change')).toEqual([[1, 4]]);
		});
	})

	describe('a queue with no printer', () => {
		const offline = (count: number) => mount(PrinterConnection, {
			props: {
				config: { ...mockConfig, connection: false },
				queue: Array.from({ length: count }, (_, index) => ({
					id: index + 1, base64: 'x', thumbnail: 'x', state: 0,
					progress: 0, quantity: 1, type: InstaxFilmVariant.SQUARE
				}))
			},
			global: { stubs: { QueueElement: true, HelpDialog: true } }
		});

		it('says nothing when there is nothing waiting', () => {
			expect(offline(0).find('[data-testid="offline-queue-toggle"]').exists()).toBe(false);
		});

		it('counts what is waiting under the connect button', () => {
			expect(offline(5).find('[data-testid="offline-queue-toggle"]').text()).toContain('5 images waiting');
		});

		it('counts one photo in the singular', () => {
			expect(offline(1).find('[data-testid="offline-queue-toggle"]').text()).toContain('1 image waiting');
		});

		it('keeps the queue folded away until it is asked for', () => {
			const wrapper = offline(3);

			expect(wrapper.find('.printing-queue').exists()).toBe(false);
			expect(wrapper.find('[data-testid="offline-queue-toggle"]').attributes('aria-expanded')).toBe('false');
		});

		it('opens and closes on the toggle', async () => {
			const wrapper = offline(3);
			const toggle = wrapper.find('[data-testid="offline-queue-toggle"]');

			await toggle.trigger('click');
			expect(wrapper.find('.printing-queue').exists()).toBe(true);
			expect(wrapper.findAll('queue-element-stub')).toHaveLength(3);
			expect(toggle.attributes('aria-expanded')).toBe('true');

			await toggle.trigger('click');
			expect(wrapper.find('.printing-queue').exists()).toBe(false);
		});

		it('lets a photo be edited and dropped while it is open', async () => {
			const wrapper = offline(2);
			await wrapper.find('[data-testid="offline-queue-toggle"]').trigger('click');

			const cards = wrapper.findAllComponents({ name: 'QueueElement' });
			await cards[1].vm.$emit('cancel');
			await cards[0].vm.$emit('quantity-change', 3);

			expect(wrapper.emitted('cancel')).toEqual([[2]]);
			expect(wrapper.emitted('quantity-change')).toEqual([[1, 3]]);
		});

		it('folds itself away once the last photo has gone', async () => {
			// otherwise it would reopen to an empty box the next time something queued
			const wrapper = offline(1);
			await wrapper.find('[data-testid="offline-queue-toggle"]').trigger('click');
			expect(wrapper.find('.printing-queue').exists()).toBe(true);

			await wrapper.setProps({ queue: [] });

            expect(wrapper.find('.printing-queue').exists()).toBe(false);
		});
	})

	describe('the panel width', () => {
		const panelCss = cssOf('src/components/printer/PrinterConnection.vue');
		const cardCss = cssOf('src/components/printer/PrinterStatusCard.vue');

		it('is fixed, so nothing inside moves when the contents change', () => {
			// it used to size to its contents, so connecting - or opening the queue
			// while disconnected - changed the width of the connect button with it
			expect(panelCss('#printer-settings')).toContain('width: var(--printer-panel-width)');
		});

		it('is the one place the width is set', () => {
			// the status card used to carry its own 300px, which is what the queue and
			// the connect row were then measured against
			const card = cardCss('.connection-box');

			expect(card).toContain('width: 100%');
			expect(card).not.toMatch(/width:\s*\d+px/);
		});

		it('lets the queue reach past it for its scrollbar, and no further', () => {
			expect(panelCss('.printing-queue')).toContain('calc(100% + var(--panel-inset))');
		});

		it('puts the waiting count against the right edge', () => {
			expect(panelCss('.queue-summary')).toContain('justify-content: flex-end');
		});

		it('does not stretch the connect button to fill it', () => {
			// the panel holds a fixed width so the queue cards match the connected
			// ones; the button sizing itself to that made it absurdly long
			expect(panelCss('.connect-row .connect-button')).toContain('flex: 0 0 auto');
			expect(panelCss('.connect-row')).toContain('width: auto');
		});

		it('keeps the connect row against the right edge, where the panel is', () => {
			expect(panelCss('.printer-connection')).toContain('align-items: flex-end');
		});
	})
});
