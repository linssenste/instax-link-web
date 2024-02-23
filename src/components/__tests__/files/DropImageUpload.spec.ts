import { mount } from '@vue/test-utils'
import { describe, it, expect, beforeEach, vi } from 'vitest'


// component
import DropImageUpload from '../../../components/files/DropImageUpload.vue'
import { nextTick } from 'vue'

describe('Drag & Drop area', () => {
  let wrapper 


  beforeEach(() => {
    wrapper = mount(DropImageUpload, {props: {
		theme: 'red'
	}});
  })


  it('renders component itself', () => {
    expect(wrapper.exists()).toBe(true);
  })

  it('displays overlay when dragging over', async () => {
    expect(wrapper.find('[data-testid="drop-area"]').exists()).toBe(false);
   

	wrapper.vm.isDraggingOver = true

	await nextTick();
	console.log(wrapper.vm.isDraggingOver, wrapper.find('[data-testid="drop-area"]'))
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

  it('emits "dropped" event when valid image file is dropped', async () => {
    const file = new File(['(⌐□_□)'], 'test.png', { type: 'image/png' });
    const spy = vi.spyOn(wrapper.vm, '$emit');
    const dropEvent = new DragEvent('drop', {
      dataTransfer: {
        files: [file]
      }
    });
    wrapper.vm.onDrop(dropEvent);
    await nextTick();
    expect(spy).toHaveBeenCalledWith('dropped', file);
    spy.mockRestore();
  });


  
  
})
