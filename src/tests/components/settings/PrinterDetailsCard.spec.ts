import { mount } from '@vue/test-utils'
import { describe, it, vi, expect, beforeEach } from 'vitest'
import { createVuetify } from 'vuetify'
import { nextTick } from 'vue'
import * as components from 'vuetify/components'

import PrinterDetailsCard from '@/components/settings/PrinterDetailsCard.vue'

global.ResizeObserver = vi.fn().mockImplementation(() => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn()
}))

describe('PrinterMenu component', () => {
  let wrapper: any

  beforeEach(() => {
    const vuetify = createVuetify({ components })

    wrapper = mount(PrinterDetailsCard, {
      global: {
        plugins: [vuetify]
      },
      props: {
        status: {
          width: 600,
          height: 800,
          serialNumber: '12345678'
        },
        printerStatus: 1,
        color: 'blue'
      }
    })
  })

  it('renders the menu content', () => {
    expect(wrapper.find('[data-testid="menu-content"]').exists()).toBe(true)
  })

  it('renders the menu header with the correct printer name based on the status width', async () => {
    expect(wrapper.find('[data-testid="mini-link"]').exists()).toBe(true)

    wrapper.setProps({
      status: {
        ...wrapper.props().status,
        width: 800
      }
    })
    await nextTick()
    expect(wrapper.find('[data-testid="square-link"]').exists()).toBe(true)

    wrapper.setProps({
      status: {
        ...wrapper.props().status,
        width: 1260
      }
    })
    await nextTick()
    expect(wrapper.find('[data-testid="wide-link"]').exists()).toBe(true)
  })

  it('renders the menu body with the correct product image based on the status width', async () => {
    expect(wrapper.find('[data-testid="mini-image"]').exists()).toBe(true)

    wrapper.setProps({
      status: {
        ...wrapper.props().status,
        width: 800
      }
    })
    await nextTick()
    expect(wrapper.find('[data-testid="square-image"]').exists()).toBe(true)

    wrapper.setProps({
      status: {
        ...wrapper.props().status,
        width: 1260
      }
    })

    await nextTick()
    expect(wrapper.find('[data-testid="wide-image"]').exists()).toBe(true)
  })

  it('emits close event when the close button is clicked', async () => {
    await wrapper.find('[data-testid="close-button"]').trigger('click')
    await nextTick()
    expect(wrapper.emitted().close).toBeTruthy()
  })

  it('emits disconnect event when the disconnect button is clicked', async () => {
    await wrapper.setProps({
      printerStatus: 1
    })
    await wrapper.find('[data-testid="disconnect-button"]').trigger('click')
    await nextTick()
    expect(wrapper.emitted().disconnect).toBeTruthy()
  })

  it('renders the correct product link based on the status width', async () => {
    await wrapper.setProps({
      status: {
        ...wrapper.props().status,
        width: 600
      }
    })
    await nextTick()
    expect(wrapper.find('[data-testid="product-link"]').attributes('href')).toBe(
      'https://instax.com/mini_link_2/en/'
    )

    await wrapper.setProps({
      status: {
        ...wrapper.props().status,
        width: 800
      }
    })
    await nextTick()
    expect(wrapper.find('[data-testid="product-link"]').attributes('href')).toBe(
      'https://instax.com/square_link/en/'
    )

    await wrapper.setProps({
      status: {
        ...wrapper.props().status,
        width: 1260
      }
    })
    await nextTick()
    expect(wrapper.find('[data-testid="product-link"]').attributes('href')).toBe(
      'https://instax.com/link_wide/en/'
    )
  })

  it('renders the correct serial number based on the status object', async () => {
    await wrapper.setProps({
      status: {
        ...wrapper.props().status,
        serialNumber: 'ABC123'
      }
    })
    await nextTick()
    expect(wrapper.find('[data-testid="serial-number"]').text()).toBe('ABC123')

    await wrapper.setProps({
      status: {
        ...wrapper.props().status,
        serialNumber: 'XYZ789'
      }
    })
    await nextTick()
    expect(wrapper.find('[data-testid="serial-number"]').text()).toBe('XYZ789')
  })
})
