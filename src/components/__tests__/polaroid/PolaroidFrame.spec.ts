import { mount } from '@vue/test-utils'
import { describe, it, expect, beforeEach } from 'vitest'
import PolaroidFrame from '../../../components/polaroid/PolaroidFrame.vue'
import { InstaxFilmVariant } from '../../../interfaces/PrinterStateConfig'

describe('Polaroid-themed frame', () => {
  let wrapper 

  beforeEach(() => {
    wrapper = mount(PolaroidFrame, {
		props: {
			type: InstaxFilmVariant.SQUARE
		}
	});
  })

  it('renders frame itself', () => {
    expect(wrapper.exists()).toBe(true);
  })


  it('displays the correct polaroid image source based on type prop', async () => {
    await wrapper.setProps({ type: InstaxFilmVariant.SQUARE });
    expect(wrapper.find('.polaroid-frame').attributes('src')).toBe(`/polaroids/${InstaxFilmVariant.SQUARE}.webp`);

    await wrapper.setProps({ type: InstaxFilmVariant.MINI });
    expect(wrapper.find('.polaroid-frame').attributes('src')).toBe(`/polaroids/${InstaxFilmVariant.MINI}.webp`);

    await wrapper.setProps({ type: InstaxFilmVariant.LARGE });
    expect(wrapper.find('.polaroid-frame').attributes('src')).toBe(`/polaroids/${InstaxFilmVariant.LARGE}.webp`);

  })



  it('correctly sets polaroid image width based on type prop', async () => {

    await wrapper.setProps({ type: InstaxFilmVariant.MINI });
    expect(wrapper.find('.polaroid-frame').attributes('width')).toBe('282');

	await wrapper.setProps({ type: InstaxFilmVariant.SQUARE });
    expect(wrapper.find('.polaroid-frame').attributes('width')).toBe('368');

    await wrapper.setProps({ type: InstaxFilmVariant.LARGE });
    expect(wrapper.find('.polaroid-frame').attributes('width')).toBe('522');
  })

  it('applies the correct CSS class based on the type prop', async () => {
    await wrapper.setProps({ type: InstaxFilmVariant.MINI });
    expect(wrapper.find('.inner-mini').exists()).toBe(true);

    await wrapper.setProps({ type: InstaxFilmVariant.SQUARE });
    expect(wrapper.find('.inner-square').exists()).toBe(true);

    await wrapper.setProps({ type: InstaxFilmVariant.LARGE });
    expect(wrapper.find('.inner-large').exists()).toBe(true);
})



  it('renders area slot content correctly', () => {
    const slotContent = '<div class="area-content">Slot Content</div>';
    const wrapperWithSlot = mount(PolaroidFrame, {
        props: {
            type: InstaxFilmVariant.SQUARE
        },
        slots: {
            'polaroid-area': slotContent
        }
    });
    expect(wrapperWithSlot.find('.area-content').exists()).toBe(true);
})


it('renders text slot content correctly', () => {
    const slotContent = '<div class="text-content">Slot Content</div>';
    const wrapperWithSlot = mount(PolaroidFrame, {
        props: {
            type: InstaxFilmVariant.SQUARE
        },
        slots: {
            'polaroid-text': slotContent
        }
    });
    expect(wrapperWithSlot.find('.text-content').exists()).toBe(true);
})

})


