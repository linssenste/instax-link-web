import { mount } from '@vue/test-utils'
import { describe, it, expect, beforeEach, vi } from 'vitest'

// component
import DropImageUpload from '../../../components/files/DropImageUpload.vue'
import { nextTick } from 'vue'

describe('Drag & Drop area', () => {
	let wrapper


	beforeEach(() => {
		wrapper = mount(DropImageUpload);
	})


	it('renders component itself', () => {
		expect(wrapper.exists()).toBe(true);
	})


	it('displays overlay when dragging over', async () => {
		expect(wrapper.find('[data-testid="drop-area"]').exists()).toBe(false);


		wrapper.vm.isDraggingOver = true

		await nextTick();
		expect(wrapper.find('[data-testid="drop-area"]').exists()).toBe(true);
	});

	it('hides overlay when dragging leaves', async () => {
		wrapper.vm.isDraggingOver = true;
		await nextTick();
		expect(wrapper.find('[data-testid="drop-area"]').exists()).toBe(true);
		wrapper.vm.isDraggingOver = false;
		await nextTick();
		expect(wrapper.find('[data-testid="drop-area"]').exists()).toBe(false);
	});

	it('prevents default and stops propagation for dragover event', async () => {
		const event = { preventDefault: vi.fn(), stopImmediatePropagation: vi.fn() };
		wrapper.vm.dragOver(event);
		expect(event.preventDefault).toHaveBeenCalled();
		expect(event.stopImmediatePropagation).toHaveBeenCalled();
	});

	it('only emits "dropped" event for image files', async () => {
		const dataTransfer = {
			files: [new File([], 'test.png', { type: 'image/png' }), new File([], 'test.txt', { type: 'text/plain' })]
		};
		const event = { preventDefault: vi.fn(), stopPropagation: vi.fn(), dataTransfer };

		wrapper.vm.onDrop(event);
		expect(wrapper.emitted()).toHaveProperty('dropped');
		expect(wrapper.emitted().dropped.length).toBe(1);
		expect(wrapper.emitted().dropped[0][0].type).toBe('image/png');
	});


	it('adds event listeners on mount', () => {
		const addSpy = vi.spyOn(document, 'addEventListener');
		mount(DropImageUpload);
		expect(addSpy).toHaveBeenCalledTimes(4); // adjust based on actual listeners
		addSpy.mockRestore();
	});


	it('removes event listeners on unmount', () => {
		const removeSpy = vi.spyOn(document, 'removeEventListener');
		wrapper.unmount();
		expect(removeSpy).toHaveBeenCalledTimes(4); // adjust based on actual listeners
		removeSpy.mockRestore();
	});

})
