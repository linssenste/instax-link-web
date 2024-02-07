import { mount } from '@vue/test-utils'
import { describe, it, expect, beforeEach } from 'vitest'
import { nextTick } from 'vue'

// component
import PolaroidSizeSelector from '../../../components/layout/PolaroidSizeSelector.vue'

describe('Polaroid manual size selector', () => {
	let wrapper

	const defaultConfig = {
		theme: 'red'
	}
	beforeEach(() => {
		wrapper = mount(PolaroidSizeSelector, {
			props: {
				config: defaultConfig
			}
		});
	})


	it('renders component itself', () => {
		expect(wrapper.exists()).toBe(true);
	})


	it('renders the correct number of polaroids', () => {
		const polaroids = wrapper.findAll('[data-testid^="polaroid-selector-"]');
		expect(polaroids.length).toBe(3); // Assuming there are three predefined sizes in your template
	});



	it('changes selected width on click', async () => {
		const secondPolaroid = wrapper.find('[data-testid="polaroid-selector-600"]');
		await secondPolaroid.trigger('click');
		await nextTick();
		expect(wrapper.vm.selectedWidth).toBe(600); // Assuming the second polaroid corresponds to 800 width
	});


	it('emits "resize" event on width change', async () => {
		const secondPolaroid = wrapper.find('[data-testid="polaroid-selector-600"]');
		await secondPolaroid.trigger('click');
		await nextTick();
		expect(wrapper.emitted().resize).toBeTruthy();
		expect(wrapper.emitted().resize[0][0]).toEqual({
			...defaultConfig,
			width: 600,
			height: 800,
		});
	});


	it('renders polaroids with correct titles', () => {
		const polaroidTitles = wrapper.findAll('.polaroid').map((polaroid) => polaroid.attributes('title'));
		const expectedTitles = ['Instax Mini (600x800)', 'Instax Square (800x800)', 'Instax Large (1260x840)'];
		expect(polaroidTitles).toEqual(expectedTitles);
	});


	it('does not emit "resize" event when clicking on the already selected polaroid', async () => {
		const initialResizeCount = wrapper.emitted().resize ? wrapper.emitted().resize.length : 0;
		const selectedPolaroid = wrapper.find('[data-testid="polaroid-selector-800"]');
		await selectedPolaroid.trigger('click');
		await nextTick();
		expect(wrapper.emitted().resize ? wrapper.emitted().resize.length : 0).toBe(initialResizeCount);
	});

})
