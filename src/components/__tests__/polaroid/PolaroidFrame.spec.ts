import { mount } from '@vue/test-utils'
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { h, nextTick } from 'vue'
import PolaroidFrame from '../../../components/polaroid/PolaroidFrame.vue'
import { InstaxFilmVariant } from '../../../interfaces/PrinterStateConfig'

describe('PolaroidFrame Component', () => {
	let wrapper

	const mountComponentWithProps = (type = InstaxFilmVariant.SQUARE) => {
		wrapper = mount(PolaroidFrame, {
			props: { type }
		});
	};

	beforeEach(() => {
		mountComponentWithProps();
	});

	it('renders the frame itself', () => {
		expect(wrapper.exists()).toBe(true);
	});

	describe('Polaroid image source and width', () => {
		const typesAndExpectedValues = [
			{ type: InstaxFilmVariant.MINI, src: `/polaroids/${InstaxFilmVariant.MINI}.webp`, width: '282' },
			{ type: InstaxFilmVariant.SQUARE, src: `/polaroids/${InstaxFilmVariant.SQUARE}.webp`, width: '368' },
			{ type: InstaxFilmVariant.WIDE, src: `/polaroids/${InstaxFilmVariant.WIDE}.webp`, width: '522' }
		];

		typesAndExpectedValues.forEach(({ type, src, width }) => {
			it(`displays correct image source and width for type ${type}`, async () => {
				await wrapper.setProps({ type });
				const polaroidImage = wrapper.find('.polaroid-frame');
				expect(polaroidImage.attributes('src')).toBe(src);
				expect(polaroidImage.attributes('width')).toBe(width);
			});
		});
	});

	describe('CSS class based on type prop', () => {
		const typesAndExpectedClasses = [
			{ type: InstaxFilmVariant.MINI, expectedClass: '.inner-mini' },
			{ type: InstaxFilmVariant.SQUARE, expectedClass: '.inner-square' },
			{ type: InstaxFilmVariant.WIDE, expectedClass: '.inner-wide' }
		];

		typesAndExpectedClasses.forEach(({ type, expectedClass }) => {
			it(`applies correct class ${expectedClass} for type ${type}`, async () => {
				await wrapper.setProps({ type });
				expect(wrapper.find(expectedClass).exists()).toBe(true);
			});
		});
	});

	describe('Slot content', () => {
		it('renders polaroid-area slot content correctly', () => {
			const slotContent = '<div class="area-content">Area Slot Content</div>';
			const wrapperWithSlot = mount(PolaroidFrame, {
				props: { type: InstaxFilmVariant.SQUARE },
				slots: { 'polaroid-area': slotContent }
			});
			expect(wrapperWithSlot.find('.area-content').exists()).toBe(true);
		});

		it('renders polaroid-text slot content correctly', () => {
			const slotContent = '<div class="text-content">Text Slot Content</div>';
			const wrapperWithSlot = mount(PolaroidFrame, {
				props: { type: InstaxFilmVariant.SQUARE },
				slots: { 'polaroid-text': slotContent }
			});
			expect(wrapperWithSlot.find('.text-content').exists()).toBe(true);
		});
	});

	describe('Responsive frame box', () => {
		const typesAndExpectedClasses = [
			{ type: InstaxFilmVariant.MINI, expectedClass: 'polaroid-mini' },
			{ type: InstaxFilmVariant.SQUARE, expectedClass: 'polaroid-square' },
			{ type: InstaxFilmVariant.WIDE, expectedClass: 'polaroid-wide' }
		];

		typesAndExpectedClasses.forEach(({ type, expectedClass }) => {
			it(`applies the ${type} aspect-ratio class to the frame box`, async () => {
				await wrapper.setProps({ type });
				expect(wrapper.find('.editor').classes()).toContain(expectedClass);
			});
		});

		it('keeps only one aspect-ratio class at a time', async () => {
			await wrapper.setProps({ type: InstaxFilmVariant.WIDE });
			const classes = wrapper.find('.editor').classes();
			expect(classes).toContain('polaroid-wide');
			expect(classes).not.toContain('polaroid-square');
			expect(classes).not.toContain('polaroid-mini');
		});

		it('keeps the intrinsic artwork height so the box is reserved before load', () => {
			expect(wrapper.find('.polaroid-frame').attributes('height')).toBe('440');
		});
	});

	describe('Display scale', () => {
		let rectSpy: ReturnType<typeof vi.spyOn>

		const renderAt = (width: number) => {
			rectSpy = vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect')
				.mockReturnValue({ width, height: width * 440 / 368 } as DOMRect);
		};

		afterEach(() => rectSpy?.mockRestore());

		it('is 1 when the frame renders at its intrinsic width', () => {
			renderAt(368);
			mountComponentWithProps(InstaxFilmVariant.SQUARE);

			expect(wrapper.vm.displayScale).toBeCloseTo(1);
		});

		it('reports how far the frame is scaled down', () => {
			renderAt(276);
			mountComponentWithProps(InstaxFilmVariant.SQUARE);

			expect(wrapper.vm.displayScale).toBeCloseTo(0.75);
		});

		it('is relative to each variant\'s own intrinsic width', () => {
			renderAt(261);
			mountComponentWithProps(InstaxFilmVariant.MINI);

			// 261 of the mini frame's 282, not of the square's 368
			expect(wrapper.vm.displayScale).toBeCloseTo(261 / 282);
		});

		it('recomputes when the film variant changes', async () => {
			renderAt(282);
			mountComponentWithProps(InstaxFilmVariant.MINI);
			expect(wrapper.vm.displayScale).toBeCloseTo(1);

			await wrapper.setProps({ type: InstaxFilmVariant.WIDE });

			// same rendered box, wider artwork, so the frame is scaled down further
			expect(wrapper.vm.displayScale).toBeCloseTo(282 / 522);
		});

		it('publishes the scale as a custom property for the caption to use', async () => {
			renderAt(184);
			mountComponentWithProps(InstaxFilmVariant.SQUARE);
			await nextTick();

			expect(wrapper.find('.editor').attributes('style')).toContain('--polaroid-scale: 0.5');
		});

		it('exposes the scale to the polaroid-area slot', async () => {
			renderAt(184);
			const wrapperWithSlot = mount(PolaroidFrame, {
				props: { type: InstaxFilmVariant.SQUARE },
				slots: {
					'polaroid-area': (slotProps: { displayScale: number }) =>
						h('span', { class: 'scale' }, String(slotProps.displayScale))
				}
			});
			await nextTick();

			expect(wrapperWithSlot.find('.scale').text()).toBe('0.5');
		});

		it('ignores a collapsed box instead of reporting a zero scale', async () => {
			renderAt(368);
			mountComponentWithProps(InstaxFilmVariant.SQUARE);

			rectSpy.mockReturnValue({ width: 0, height: 0 } as DOMRect);
			wrapper.vm.measureDisplayScale();
			await nextTick();

			expect(wrapper.vm.displayScale).toBeCloseTo(1);
		});
	});

	describe('Error handling and loading state', () => {
		it('handles image load error correctly', async () => {
			await wrapper.find('.polaroid-frame').trigger('error');
			expect(wrapper.vm.loadError).toBe(true);
		});

		it('sets frameLoaded to true on image load', async () => {
			await wrapper.find('.polaroid-frame').trigger('load');
			expect(wrapper.vm.frameLoaded).toBe(true);
		});

		it('hides the artwork on error, leaving the stand-in paper', async () => {
			await wrapper.find('.polaroid-frame').trigger('error');

			expect(wrapper.find('.polaroid-frame').isVisible()).toBe(false);
		});

		it('keeps the aspect ratio class when the artwork fails', async () => {
			await wrapper.setProps({ type: InstaxFilmVariant.MINI });
			await wrapper.find('.polaroid-frame').trigger('error');

			// the paper stand-in has to keep the polaroid's proportions
			expect(wrapper.find('.editor').classes()).toContain('polaroid-mini');
		});

		it('keeps the crop window mounted while the artwork is still loading', () => {
			expect(wrapper.vm.frameLoaded).toBe(false);
			// the blank polaroid is already there to be interacted with
			expect(wrapper.find('#polaroid-frame').exists()).toBe(true);
		});

		it('fades the artwork in once it has loaded', async () => {
			expect(wrapper.find('.polaroid-frame').attributes('style')).toContain('opacity: 0');

			await wrapper.find('.polaroid-frame').trigger('load');

			expect(wrapper.find('.polaroid-frame').attributes('style')).toContain('opacity: 1');
		});
	});

	describe('Dynamic Class Binding and Reactivity', () => {
		it('updates classes correctly when type prop changes', async () => {
			await wrapper.setProps({ type: InstaxFilmVariant.MINI });
			expect(wrapper.find('.inner-mini').exists()).toBe(true);

			await wrapper.setProps({ type: InstaxFilmVariant.WIDE });
			expect(wrapper.find('.inner-mini').exists()).toBe(false);
			expect(wrapper.find('.inner-wide').exists()).toBe(true);
		});
	});
});
