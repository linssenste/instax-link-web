import { mount } from '@vue/test-utils';
import { describe, it, expect, beforeEach, vi } from 'vitest';

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
					QueueElement: true
				}
			}
		});

		// enable bluetooth api flag for testing purposes
		wrapper.vm.hasBluetoothAccess = true;
		await nextTick()
	});

	describe('Initial Rendering', () => {

		it('renders nothing if no bluetooth API access is detected', async () => {
			wrapper.vm.hasBluetoothAccess = false;
			await nextTick()

			expect(wrapper.vm.hasBluetoothAccess).toBe(false)
			expect(wrapper.find('[data-testid="connect-printer-button"]').exists()).toBe(false);
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
});
