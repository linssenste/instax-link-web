import { mount } from '@vue/test-utils';
import { describe, it, expect, beforeEach, vi } from 'vitest';

import PrinterStatusCard from '../../../components/printer/PrinterStatusCard.vue';
import { InstaxFilmVariant } from '../../../interfaces/PrinterStateConfig';
import { nextTick } from 'vue';

describe('PrinterStatusCard Component', () => {
	let wrapper;
	const mockConfig = {
		type: InstaxFilmVariant.SQUARE,

		connection: true,
		connect: null,
		disconnect: null,

		status: {
			type: InstaxFilmVariant.SQUARE,
			polaroidCount: 8,
			battery: {
				level: 75,
				charging: false
			}
		}
	};

	beforeEach(() => {
		wrapper = mount(PrinterStatusCard, {
			props: { config: mockConfig }
		});
	});

	describe('Component Rendering', () => {
		it('displays printer name and type', () => {
			expect(wrapper.find('[data-testid="printer-name"]').text()).toContain('instax square');
		});

		it('displays correct polaroid count', () => {
			expect(wrapper.find('[data-testid="printer-polaroid-count"]').text()).toContain('8/10');
		});

		it('shows correct battery level and icon', () => {
			expect(wrapper.find('[data-testid="printer-battery-level"]').text()).toContain('75%');
			expect(wrapper.find('[data-testid="printer-battery-level"] img').attributes('src')).toContain('battery-75.svg');
		});

		it('shows connecting text when config status is null', async () => {
			await wrapper.setProps({ config: { status: null } });
			expect(wrapper.find('[data-testid="printer-connecting-text"]').text()).toContain('Connecting....');
		});
	});

	describe('User Interactions', () => {
		it('calls disconnect function when disconnect button is clicked', async () => {
			const disconnectSpy = vi.fn();
			await wrapper.setProps({
				config: {
					...mockConfig,
					disconnect: disconnectSpy
				}
			});
			await wrapper.find('[data-testid="disconnect-printer-button"]').trigger('click');
			expect(disconnectSpy).toHaveBeenCalled();
		});
	});

	describe('Computed Properties', () => {
		it('calculates printer type correctly', () => {
			const printerType = wrapper.vm.printerType;
			expect(printerType).toBe(InstaxFilmVariant.SQUARE);
		});

		it('calculates battery icon correctly', () => {
			const batteryIcon = wrapper.vm.batteryIcon;
			expect(batteryIcon).toBe(75);
		});
	});


	describe('Battery level status', () => {
		it('displays charging icon and text when battery is charging', async () => {
			await wrapper.setProps({
				config: {
					...mockConfig,
					status: {
						...mockConfig.status,
						battery: {
							level: 50,
							charging: true
						}
					}
				}
			});
			await nextTick()
			expect(wrapper.find('[data-testid="printer-battery-level"] img').attributes('src')).toContain('battery-charging.svg');
			expect(wrapper.find('[data-testid="printer-battery-charging-text"]').text()).toContain('POWER');


		});

		it('displays correct icon for 0% battery level', async () => {
			await wrapper.setProps({
				config: {
					...mockConfig,
					status: {
						...mockConfig.status,
						battery: {
							level: 0,
							charging: false
						}
					}
				}
			});
			expect(wrapper.find('[data-testid="printer-battery-level"] img').attributes('src')).toContain('battery-0.svg');
		});

		it('displays correct icon for 100% battery level', async () => {
			await wrapper.setProps({
				config: {
					...mockConfig,
					status: {
						...mockConfig.status,
						battery: {
							level: 100,
							charging: false
						}
					}
				}
			});
			expect(wrapper.find('[data-testid="printer-battery-level"] img').attributes('src')).toContain('battery-100.svg');
		});


		it('maintains charging icon and text when battery level increases but is still charging', async () => {
			await wrapper.setProps({
				config: {
					...mockConfig,
					status: {
						...mockConfig.status,
						battery: {
							level: 25,
							charging: true
						}
					}
				}
			});
			await wrapper.setProps({
				config: {
					...mockConfig,
					status: {
						...mockConfig.status,
						battery: {
							level: 50,
							charging: true
						}
					}
				}
			});
			expect(wrapper.find('[data-testid="printer-battery-level"] img').attributes('src')).toContain('battery-charging.svg');
			expect(wrapper.find('[data-testid="printer-battery-charging-text"]').text()).toContain('POWER');
		});


		it('updates to non-charging state correctly when battery stops charging', async () => {
			await wrapper.setProps({
				config: {
					...mockConfig,
					status: {
						...mockConfig.status,
						battery: {
							level: 50,
							charging: true
						}
					}
				}
			});
			await wrapper.setProps({
				config: {
					...mockConfig,
					status: {
						...mockConfig.status,
						battery: {
							level: 60,
							charging: false
						}
					}
				}
			});
			expect(wrapper.find('[data-testid="printer-battery-level"] img').attributes('src')).not.toContain('battery-charging.svg');
			expect(wrapper.find('[data-testid="printer-battery-charging-text"]').exists()).toBe(false);
			expect(wrapper.find('[data-testid="printer-battery-level"]').text()).toContain('60%');
		});
	});
});
