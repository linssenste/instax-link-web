import { mount } from '@vue/test-utils'
import { describe, it, expect, beforeEach } from 'vitest'
import { nextTick } from 'vue'

import PolaroidSizeSelector from '../../../components/layout/PolaroidSizeSelector.vue'

describe('Polaroid size (or type) selector', () => {
	let wrapper

	beforeEach(() => {
		wrapper = mount(PolaroidSizeSelector);
	})


	it('renders component itself', () => {
		expect(wrapper.exists()).toBe(true);
	})


	it('renders all three polaroid size types', () => {
		const polaroids = wrapper.findAll('[data-testid^="polaroid-selector-"]');
		expect(polaroids.length).toBe(3); // Assuming there are three predefined sizes in your template
	});


	it('changes selected width on click', async () => {
		const secondPolaroid = wrapper.find('[data-testid="polaroid-selector-mini"]');
		await secondPolaroid.trigger('click');
		await nextTick();

		expect(wrapper.vm.selectedType).toBe("mini"); // Assuming the second polaroid corresponds to 800 width
	});


	it('emits "square" event on mounted as default', async () => {
		expect(wrapper.emitted()['type-change']).toBeTruthy(); // type-change event
		expect(wrapper.emitted()['type-change'][0][0]).toEqual("square");
	});


	it('emits "type-change" event on type click', async () => {

		// mini type
		let polaroidElement = wrapper.find('[data-testid="polaroid-selector-mini"]');
		await polaroidElement.trigger('click');
		await nextTick();

		expect(wrapper.emitted()['type-change']).toBeTruthy(); // type-change event
		expect(wrapper.emitted()['type-change'][1][0]).toEqual("mini");



		// large (or wide) type
		polaroidElement = wrapper.find('[data-testid="polaroid-selector-large"]');
		await polaroidElement.trigger('click');
		await nextTick();

		expect(wrapper.emitted()['type-change']).toBeTruthy(); // type-change event
		expect(wrapper.emitted()['type-change'][2][0]).toEqual("large");


		// square type
		polaroidElement = wrapper.find('[data-testid="polaroid-selector-square"]');
		await polaroidElement.trigger('click');
		await nextTick();

		expect(wrapper.emitted()['type-change']).toBeTruthy(); // type-change event
		expect(wrapper.emitted()['type-change'][3][0]).toEqual("square");
	});


	it('does not emit "type change" event when clicking on the already selected polaroid', async () => {
		const initialResizeCount = wrapper.emitted().resize ? wrapper.emitted()["type-change"].length : 0;
		const selectedPolaroid = wrapper.find('[data-testid="polaroid-selector-square"]');
		await selectedPolaroid.trigger('click');
		await nextTick();

		expect(wrapper.emitted().resize ? wrapper.emitted().resize.length : 0).toBe(initialResizeCount);
	});


	it('renders polaroids with correct titles', () => {
		const polaroidTitles = wrapper.findAll('.polaroid').map((polaroid) => polaroid.attributes('title'));
		const expectedTitles = ['Instax Mini (600x800)', 'Instax Square (800x800)', 'Instax Large (1260x840)'];
		expect(polaroidTitles).toEqual(expectedTitles);
	});

})
