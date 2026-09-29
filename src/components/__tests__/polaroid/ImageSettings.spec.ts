import { mount } from '@vue/test-utils'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { nextTick } from 'vue'

import ImageSettings from '../../polaroid/ImageSettings.vue'

// ImageSettings covers how the image sits inside the frame. The caption is edited
// on the polaroid itself and the print/download actions live in the drawer footer,
// so neither is tested here.
describe('ImageSettings Component', () => {
	let wrapper

	const mountComponentWithProps = (propsData = {}) => {
		wrapper = mount(ImageSettings, { props: { hasImage: true, ...propsData } });
	};

	beforeEach(() => {
		mountComponentWithProps();
	});

	describe('Rotation Controls', () => {
		it('rotation input is bound to settings.rotation with v-model', async () => {
			const input = wrapper.find('[data-testid="rotation-input"]');
			await input.setValue('90');
			expect(wrapper.vm.settings.rotation).toBe(90);
		});

		it('corrects values greater than 360', async () => {
			const input = wrapper.find('[data-testid="rotation-input"]');
			await input.setValue('370');
			await input.trigger('keyup.enter');
			expect(wrapper.vm.settings.rotation).toBe(10);
		});

		it('corrects negative values', async () => {
			const input = wrapper.find('[data-testid="rotation-input"]');
			await input.setValue('-10');
			await input.trigger('keyup.enter');
			expect(wrapper.vm.settings.rotation).toBe(350);
		});

		it('adjusts rotation to within 0-360 range on enter key', async () => {
			const input = wrapper.find('[data-testid="rotation-input"]');
			await input.setValue('361');
			await input.trigger('keyup.enter');
			expect(wrapper.vm.settings.rotation).toBe(1);

			await input.setValue('-1');
			await input.trigger('keyup.enter');
			expect(wrapper.vm.settings.rotation).toBe(359);
		});

		it('wraps values more than one full turn out of range', async () => {
			const input = wrapper.find('[data-testid="rotation-input"]');

			for (const [entered, expected] of [['540', 180], ['720', 0], ['-370', 350]] as const) {
				await input.setValue(entered);
				await input.trigger('keyup.enter');
				expect(wrapper.vm.settings.rotation).toBe(expected);
			}
		});

		it('falls back to 0 for a cleared input', async () => {
			const input = wrapper.find('[data-testid="rotation-input"]');
			await input.setValue('90');
			await input.setValue('');
			await input.trigger('keyup.enter');
			expect(wrapper.vm.settings.rotation).toBe(0);
		});

		it('takes a quarter turn straight from the dial', async () => {
			await wrapper.find('[data-testid="rotate-snap-270"]').trigger('click');

			expect(wrapper.vm.settings.rotation).toBe(270);
		});
	});

	describe('Resetting image bound settings', () => {
		it('clears the rotation shortly after the image is removed', async () => {
			vi.useFakeTimers();
			mountComponentWithProps({ hasImage: true });

			await wrapper.find('[data-testid="rotation-input"]').setValue('90');
			await wrapper.find('[data-testid="color-selector-input"]').setValue('#ff0000');

			await wrapper.setProps({ hasImage: false });
			vi.advanceTimersByTime(500);
			await nextTick();

			expect(wrapper.vm.settings.rotation).toBe(0);
			// the background colour is a deliberate choice, not tied to the image
			expect(wrapper.vm.settings.color).toBe('#ff0000');
			vi.useRealTimers();
		});

		it('keeps the settings while an image is loaded', async () => {
			vi.useFakeTimers();
			mountComponentWithProps({ hasImage: true });

			await wrapper.find('[data-testid="rotation-input"]').setValue('90');
			vi.advanceTimersByTime(1000);
			await nextTick();

			expect(wrapper.vm.settings.rotation).toBe(90);
			vi.useRealTimers();
		});

		it('does not reset when a new image replaces the removed one in time', async () => {
			vi.useFakeTimers();
			mountComponentWithProps({ hasImage: true });

			await wrapper.find('[data-testid="rotation-input"]').setValue('90');
			await wrapper.setProps({ hasImage: false });
			vi.advanceTimersByTime(200);
			await wrapper.setProps({ hasImage: true });
			vi.advanceTimersByTime(1000);
			await nextTick();

			expect(wrapper.vm.settings.rotation).toBe(90);
			vi.useRealTimers();
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

	describe('Emitting Change Event on Settings Update', () => {
		it('emits change event when settings are updated', async () => {
			const input = wrapper.find('[data-testid="rotation-input"]');
			await input.setValue('45');

			expect(wrapper.emitted()).toHaveProperty('change');
			const emitted = wrapper.emitted('change');
			expect(emitted[emitted.length - 1]).toEqual([{ rotation: 45, color: '#FFFFFF' }]);
		});

		it('emits the colour change too', async () => {
			await wrapper.find('[data-testid="color-selector-input"]').setValue('#00ff00');

			const emitted = wrapper.emitted('change');
			expect(emitted[emitted.length - 1]).toEqual([{ rotation: 0, color: '#00ff00' }]);
		});
	});

	describe('Accessibility', () => {
		it('names every control', () => {
			const labels = {
				'align-vertical-button': 'Fit image to the frame height',
				'align-horizontal-button': 'Fit image to the frame width',
				'rotate-dial': 'Image rotation in degrees',
				'rotation-input': 'Image rotation in degrees',
				'color-selector-input': 'Background color behind the image'
			};

			for (const [testId, label] of Object.entries(labels)) {
				expect(wrapper.find(`[data-testid="${testId}"]`).attributes('aria-label')).toBe(label);
			}
		});

		it('keeps the button icons out of their accessible names', () => {
			wrapper.findAll('.icon-button img').forEach((icon) => {
				expect(icon.attributes('alt')).toBe('');
			});
		});

		it('declares the icon buttons as buttons that do not submit', () => {
			wrapper.findAll('.icon-button').forEach((button) => {
				expect(button.attributes('type')).toBe('button');
			});
		});
	});

	describe('Background color icon', () => {
		const icon = () => wrapper.find('[data-testid="color-selector-icon"]');

		const iconColorFor = async (color: string) => {
			await wrapper.find('[data-testid="color-selector-input"]').setValue(color);
			return icon().attributes('style');
		};

		it('is drawn over the swatch and does not swallow the click', () => {
			expect(icon().exists()).toBe(true);
			expect(icon().attributes('aria-hidden')).toBe('true');
		});

		it('goes dark on light colors', async () => {
			for (const light of ['#ffffff', '#ffd840', '#f0f0f0', '#00ff00']) {
				expect(await iconColorFor(light), light).toContain('rgb(0, 0, 0)');
			}
		});

		it('goes light on dark colors', async () => {
			for (const dark of ['#000000', '#830065', '#01667e', '#3f3f3f']) {
				expect(await iconColorFor(dark), dark).toContain('rgb(255, 255, 255)');
			}
		});

		it('weighs the channels rather than averaging them', async () => {
			// a saturated blue and a saturated yellow average to the same brightness,
			// but the eye reads blue as dark and yellow as light
			expect(await iconColorFor('#0000ff')).toContain('rgb(255, 255, 255)');
			expect(await iconColorFor('#ffff00')).toContain('rgb(0, 0, 0)');
		});

		it('falls back to dark for a value it cannot read', async () => {
			// the native input normalises its value, so this goes in directly
			wrapper.vm.settings.color = 'not-a-color';
			await nextTick();

			expect(icon().attributes('style')).toContain('rgb(0, 0, 0)');
		});

		it('handles the shorthand form', async () => {
			wrapper.vm.settings.color = '#fff';
			await nextTick();
			expect(icon().attributes('style')).toContain('rgb(0, 0, 0)');

			wrapper.vm.settings.color = '#000';
			await nextTick();
			expect(icon().attributes('style')).toContain('rgb(255, 255, 255)');
		});
	});
});
