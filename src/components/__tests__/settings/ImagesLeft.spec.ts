import { mount } from '@vue/test-utils'
import { describe, it, expect, beforeEach } from 'vitest'
import { createVuetify } from 'vuetify'
import { nextTick } from 'vue'
import * as components from 'vuetify/components'
import * as directives from 'vuetify/directives'

import ImagesLeft from '@/components/settings/ImagesLeft.vue'

describe('Images left badge', () => {
  let wrapper: any

  beforeEach(() => {
    const vuetify = createVuetify({ components, directives })

    wrapper = mount(ImagesLeft, {
      global: {
        plugins: [vuetify]
      },
      props: {
        isPrinting: false,
        status: {
          imagesLeft: 5
        }
      }
    })
  })

  it('renders the images icon if not printing and status is not null', async () => {
    expect(wrapper.find('[data-testid="images-icon"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="images-text"]').exists()).toBe(true)
  })

  it('renders printing text if isPrinting is true', async () => {
    await wrapper.setProps({
      isPrinting: true
    })
    await nextTick()

    expect(wrapper.find('[data-testid="printing-text"]').exists()).toBe(true)
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
        imagesLeft: 1
      }
    })
    await nextTick()

    expect(wrapper.find('[data-testid="images-icon"]').classes('text-red')).toBe(true)

    await wrapper.setProps({
      status: {
        imagesLeft: 5
      }
    })
    await nextTick()

    expect(wrapper.find('[data-testid="images-icon"]').classes('text-red')).toBe(false)
  })
})
