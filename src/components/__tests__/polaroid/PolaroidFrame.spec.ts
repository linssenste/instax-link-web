import { mount } from '@vue/test-utils'
import { describe, it, expect, beforeEach } from 'vitest'
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
			{ type: InstaxFilmVariant.LARGE, src: `/polaroids/${InstaxFilmVariant.LARGE}.webp`, width: '522' }
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
			{ type: InstaxFilmVariant.LARGE, expectedClass: '.inner-large' }
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

	describe('Error handling and loading state', () => {
		it('handles image load error correctly', async () => {
			await wrapper.find('.polaroid-frame').trigger('error');
			expect(wrapper.vm.loadError).toBe(true);
		});

		it('sets frameLoaded to true on image load', async () => {
			await wrapper.find('.polaroid-frame').trigger('load');
			expect(wrapper.vm.frameLoaded).toBe(true);
		});
	});

	describe('Dynamic Class Binding and Reactivity', () => {
		it('updates classes correctly when type prop changes', async () => {
			await wrapper.setProps({ type: InstaxFilmVariant.MINI });
			expect(wrapper.find('.inner-mini').exists()).toBe(true);

			await wrapper.setProps({ type: InstaxFilmVariant.LARGE });
			expect(wrapper.find('.inner-mini').exists()).toBe(false);
			expect(wrapper.find('.inner-large').exists()).toBe(true);
		});
	});
});
