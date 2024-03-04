import { mount } from '@vue/test-utils'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import ImageSettings from '../../polaroid/ImageSettings.vue' // Update the path as necessary
import { InstaxFilmVariant } from '../../../interfaces/PrinterStateConfig'

describe('ImageSettings Component', () => {
	let wrapper

	const mountComponentWithProps = (propsData = {}) => {
		wrapper = mount(ImageSettings, {
			props: {
				config: {
					connection: false, // default to no printer connected
					type: InstaxFilmVariant.SQUARE, // default type
					...propsData.config // override defaults if provided
				},
				savePolaroid: vi.fn(), // Mock the savePolaroid function
				queueLength: 0, // default queue length
				...propsData // override other props if provided
			}
		});
	};

	beforeEach(() => {
		mountComponentWithProps();
	});

	describe('Caption Input', () => {
		it('is visible when no printer is connected', () => {
			expect(wrapper.find('[data-testid="caption-input"]').isVisible()).toBe(true);
		});

		it('is bound to settings.text with v-model', async () => {
			const input = wrapper.find('[data-testid="caption-input"]');
			await input.setValue('New Caption');
			expect(input.element.value).toBe('New Caption');
		});

		it('has a maxlength based on the config.type prop', async () => {
			await wrapper.setProps({
				config: { type: InstaxFilmVariant.MINI }
			});
			expect(wrapper.find('[data-testid="caption-input"]').attributes('maxlength')).toBe('18');
		});

		it('updates caption maxlength when config.type changes', async () => {
			await wrapper.setProps({ config: { type: InstaxFilmVariant.LARGE } });
			expect(wrapper.find('[data-testid="caption-input"]').attributes('maxlength')).toBe('35');
		});
	});

	describe('Rotation Controls', () => {
		it('updates rotation on clockwise button click', async () => {
			const button = wrapper.find('[data-testid="rotate-clockwise-button"]');
			await button.trigger('click');
			expect(wrapper.vm.settings.rotation).toBe(359);

			await button.trigger('click');
			expect(wrapper.vm.settings.rotation).toBe(358);
		});

		it('updates rotation on counter-clockwise button click', async () => {
			const button = wrapper.find('[data-testid="rotate-counter-clockwise-button"]');
			await button.trigger('click');
			expect(wrapper.vm.settings.rotation).toBe(1);
		});

		it('rotation input is bound to settings.rotation with v-model', async () => {
			const input = wrapper.find('[data-testid="rotation-input"]');
			await input.setValue('90');
			expect(wrapper.vm.settings.rotation).toBe(90);
		});

		it('corrects values greater than 360', async () => {
			const input = wrapper.find('[data-testid="rotation-input"]');
			await input.setValue('370');
			await input.trigger('keyup.enter');
			expect(wrapper.vm.settings.rotation).toBe(10); // Assuming it wraps around
		});

		it('corrects negative values', async () => {
			const input = wrapper.find('[data-testid="rotation-input"]');
			await input.setValue('-10');
			await input.trigger('keyup.enter');
			expect(wrapper.vm.settings.rotation).toBe(350); // Assuming it wraps around
		});

		it('adjusts rotation to within 0-360 range on enter key', async () => {
			const input = wrapper.find('[data-testid="rotation-input"]');
			await input.setValue('361');
			await input.trigger('keyup.enter');
			expect(wrapper.vm.settings.rotation).toBe(1); // Assuming it wraps around for values > 360

			await input.setValue('-1');
			await input.trigger('keyup.enter');
			expect(wrapper.vm.settings.rotation).toBe(359); // Assuming it wraps around for negative values
		});
	});



	describe('Color Selector', () => {
		it('is bound to settings.color with v-model', async () => {
			const input = wrapper.find('[data-testid="color-selector-input"]');
			await input.setValue('#ff0000');
			expect(wrapper.vm.settings.color).toBe('#ff0000');
		});
	});

	describe('Alignment Buttons', () => {
		it('emits scale event with "horizontal" on horizontal align button click', async () => {
			const button = wrapper.find('[data-testid="align-horizontal-button"]');
			await button.trigger('click');
			expect(wrapper.emitted('scale')[0]).toEqual(['horizontal']);
		});

		it('emits scale event with "vertical" on vertical align button click', async () => {
			const button = wrapper.find('[data-testid="align-vertical-button"]');
			await button.trigger('click');
			expect(wrapper.emitted('scale')[0]).toEqual(['vertical']);
		});
	});


	describe('Action Buttons', () => {
		it('shows print button when a printer is connected', async () => {
			await wrapper.setProps({
				config: { connection: true }
			});
			expect(wrapper.find('[data-testid="print-image-button"]').exists()).toBe(true);
		});

		it('shows download button when no printer is connected', () => {
			expect(wrapper.find('[data-testid="download-image-button"]').exists()).toBe(true);
		});

		it('calls savePolaroid function on download button click', async () => {
			const button = wrapper.find('[data-testid="download-image-button"]');
			await button.trigger('click');
			expect(wrapper.props().savePolaroid).toHaveBeenCalled();
		});
	});



	describe('Computed Properties', () => {
		it('calculates awaitingQueue style correctly based on queueLength', async () => {
			await wrapper.setProps({ queueLength: 3 });
			expect(wrapper.vm.awaitingQueue).toContain('opacity: .2');
		});
	});

	describe('Emitting Change Event on Settings Update', () => {
		it('emits change event when settings are updated', async () => {
			const input = wrapper.find('[data-testid="rotation-input"]');
			await input.setValue('45');
			expect(wrapper.emitted()).toHaveProperty('change');
			const emittedEvent = wrapper.emitted('change');
			expect(emittedEvent[emittedEvent.length - 1]).toEqual([{ rotation: 45, color: '#FFFFFF', text: '' }]);
		});
	});
});
