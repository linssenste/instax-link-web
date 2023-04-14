import { mount } from '@vue/test-utils'
import { describe, it, vi, expect, beforeEach } from 'vitest'
import { createVuetify } from 'vuetify'
import { nextTick } from 'vue'
import * as components from 'vuetify/components'

import PrinterCard from '@/components/settings/PrinterCard.vue'

global.ResizeObserver = vi.fn().mockImplementation(() => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn()
}))
describe('Images left badge', () => {
  let wrapper: any

  beforeEach(() => {
    const vuetify = createVuetify({ components })

    wrapper = mount(PrinterCard, {
      global: {
        plugins: [vuetify]
      },
      props: {
        isConnected: false,
        isPrinting: false,
        loading: false,
        status: {
          imagesLeft: 5,
          isCharging: true,
          batteryLevel: 80
        }
      }
    })
  })

  it('renders connected product image when isConnected is true and loading is false', async () => {
    await wrapper.setProps({
      loading: false,
      isConnected: true
    })
    await nextTick()
    expect(wrapper.find('[data-testid="product-image-connected"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="product-image-disconnected"]').exists()).toBe(false)

    await wrapper.setProps({
      loading: false,
      isConnected: false
    })
    await nextTick()
    expect(wrapper.find('[data-testid="product-image-connected"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="product-image-disconnected"]').exists()).toBe(true)

    await wrapper.setProps({
      loading: true,
      isConnected: false
    })
    await nextTick()
    expect(wrapper.find('[data-testid="product-image-connected"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="product-image-disconnected"]').exists()).toBe(true)
  })

  it('renders disconnected product image when isConnected is false and loading is false', async () => {
    await wrapper.setProps({
      isConnected: false,
      loading: false
    })
    await nextTick()
    expect(wrapper.find('[data-testid="product-image-connected"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="product-image-disconnected"]').exists()).toBe(true)
  })

  it('renders Connect printer button when isConnected is false and loading is false', async () => {
    expect(wrapper.find('[data-testid="connect-button"]').exists()).toBe(true)
  })

  it('renders button when loading is true', async () => {
    await wrapper.setProps({
      loading: true
    })
    await nextTick()
    // expect(wrapper.find('[data-testid="product-image-connected"]').exists()).toBe(false)
    // expect(wrapper.find('[data-testid="product-image-disconnected"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="connect-button"]').exists()).toBe(true)
  })

  it('emits connect event when Connect printer button is clicked', async () => {
    await wrapper.find('button').trigger('click')
    expect(wrapper.emitted().connect).toBeTruthy()
  })

  it('renders ImagesLeft and BatteryStatus components when isConnected is true and loading is false', async () => {
    await wrapper.setProps({
      loading: false,
      isConnected: true
    })
    expect(wrapper.find('[data-testid="images-left"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="battery-status"]').exists()).toBe(true)
  })
})
