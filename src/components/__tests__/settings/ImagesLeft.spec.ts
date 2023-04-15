import { mount } from '@vue/test-utils'
import { describe, it, expect, beforeEach } from 'vitest'
import { createVuetify } from 'vuetify'
import { nextTick } from 'vue'
import * as components from 'vuetify/components'
import * as directives from 'vuetify/directives'

import ImagesLeft from '@/components/settings/ImagesLeft.vue'

describe('ImagesLeft component', () => {
  let wrapper: any

  beforeEach(() => {
    const vuetify = createVuetify({ components, directives })

    wrapper = mount(ImagesLeft, {
      global: {
        plugins: [vuetify]
      },
      props: {
        status: {
          imagesLeft: 5
        }
      }
    })
  })

  it('renders the component', async () => {
    expect(wrapper.exists()).toBe(true)
  })

  it('renders the images icon and text', async () => {
    expect(wrapper.find('[data-testid="images-icon"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="images-text"]').exists()).toBe(true)
  })

  it('displays the correct number of images left', async () => {
    await wrapper.setProps({
      status: {
        imagesLeft: 3
      }
    })
    await nextTick()

    expect(wrapper.find('[data-testid="images-text"]').text()).toContain('3 / 10')
  })

  it('displays the correct color for the images icon based on imagesLeft', async () => {
    await wrapper.setProps({
      status: {
        imagesLeft: 0
      }
    })
    await nextTick()

    expect(wrapper.find('[data-testid="images-icon"]').classes('text-red-lighten-1')).toBe(true)

    await wrapper.setProps({
      status: {
        imagesLeft: 5
      }
    })
    await nextTick()

    expect(wrapper.find('[data-testid="images-icon"]').classes('text-red-lighten-1')).toBe(false)
  })

  it('displays the correct color for the images text based on imagesLeft', async () => {
    await wrapper.setProps({
      status: {
        imagesLeft: 0
      }
    })
    await nextTick()

    expect(wrapper.find('[data-testid="images-text"]').classes('text-red-lighten-1')).toBe(true)

    await wrapper.setProps({
      status: {
        imagesLeft: 5
      }
    })
    await nextTick()

    expect(wrapper.find('[data-testid="images-text"]').classes('text-red-lighten-1')).toBe(false)
  })

  it('displays the correct text for the images text based on imagesLeft', async () => {
    await wrapper.setProps({
      status: {
        imagesLeft: 0
      }
    })
    await nextTick()

    expect(wrapper.find('[data-testid="images-text"]').text()).toContain('0 / 10')

    await wrapper.setProps({
      status: {
        imagesLeft: 5
      }
    })
    await nextTick()

    expect(wrapper.find('[data-testid="images-text"]').text()).toContain('5 / 10')
  })

  it('displays 0 if status is null', async () => {
    await wrapper.setProps({
      status: null
    })
    await nextTick()

    expect(wrapper.find('[data-testid="images-text"]').text()).toContain('0 / 10')
  })

  it('displays 0 if imagesLeft is null', async () => {
    await wrapper.setProps({
      status: {
        imagesLeft: null
      }
    })
    await nextTick()

    expect(wrapper.find('[data-testid="images-text"]').text()).toContain('0 / 10')
  })

  it('displays 0 if imagesLeft is less than 0', async () => {
    await wrapper.setProps({
      status: {
        imagesLeft: -2
      }
    })
    await nextTick()
    expect(wrapper.find('[data-testid="images-text"]').text()).toContain('0 / 10')
  })
})
