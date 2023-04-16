import { mount } from '@vue/test-utils'
import { describe, it, expect, beforeEach } from 'vitest'
import { createVuetify } from 'vuetify'
import { nextTick } from 'vue'
import * as components from 'vuetify/components'

import BatteryStatus from '@/components/settings/BatteryStatus.vue'

describe('Battery status badge', () => {
  let wrapper: any

  beforeEach(() => {
    const vuetify = createVuetify({ components })

    wrapper = mount(BatteryStatus, {
      global: {
        plugins: [vuetify]
      },
      props: {
        status: null
      }
    })
  })

  it('renders the component', async () => {
    expect(wrapper.exists()).toBe(true)
  })

  it('does not render if status is null', async () => {
    expect(wrapper.find('[data-testid="battery-status"]').exists()).toBe(false)
  })

  it('renders the battery icon if status is not null and is not charging', async () => {
    await wrapper.setProps({
      status: {
        isCharging: false,
        batteryLevel: 80
      }
    })
    await nextTick()

    expect(wrapper.find('[data-testid="battery-status"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="battery-icon"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="battery-text"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="battery-text"]').text()).toContain('80 %')
  })

  it('renders the charging icon if status is not null and is charging', async () => {
    await wrapper.setProps({
      status: {
        isCharging: true,
        batteryLevel: 80
      }
    })
    await nextTick()

    expect(wrapper.find('[data-testid="battery-status"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="charging-icon"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="battery-text"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="battery-text"]').text()).toContain('POWER')
  })

  it('uses the correct color based on battery level and charging status', async () => {
    await wrapper.setProps({
      status: {
        isCharging: false,
        batteryLevel: 10
      }
    })
    await nextTick()

    expect(
      wrapper
        .find('[data-testid="battery-status"] [data-testid="battery-icon"]')
        .classes('text-red-darken-1')
    ).toBe(true)

    await wrapper.setProps({
      status: {
        isCharging: false,
        batteryLevel: 30
      }
    })
    await nextTick()

    expect(
      wrapper
        .find('[data-testid="battery-status"] [data-testid="battery-icon"]')
        .classes('text-grey-darken-2')
    ).toBe(true)

    await wrapper.setProps({
      status: {
        isCharging: false,
        batteryLevel: 95
      }
    })
    await nextTick()

    expect(
      wrapper
        .find('[data-testid="battery-status"] [data-testid="battery-icon"]')
        .classes('text-green-darken-1')
    ).toBe(true)

    await wrapper.setProps({
      status: {
        isCharging: true,
        batteryLevel: 60
      }
    })
    await nextTick()

    expect(
      wrapper
        .find('[data-testid="battery-status"] [data-testid="charging-icon"]')
        .classes('text-green-darken-1')
    ).toBe(true)
  })
})
