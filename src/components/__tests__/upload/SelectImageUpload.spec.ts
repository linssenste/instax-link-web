import { mount } from '@vue/test-utils'
import { describe, it, expect, beforeEach, vi } from 'vitest'

import SelectImageUpload from '../../../components/files/SelectImageUpload.vue'

describe('Select image area', () => {
  let wrapper 

  beforeEach(() => {
    wrapper = mount(SelectImageUpload);
  })


  it('renders component itself', () => {
    expect(wrapper.exists()).toBe(true);
  })
  

  it('should emit "selected" event when input changes', async () => {
    
    // Find the input element
    const input = wrapper.find('[data-testid="input-file"]');

    await input.trigger('change');

    expect(wrapper.emitted('selected')).toBeTruthy()
  })


  it('should trigger file input click when uploadImage method is called', async () => {

    const clickSpy = vi.spyOn(wrapper.vm, 'uploadImage');
	const areaElement = wrapper.find('[data-testid="upload-area"]');

	await areaElement.trigger('click'); 

    // Check if the click event was called
    expect(clickSpy).toHaveBeenCalled();
  })

  

})
