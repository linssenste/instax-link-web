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

describe('PrinterCard component', () => {
  let wrapper: any

  beforeEach(() => {
    const vuetify = createVuetify({ components })

    wrapper = mount(PrinterStatusText, {
      global: {
        plugins: [vuetify]
      },
      props: {
        status: {
          width: 600,
          height: 800
        },
        printerStatus: -1,
        color: 'blue'
      }
    })
  })

  it('renders "STANDBY" text when printerStatus is neither 2 nor 3', () => {
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
})
