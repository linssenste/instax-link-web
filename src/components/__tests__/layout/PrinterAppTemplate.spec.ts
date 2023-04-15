import { mount } from '@vue/test-utils'
import { describe, it, expect, beforeEach } from 'vitest'
import { createVuetify } from 'vuetify'
import { nextTick } from 'vue'
import * as components from 'vuetify/components'
import * as directives from 'vuetify/directives'

import PrinterAppTemplate from '@/components/layout/PrinterAppTemplate.vue'
import PolaroidSizeSelector from '@/components/layout/PolaroidSizeSelector.vue'
import ThemeColorSelector from '@/components/layout/ThemeColorSelector.vue'
import PrinterSettings from '@/components/settings/PrinterSettings.vue'

describe('PolaroidSizeSelector', () => {
  let wrapper: any

  beforeEach(() => {
    const vuetify = createVuetify({ components, directives })

    wrapper = mount(PrinterAppTemplate, {
      global: {
        plugins: [vuetify]
      }
    })
  })

  it('renders the PolaroidSizeSelector component', () => {
    const polaroidSizeSelector = wrapper.findComponent(PolaroidSizeSelector)
    expect(polaroidSizeSelector.exists()).toBe(true)
  })

  it('renders the ThemeColorSelector component', () => {
    const themeColorSelector = wrapper.findComponent(ThemeColorSelector)
    expect(themeColorSelector.exists()).toBe(true)
  })

  it('renders the PrinterSettings component', () => {
    const printerSettings = wrapper.findComponent(PrinterSettings)
    expect(printerSettings.exists()).toBe(true)
  })

  it('emits config-update event when PolaroidSizeSelector emits resize event', async () => {
    const newSize = { width: 600, height: 600 }
    wrapper.findComponent(PolaroidSizeSelector).vm.$emit('resize', newSize)

    await nextTick()

    expect(wrapper.emitted('config-update')).toBeTruthy()
    expect(wrapper.emitted('config-update')[0]).toEqual([newSize])
  })

  it('emits color-update event when ThemeColorSelector emits color-change event', async () => {
    const newColor = 'blue'

    wrapper.vm.themeColor = newColor

    await nextTick()

    expect(wrapper.emitted('color-update')).toBeTruthy()
    expect(wrapper.emitted('color-update')[1]).toEqual([newColor])
  })

  // ... add more tests for the component's behavior
})
