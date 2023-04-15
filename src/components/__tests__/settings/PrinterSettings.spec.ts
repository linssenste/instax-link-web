import { mount } from '@vue/test-utils'
import { describe, it, vi, expect, beforeEach } from 'vitest'
import { createVuetify } from 'vuetify'
import { nextTick } from 'vue'
import * as components from 'vuetify/components'

import PrinterSettings from '@/components/settings/PrinterSettings.vue'

global.ResizeObserver = vi.fn().mockImplementation(() => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn()
}))

describe('PrinterCard component', () => {
  let wrapper: any

  beforeEach(() => {
    const vuetify = createVuetify({ components })

    wrapper = mount(PrinterSettings, {
      global: {
        plugins: [vuetify]
      },
      props: {
        printerStatus: 1,
        printer: {},
        color: 'blue',
        hasBluetoothAccess: true
      }
    })
  })

  it('renders the "No Bluetooth access" message when hasBluetoothAccess is false', async () => {
    await wrapper.setProps({ hasBluetoothAccess: false })
    await nextTick()
    expect(wrapper.find('[data-testid="no-bluetooth-access"]').exists()).toBe(true)
  })

  it('renders the "API Browser Support" link when hasBluetoothAccess is false', async () => {
    await wrapper.setProps({ hasBluetoothAccess: false })
    await nextTick()
    expect(wrapper.find('[data-testid="no-bluetooth-access-help"]').exists()).toBe(true)
  })

  it('renders the PrinterPreviewBadge component when hasBluetoothAccess is true', () => {
    expect(wrapper.findComponent({ name: 'PrinterPreviewBadge' }).exists()).toBe(true)
  })

  it('renders the PrinterDetailsCard component when hasBluetoothAccess is true', () => {
    expect(wrapper.findComponent({ name: 'PrinterDetailsCard' }).exists()).toBe(true)
  })

  it('emits "connect" event when connectPrinter method is called', async () => {
    wrapper.vm.connectPrinter()
    await nextTick()
    expect(wrapper.emitted().connect).toBeTruthy()
  })

  it('does not emit "connect" event when hasBluetoothAccess is false and connectPrinter is called', async () => {
    await wrapper.setProps({ hasBluetoothAccess: false })
    wrapper.vm.connectPrinter()
    await nextTick()
    expect(wrapper.emitted().connect).toBeFalsy()
  })

  it('renders the v-menu component when hasBluetoothAccess is true', () => {
    expect(wrapper.findComponent({ name: 'VMenu' }).exists()).toBe(true)
  })

  it('does not render the v-menu component when hasBluetoothAccess is false', async () => {
    await wrapper.setProps({ hasBluetoothAccess: false })
    expect(wrapper.findComponent({ name: 'VMenu' }).exists()).toBe(false)
  })

  it('renders the "No Bluetooth access" message when hasBluetoothAccess is false', async () => {
    await wrapper.setProps({ hasBluetoothAccess: false })
    const noBluetoothAccess = wrapper.find('[data-testid="no-bluetooth-access"]')
    expect(noBluetoothAccess.exists()).toBe(true)
  })

  it('does not render the "No Bluetooth access" message when hasBluetoothAccess is true', () => {
    const noBluetoothAccess = wrapper.find('[data-testid="no-bluetooth-access"]')
    expect(noBluetoothAccess.exists()).toBe(false)
  })
})
