import { mount } from '@vue/test-utils'
import { describe, it, expect, beforeEach } from 'vitest'
import StatusAlerts from '../../../components/printer/StatusAlerts.vue'
import { InstaxFilmVariant } from '../../../interfaces/PrinterStateConfig'

describe('StatusAlerts Component', () => {
	let wrapper

	const mountComponent = (propsData) => {
		wrapper = mount(StatusAlerts, {
			props: propsData
		});
	};

	describe('when polaroid count is 0', () => {
		beforeEach(() => {
			mountComponent({
				status: {
					type: InstaxFilmVariant.SQUARE,
					battery: {
						charging: false,
						level: 50
					},
					polaroidCount: 0
				}
			});
		});

		it('should display no polaroids left alert', () => {
			const polaroidAlert = wrapper.find('[data-testid="polaroid-count-status"]');
			expect(polaroidAlert.exists()).toBe(true);
			expect(polaroidAlert.text()).toContain('Insert new Polaroids');
		});

		it('should not display the recharge battery alert', () => {
			const batteryAlert = wrapper.find('[data-testid="battery-status"]');
			expect(batteryAlert.exists()).toBe(false);
		});
	});

	describe('when both conditions are okay', () => {
		beforeEach(() => {
			mountComponent({
				status: {
					battery: { charging: false, level: 50 },
					polaroidCount: 5
				}
			});
		});

		it('should not display any alerts', () => {
			expect(wrapper.find('[data-testid="polaroid-count-status"]').exists()).toBe(false);
			expect(wrapper.find('[data-testid="battery-status"]').exists()).toBe(false);
		});
	});


	describe('when battery level is <= 10 and not charging', () => {
		beforeEach(() => {
			mountComponent({
				status: {
					type: InstaxFilmVariant.SQUARE,
					battery: {
						charging: false,
						level: 10
					},
					polaroidCount: 10
				}
			});
		});

		it('should display recharge battery alert', () => {
			const batteryAlert = wrapper.find('[data-testid="battery-status"]');
			expect(batteryAlert.exists()).toBe(true);
			expect(batteryAlert.text()).toContain('Recharge battery');
		});


		it('should not display the polaroids count alert', () => {
			const polaroidAlert = wrapper.find('[data-testid="polaroid-count-status"]');
			expect(polaroidAlert.exists()).toBe(false);
		});
	});

	describe('when both polaroid count is 0 and battery level is <= 10', () => {
		beforeEach(() => {
			mountComponent({
				status: {
					type: InstaxFilmVariant.SQUARE,
					battery: {
						charging: false,
						level: 10
					},
					polaroidCount: 0
				}
			});
		});

		it('should display both alerts', () => {
			const polaroidAlert = wrapper.find('[data-testid="polaroid-count-status"]');
			const batteryAlert = wrapper.find('[data-testid="battery-status"]');
			expect(polaroidAlert.exists()).toBe(true);
			expect(batteryAlert.exists()).toBe(true);
		});
	});


	describe('when data is initially null', () => {
		beforeEach(() => {
			mountComponent({
				status: {
					battery: { charging: null, level: null },
					polaroidCount: null
				}
			});
		});

		it('should not display any alerts', () => {
			expect(wrapper.find('[data-testid="polaroid-count-status"]').exists()).toBe(false);
			expect(wrapper.find('[data-testid="battery-status"]').exists()).toBe(false);
		});
	});

	describe('when polaroid count is sufficient and battery level is satisfactory', () => {
		beforeEach(() => {
			mountComponent({
				status: {
					type: InstaxFilmVariant.SQUARE,
					battery: {
						charging: false,
						level: 50
					},
					polaroidCount: 10
				}
			});
		});

		it('should not display any alerts', () => {
			const polaroidAlert = wrapper.find('[data-testid="polaroid-count-status"]');
			const batteryAlert = wrapper.find('[data-testid="battery-status"]');
			expect(polaroidAlert.exists()).toBe(false);
			expect(batteryAlert.exists()).toBe(false);
		});
	});


	describe('when the battery is charging', () => {
		beforeEach(() => {
			mountComponent({
				status: {
					battery: { charging: true, level: 5 },
					polaroidCount: 0 // This can trigger the polaroid alert but not the battery one
				}
			});
		});

		it('should not display the battery alert', () => {
			expect(wrapper.find('[data-testid="battery-status"]').exists()).toBe(false);
		});

		it('should display the polaroid alert', () => {
			const polaroidAlert = wrapper.find('[data-testid="polaroid-count-status"]');
			expect(polaroidAlert.exists()).toBe(true);
			expect(polaroidAlert.text()).toContain('Insert new Polaroids');
		});
	});

	describe('reactivity to prop changes', () => {
		beforeEach(() => {
			mountComponent({
				status: {
					battery: { charging: false, level: 10 },
					polaroidCount: 0
				}
			});

			// Simulate prop change
			wrapper.setProps({
				status: {
					battery: { charging: false, level: 50 },
					polaroidCount: 5
				}
			});
		});

		it('should update the component accordingly', () => {
			expect(wrapper.find('[data-testid="polaroid-count-status"]').exists()).toBe(false);
			expect(wrapper.find('[data-testid="battery-status"]').exists()).toBe(false);
		});
	});
});
