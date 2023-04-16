import { mount } from '@vue/test-utils'
import { describe, it, vi, expect, beforeEach } from 'vitest'
import { createVuetify } from 'vuetify'
import { nextTick } from 'vue'
import * as components from 'vuetify/components'

import PrinterPreviewBadge from '@/components/settings/PrinterPreviewBadge.vue'

global.ResizeObserver = vi.fn().mockImplementation(() => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn()
}))

describe('PrinterCard component', () => {
  let wrapper: any

  beforeEach(() => {
    const vuetify = createVuetify({ components })

    wrapper = mount(PrinterPreviewBadge, {
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

  it('renders the Bluetooth button when printerStatus is less than 1', () => {
    expect(wrapper.find('[data-testid="connect-button"]').exists()).toBe(true)
  })

  it('emits connect event when Bluetooth button is clicked', async () => {
    await wrapper.find('[data-testid="connect-button"]').trigger('click')
    await nextTick()
    expect(wrapper.emitted().connect).toBeTruthy()
  })

  it('renders the printer information when printerStatus is equal to or greater than 1', async () => {
    await wrapper.setProps({
      printerStatus: 1
    })
    await nextTick()
    expect(wrapper.find('.activator').exists()).toBe(true)
  })

  it('renders the correct printer name based on the status width', async () => {
    await wrapper.setProps({
      printerStatus: 1
    })
    await nextTick()
    expect(wrapper.find('.font-weight-bold').text()).toBe('Instax Mini Link')

    await wrapper.setProps({
      status: {
        ...wrapper.props().status,
        width: 800
      }
    })
    await nextTick()
    expect(wrapper.find('.font-weight-bold').text()).toBe('Instax Square Link')

    await wrapper.setProps({
      status: {
        ...wrapper.props().status,
        width: 1260,
        height: 840
      }
    })
    await nextTick()
    expect(wrapper.find('.font-weight-bold').text()).toBe('Instax Wide Link')
  })

  it('renders ImagesLeft and BatteryStatus components when printerStatus is equal to or greater than 1', async () => {
    await wrapper.setProps({
      printerStatus: 1
    })
    await nextTick()
    expect(wrapper.find('[data-testid="images-left"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="battery-status"]').exists()).toBe(true)
  })

  it('renders the loading state of the Bluetooth button when printerStatus is 0', async () => {
    await wrapper.setProps({
      printerStatus: 0
    })
    await nextTick()
    const connectButton = wrapper.find('[data-testid="connect-button"]')

    expect(connectButton.classes('v-btn--loading')).toBe(true)
  })

  it('renders PrinterStatus component when printerStatus is equal to or greater than 1', async () => {
    await wrapper.setProps({
      printerStatus: 1
    })
    await nextTick()
    expect(wrapper.find('[data-testid="printer-status"]').exists()).toBe(true)
  })

  it('does not render ImagesLeft, BatteryStatus, and PrinterStatus components when printerStatus is less than 1', () => {
    expect(wrapper.find('[data-testid="images-left"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="battery-status"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="printer-status"]').exists()).toBe(false)
  })
})
