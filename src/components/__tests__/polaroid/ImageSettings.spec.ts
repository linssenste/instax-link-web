import { mount } from '@vue/test-utils'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { NOT_ALIGNED, type FrameAlignment } from '../../../polaroid/frame.geometry'
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { cssOf } from '../css'
import { nextTick } from 'vue'

import ImageSettings from '../../polaroid/ImageSettings.vue'

// ImageSettings covers how the image sits inside the frame. The caption is edited
// on the polaroid itself and the print/download actions live in the drawer footer,
// so neither is tested here.
// jsdom applies no scoped styles, so the layout rules are read from the source
const ruleFor = cssOf('src/components/polaroid/ImageSettings.vue');

describe('ImageSettings Component', () => {
	let wrapper

	const mountComponentWithProps = (propsData = {}) => {
		// the one it replaces is taken down first: each instance holds a keydown
		// listener on the document, and a pile of them would answer over one another
		wrapper?.unmount();
		wrapper = mount(ImageSettings, { props: { hasImage: true, ...propsData } });
	};

	beforeEach(() => {
		mountComponentWithProps();
	});

	// every instance holds a keydown listener on the document, so leaving them
	// mounted piles them up and the oldest one answers for all of them
	afterEach(() => {
		wrapper?.unmount();
		vi.useRealTimers();
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

	describe('Keyboard', () => {
		const press = (key: string, options: KeyboardEventInit = {}) => {
			document.dispatchEvent(new KeyboardEvent('keydown', { key, cancelable: true, ...options }));
		};

		it('fits and centres from the keyboard', () => {
			press('w');
			expect(wrapper.emitted('scale')).toEqual([['horizontal']]);

			press('h');
			expect(wrapper.emitted('scale')).toEqual([['horizontal'], ['vertical']]);

			press('c');
			expect(wrapper.emitted('centre')).toEqual([['horizontal']]);

			press('c', { shiftKey: true });
			expect(wrapper.emitted('centre')).toEqual([['horizontal'], ['vertical']]);
		});

		it('moves the image by the arrows, further with Shift', () => {
			press('ArrowRight');
			expect(wrapper.emitted('move')).toEqual([[{ x: 1, y: 0 }]]);

			press('ArrowUp', { shiftKey: true });
			expect(wrapper.emitted('move')?.[1]).toEqual([{ x: 0, y: -10 }]);
		});

		it('turns the image a quarter each way, and reports it like the dial does', async () => {
			press('r');
			await nextTick();

			expect(wrapper.vm.settings.rotation).toBe(90);
			expect((wrapper.emitted('change')?.at(-1)?.[0] as { rotation: number }).rotation).toBe(90);

			press('r', { shiftKey: true });
			await nextTick();
			expect(wrapper.vm.settings.rotation).toBe(0);
		});

		it('opens the film look and asks for the panel', () => {
			press('f');
			expect(wrapper.emitted('open-film')).toHaveLength(1);

			press('s');
			expect(wrapper.emitted('toggle-settings')).toHaveLength(1);
		});

		it('does nothing at all without an image to act on', async () => {
			await wrapper.setProps({ hasImage: false });

			press('w');
			press('ArrowRight');
			press('f');

			expect(wrapper.emitted('scale')).toBeUndefined();
			expect(wrapper.emitted('move')).toBeUndefined();
			expect(wrapper.emitted('open-film')).toBeUndefined();
		});

		it('keeps out of the caption, where the same keys are letters', () => {
			const caption = document.createElement('input');
			document.body.appendChild(caption);

			caption.dispatchEvent(new KeyboardEvent('keydown', {
				key: 'w', cancelable: true, bubbles: true
			}));

			expect(wrapper.emitted('scale')).toBeUndefined();
			caption.remove();
		});

		it('stops listening once it is gone', () => {
			wrapper.unmount();

			expect(() => press('w')).not.toThrow();
		});

		it('puts the shortcut in each button\'s tooltip', () => {
			const titled: [string, string][] = [
				['align-horizontal-button', '(W)'],
				['align-vertical-button', '(H)'],
				['centre-horizontal-button', '(C)'],
				['centre-vertical-button', '(Shift C)'],
				['open-film-button', '(F)']
			];

			for (const [testId, hint] of titled) {
				expect(wrapper.find(`[data-testid="${testId}"]`).attributes('title'), testId)
					.toContain(hint);
			}
		});
	});

	describe('Showing what already holds', () => {
		const LIT: [string, keyof FrameAlignment][] = [
			['align-vertical-button', 'fitsHeight'],
			['align-horizontal-button', 'fitsWidth'],
			['centre-vertical-button', 'centredVertically'],
			['centre-horizontal-button', 'centredHorizontally']
		];

		it('lights nothing while the image sits nowhere in particular', () => {
			for (const [testId] of LIT) {
				expect(wrapper.find(`[data-testid="${testId}"]`).classes(), testId)
					.not.toContain('holds');
			}
		});

		it('lights each control while its own framing holds', async () => {
			for (const [testId, key] of LIT) {
				await wrapper.setProps({ alignment: { ...NOT_ALIGNED, [key]: true } });

				const lit = wrapper.findAll('.icon-button.holds')
					.map((button) => button.attributes('data-testid'));

				// only that one, so the row reads as the state and not as a suggestion
				expect(lit, testId).toEqual([testId]);
			}
		});

		it('says so to a screen reader as well as by eye', async () => {
			await wrapper.setProps({ alignment: { ...NOT_ALIGNED, fitsWidth: true } });

			expect(wrapper.find('[data-testid="align-horizontal-button"]').attributes('aria-pressed'))
				.toBe('true');
			expect(wrapper.find('[data-testid="align-vertical-button"]').attributes('aria-pressed'))
				.toBe('false');
		});

		it('paints a lit control the way the pointer does, and keeps it there', () => {
			expect(ruleFor('.icon-button.holds')).toContain('background-color: #ffffff');
			expect(ruleFor('.icon-button.holds .button-icon'))
				.toContain('background-color: rgb(var(--dynamic-bg-color))');
		});

		it('stays lit however the framing came about, not only when pressed', async () => {
			// it is fed from the canvas, which reports after any pan, zoom or rotation,
			// so dragging the image onto the centre line lights it too
			await wrapper.setProps({ alignment: { ...NOT_ALIGNED, centredVertically: true } });
			expect(wrapper.find('[data-testid="centre-vertical-button"]').classes()).toContain('holds');

			await wrapper.setProps({ alignment: { ...NOT_ALIGNED } });
			expect(wrapper.find('[data-testid="centre-vertical-button"]').classes()).not.toContain('holds');
		});
	});

	describe('Centring on an axis', () => {
		it('asks for the axis that was pressed', async () => {
			await wrapper.find('[data-testid="centre-vertical-button"]').trigger('click');
			expect(wrapper.emitted('centre')).toEqual([['vertical']]);

			await wrapper.find('[data-testid="centre-horizontal-button"]').trigger('click');
			expect(wrapper.emitted('centre')).toEqual([['vertical'], ['horizontal']]);
		});

		it('is a separate thing from fitting, which scales instead of moving', async () => {
			await wrapper.find('[data-testid="align-horizontal-button"]').trigger('click');

			expect(wrapper.emitted('scale')).toEqual([['horizontal']]);
			expect(wrapper.emitted('centre')).toBeUndefined();
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
			const icons = wrapper.findAll('.icon-button .button-icon');

			expect(icons.length).toBe(5);
			icons.forEach((icon) => expect(icon.attributes('aria-hidden')).toBe('true'));
		});

		it('draws those icons as masks, so they can be given a colour', () => {
			// they ship with a placeholder fill that is all but invisible on the light
			// button behind them, and an img cannot be recoloured
			const source = readFileSync(
				resolve(process.cwd(), 'src/components/polaroid/ImageSettings.vue'), 'utf8'
			);

			expect(wrapper.find('.icon-button img').exists()).toBe(false);
			expect(source).toContain('mask: url(\'@/assets/icons/controls/fit-width.svg\')');
			expect(source).toContain('mask: url(\'@/assets/icons/controls/sliders.svg\')');

			const start = source.indexOf('.button-icon {');
			expect(source.slice(start, source.indexOf('}', start))).toContain('background-color');
		});

		it('lays every cluster out in two rows, so they fit a mini frame', () => {
			// a mini frame leaves 262px inside the panel. Six 40px controls in one row
			// beside the 104px dial would come to 364; in two rows the lot comes to 242
			// and stays inside the dial's own height, so the drawer does not grow
			expect(ruleFor('.alignment-buttons')).toContain('grid-template-columns: repeat(2, 40px)');
			expect(ruleFor('.look-buttons')).toContain('grid-template-columns: 40px');

			expect(wrapper.findAll('.alignment-buttons > *').length).toBe(4);
			expect(wrapper.findAll('.look-buttons > *').length).toBe(2);
		});

		it('runs the clusters across the full width, with the dial at the far end', () => {
			const row = ruleFor('.align-span-buttons');

			expect(row).toContain('width: 100%');
			expect(row).toContain('justify-content: space-between');
			expect(row).not.toContain('max-width');
		});

		it('sets the clusters further apart than the controls within them', () => {
			const between = /gap:\s*(\d+)px/.exec(ruleFor('.image-controls'))?.[1];
			const within = /gap:\s*(\d+)px/.exec(ruleFor('.alignment-buttons'))?.[1];

			expect(Number(between)).toBeGreaterThan(Number(within));
		});

		it('puts each centring control under the fit it belongs with', () => {
			// the grid runs row by row, so the source order is the layout, and tab order
			// follows the eye
			const handles = wrapper.findAll('.alignment-buttons > *')
				.map((control) => control.attributes('data-testid'));

			expect(handles).toEqual([
				'align-vertical-button', 'align-horizontal-button',
				'centre-vertical-button', 'centre-horizontal-button'
			]);
		});

		it('fits to height with the same icon turned on its side', () => {
			const source = readFileSync(
				resolve(process.cwd(), 'src/components/polaroid/ImageSettings.vue'), 'utf8'
			);
			const start = source.indexOf('.fit-height {');

			expect(start).toBeGreaterThan(-1);
			expect(source.slice(start, source.indexOf('}', start))).toContain('rotate: 90deg');
		});

		it('declares the icon buttons as buttons that do not submit', () => {
			const buttons = wrapper.findAll('.icon-button');

			// counted, or a selector that stops matching would leave this passing on
			// an empty list
			expect(buttons.length).toBe(5);
			buttons.forEach((button) => expect(button.attributes('type')).toBe('button'));
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
