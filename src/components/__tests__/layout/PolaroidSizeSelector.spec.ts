import { mount } from '@vue/test-utils'
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { nextTick } from 'vue'

import PolaroidSizeSelector from '../../../components/layout/PolaroidSizeSelector.vue'

describe('PolaroidSizeSelector', () => {
	let wrapper

	beforeEach(() => {
		wrapper = mount(PolaroidSizeSelector, {
			attachTo: document.body,
		});
	});

	afterEach(() => {
		wrapper.unmount();
	});

	describe('Rendering', () => {
		it('mounts the component', () => {
			expect(wrapper.exists()).toBe(true);
		});

		it('renders all three polaroid size types', () => {
			const polaroids = wrapper.findAll('[data-testid^="polaroid-selector-"]');
			expect(polaroids.length).toBe(3);
		});

		it('renders correct titles', () => {
			const titles = wrapper.findAll('.polaroid').map((el) => el.attributes('title'));
			expect(titles).toEqual([
				'Instax Mini (600x800)',
				'Instax Square (800x800)',
				'Instax Wide (1260x840)',
			]);
		});
	});

	describe('Selection behavior', () => {
		const polaroidTypes = ['mini', 'square', 'wide'];

		polaroidTypes.forEach((type) => {
			it(`selects and emits ${type}`, async () => {
				const el = wrapper.find(`[data-testid="polaroid-selector-${type}"]`);
				await el.trigger('click');
				await nextTick();

				expect(wrapper.vm.selectedType).toBe(type);
				expect(wrapper.emitted()['type-change']).toBeTruthy();
				expect(wrapper.emitted()['type-change'].at(-1)[0]).toBe(type);
			});

			it(`does not emit again on re-clicking already selected ${type}`, async () => {
				const el = wrapper.find(`[data-testid="polaroid-selector-${type}"]`);
				await el.trigger('click');
				await nextTick();

				const count = wrapper.emitted()['type-change'].length;
				await el.trigger('click');
				await nextTick();

				expect(wrapper.emitted()['type-change'].length).toBe(count);
			});

			it(`applies correct scale style for selected ${type}`, () => {
				const el = wrapper.find(`[data-testid="polaroid-selector-${type}"]`);
				expect(el.element.style.transform).toBe('scale(1.15)');
			});

			it(`stores selected type ${type} in localStorage`, () => {
				expect(localStorage.getItem('polaroid')).toBe(type);
			});
		});
	});

	describe('Image handling', () => {
		it('only shows image for selected type', () => {
			const types = ['mini', 'square', 'wide'];
			const selected = wrapper.vm.selectedType;

			types.forEach((type) => {
				const img = wrapper.find(`[data-testid="image-${type}"]`);
				if (type === selected) {
					expect(img.isVisible()).toBe(true);
					expect(img.attributes('src')).toContain('https://picsum.photos/');
				} else {
					expect(img.element.style.display).toBe('none');
				}
			});
		});

		it('sets a valid picsum.photos image URL for selected type', () => {
			const selected = wrapper.vm.selectedType;
			const img = wrapper.find(`[data-testid="image-${selected}"]`);

			expect(img.attributes('src')).toMatch(/https:\/\/picsum\.photos\/seed\/.*\/\d+\/\d+/);
		});

		it('adds "develop-polaroid" class on image load', async () => {
			const selected = wrapper.vm.selectedType;
			const img = wrapper.find(`[data-testid="image-${selected}"]`);

			const overlay = document.getElementById(`${selected}-overlay`);
			expect(overlay).toBeTruthy();
			if (!overlay) return;

			const spy = vi.spyOn(overlay.classList, 'add');
			await img.trigger('load');
			await nextTick();

			expect(spy).toHaveBeenCalledWith('develop-polaroid');
		});

		it('sets fallback image only after exceeding 5 load errors', async () => {
			const selected = wrapper.vm.selectedType;
			const img = wrapper.find(`[data-testid="image-${selected}"]`);
			const fallbackUrl = `/public/fallback-images/fallback-${selected.charAt(0)}.webp`;

			expect(img.attributes('src')).not.toBe(fallbackUrl);
			expect(img.attributes('src')).toMatch(/https:\/\/picsum\.photos\/seed\/.*\/\d+\/\d+/);

			for (let i = 0; i < 5; i++) {
				await img.trigger('error');
			}

			await img.trigger('error');
			await nextTick();

			expect(img.attributes('src')).toBe(fallbackUrl);
		});
	});
});


