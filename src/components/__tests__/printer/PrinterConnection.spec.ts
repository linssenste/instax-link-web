import { mount } from '@vue/test-utils';
import { describe, it, expect, beforeEach, vi } from 'vitest';

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

		it('is not rendered while nothing is queued, so it cannot show empty scrollbars', () => {
			expect(mountWith([]).find('.printing-queue').exists()).toBe(false);
		});

		it('is rendered once something is queued', () => {
			const queued = mountWith([{ base64: 'x', state: 0, quantity: 1, progress: 0 }]);

			expect(queued.find('.printing-queue').exists()).toBe(true);
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
});
