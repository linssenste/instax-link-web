import { mount } from '@vue/test-utils'
import { describe, it, vi, expect, beforeEach } from 'vitest'
import { createVuetify } from 'vuetify'
import { nextTick } from 'vue'
import * as components from 'vuetify/components'

import PrinterStatusText from '@/components/settings/PrinterStatusText.vue'

global.ResizeObserver = vi.fn().mockImplementation(() => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn()
}))

describe('PrinterStatusText component', () => {
  let wrapper: any

  beforeEach(() => {
    const vuetify = createVuetify({ components })

    wrapper = mount(PrinterStatusText, {
      global: {
        plugins: [vuetify]
      },
      props: {
        printerStatus: -1,
        color: 'blue',
        center: false
      }
    })
  })

  it('renders "STANDBY" text when printerStatus is neither 2, 3, nor 4', () => {
    expect(wrapper.find('[data-testid="standby-text"]').exists()).toBe(true)
  })

  it('renders "SENDING" text when printerStatus is 2', async () => {
    await wrapper.setProps({ printerStatus: 2 })
    await nextTick()
    expect(wrapper.find('[data-testid="sending-text"]').exists()).toBe(true)
  })

  it('renders "Printing" text when printerStatus is 3', async () => {
    await wrapper.setProps({ printerStatus: 3 })
    await nextTick()
    expect(wrapper.find('[data-testid="printing-text"]').exists()).toBe(true)
  })

  it('renders "STOPPING" text when printerStatus is 4', async () => {
    await wrapper.setProps({ printerStatus: 4 })
    await nextTick()
    expect(wrapper.find('[data-testid="canceling-text"]').exists()).toBe(true)
  })

  it('renders the correct class based on the color prop', () => {
    expect(wrapper.find('.text-blue').exists()).toBe(true)
  })

  for (const status of [2, 3, 4]) {
    it('renders progress-circular when printerStatus is 2, 3, or 4', async () => {
      await wrapper.setProps({ printerStatus: status })
      await nextTick()
      expect(wrapper.find('[data-testid="status-loader"]').exists()).toBe(true)
    })
  }

  it('does not render progress-circular when printerStatus is neither 2, 3, nor 4', async () => {
    await wrapper.setProps({ printerStatus: 1 })
    await nextTick()
    expect(wrapper.find('[data-testid="status-loader"]').exists()).toBe(false)
  })

  it('applies the correct style when center prop is true', async () => {
    await wrapper.setProps({ center: true })
    await nextTick()
    const statusText = wrapper.find('[data-testid="status-text"]')
    expect(statusText.attributes('style')).not.toContain('width: 130px;')
  })

  it('applies the correct style when center prop is false', async () => {
    await wrapper.setProps({ center: false })
    await nextTick()
    const statusText = wrapper.find('[data-testid="status-text"]')
    expect(statusText.attributes('style')).toContain('width: 130px;')
  })
})
