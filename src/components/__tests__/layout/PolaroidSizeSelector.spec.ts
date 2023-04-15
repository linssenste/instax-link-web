import { mount } from '@vue/test-utils'
import { describe, it, expect, beforeEach } from 'vitest'
import { createVuetify } from 'vuetify'
import { nextTick } from 'vue'
import * as components from 'vuetify/components'
import * as directives from 'vuetify/directives'

import PolaroidSizeSelector from '@/components/layout/PolaroidSizeSelector.vue'

describe('PolaroidSizeSelector', () => {
  let wrapper: any

  beforeEach(() => {
    const vuetify = createVuetify({ components, directives })

    wrapper = mount(PolaroidSizeSelector, {
      global: {
        plugins: [vuetify]
      },
      props: {
        color: 'red',
        isConnected: true,

        config: {
          width: 800,
          height: 800
        }
      }
    })
  })

  it('renders the component without errors', () => {
    expect(wrapper.exists()).toBeTruthy()
  })

  it('displays correct polaroid size initially', async () => {
    expect(wrapper.vm.selectedWidth).toBe(800)
  })

  it('emits update event with correct payload when selecting a different polaroid size', async () => {
    await wrapper.setProps({
      isConnected: false,
      config: {
        width: 800,
        height: 800
      }
    })

    await nextTick()
    const polaroid800 = wrapper.find('[data-testid="polaroid-600"]')
    await polaroid800.trigger('click')

    await nextTick()
    expect(wrapper.emitted()).toHaveProperty('resize')
    expect(wrapper.emitted().resize[0]).toEqual([{ width: 600, height: 800 }])
  })

  it('emits update event with correct payload when selecting different polaroid size', async () => {
    await wrapper.setProps({
      isConnected: false,
      config: {
        width: 800,
        height: 800
      }
    })

    await nextTick()
    let polaroid600 = wrapper.find('[data-testid="polaroid-600"]')
    await polaroid600.trigger('click')

    await nextTick()
    expect(wrapper.emitted()).toHaveProperty('resize')
    expect(wrapper.emitted().resize[0]).toEqual([{ width: 600, height: 800 }])
    expect(wrapper.vm.selectedWidth).toBe(600)

    const polaroid800 = wrapper.find('[data-testid="polaroid-800"]')
    await polaroid800.trigger('click')

    await nextTick()
    expect(wrapper.emitted()).toHaveProperty('resize')
    expect(wrapper.emitted().resize[1]).toEqual([{ width: 800, height: 800 }])
    expect(wrapper.vm.selectedWidth).toBe(800)

    const polaroid1260 = wrapper.find('[data-testid="polaroid-1260"]')
    await polaroid1260.trigger('click')

    await nextTick()
    expect(wrapper.emitted()).toHaveProperty('resize')
    expect(wrapper.emitted().resize[2]).toEqual([{ width: 1260, height: 800 }])
    expect(wrapper.vm.selectedWidth).toBe(1260)

    await nextTick()
    polaroid600 = wrapper.find('[data-testid="polaroid-600"]')
    await polaroid600.trigger('click')

    await nextTick()
    expect(wrapper.emitted()).toHaveProperty('resize')
    expect(wrapper.emitted().resize[0]).toEqual([{ width: 600, height: 800 }])
    expect(wrapper.vm.selectedWidth).toBe(600)
  })

  it('shows Bluetooth icon when isConnected prop is true and config width matches polaroid size 600x800', async () => {
    wrapper.setProps({
      isConnected: true,
      config: {
        width: 600,
        height: 800
      }
    })
    await nextTick()
    const bluetoothIcon600 = wrapper.find('[data-testid="polaroid-600"] .mdi-bluetooth')
    expect(bluetoothIcon600.exists()).toBeTruthy()

    const bluetoothIcon800 = wrapper.find('[data-testid="polaroid-800"] .mdi-bluetooth')
    expect(bluetoothIcon800.exists()).toBeFalsy()

    const bluetoothIcon1260 = wrapper.find('[data-testid="polaroid-1260"] .mdi-bluetooth')
    expect(bluetoothIcon1260.exists()).toBeFalsy()
  })

  it('shows Bluetooth icon when isConnected prop is true and config width matches polaroid size 800x800', async () => {
    wrapper.setProps({
      isConnected: true,
      config: {
        width: 800,
        height: 800
      }
    })
    await nextTick()
    const bluetoothIcon600 = wrapper.find('[data-testid="polaroid-600"] .mdi-bluetooth')
    expect(bluetoothIcon600.exists()).toBeFalsy()

    const bluetoothIcon800 = wrapper.find('[data-testid="polaroid-800"] .mdi-bluetooth')
    expect(bluetoothIcon800.exists()).toBeTruthy()

    const bluetoothIcon1260 = wrapper.find('[data-testid="polaroid-1260"] .mdi-bluetooth')
    expect(bluetoothIcon1260.exists()).toBeFalsy()
  })

  it('shows Bluetooth icon when isConnected prop is true and config width matches polaroid size 1260x800', async () => {
    wrapper.setProps({
      isConnected: true,
      config: {
        width: 1260,
        height: 800
      }
    })
    await nextTick()
    const bluetoothIcon600 = wrapper.find('[data-testid="polaroid-600"] .mdi-bluetooth')
    expect(bluetoothIcon600.exists()).toBeFalsy()

    const bluetoothIcon800 = wrapper.find('[data-testid="polaroid-800"] .mdi-bluetooth')
    expect(bluetoothIcon800.exists()).toBeFalsy()

    const bluetoothIcon1260 = wrapper.find('[data-testid="polaroid-1260"] .mdi-bluetooth')
    expect(bluetoothIcon1260.exists()).toBeTruthy()
  })

  it('updates polaroid size display when selecting a different size', async () => {
    wrapper.setProps({
      isConnected: false,
      config: {
        width: 800,
        height: 800
      }
    })
    const polaroid1260 = wrapper.find('[data-testid="polaroid-1260"]')
    await polaroid1260.trigger('click')
    await nextTick()
    expect(wrapper.vm.selectedWidth).toBe(1260)

    const polaroid800 = wrapper.find('[data-testid="polaroid-800"]')
    await polaroid800.trigger('click')
    await nextTick()
    expect(wrapper.vm.selectedWidth).toBe(800)

    const polaroid600 = wrapper.find('[data-testid="polaroid-600"]')
    await polaroid600.trigger('click')
    await nextTick()
    expect(wrapper.vm.selectedWidth).toBe(600)
  })

  it('adds disabled class to other polaroids when isConnected prop is true and size 600x800', async () => {
    wrapper.setProps({ isConnected: true, config: { width: 600, height: 800 } })
    await nextTick()
    const polaroid600 = wrapper.find('[data-testid="polaroid-600"]')
    const polaroid800 = wrapper.find('[data-testid="polaroid-800"]')
    const polaroid1260 = wrapper.find('[data-testid="polaroid-1260"]')

    expect(polaroid600.classes()).not.toContain('disabled')
    expect(polaroid800.classes()).toContain('disabled')

    expect(polaroid1260.classes()).toContain('disabled')
  })

  it('adds disabled class to other polaroids when isConnected prop is true and size 800x800', async () => {
    wrapper.setProps({ isConnected: true, config: { width: 800, height: 800 } })
    await nextTick()
    const polaroid600 = wrapper.find('[data-testid="polaroid-600"]')
    const polaroid800 = wrapper.find('[data-testid="polaroid-800"]')
    const polaroid1260 = wrapper.find('[data-testid="polaroid-1260"]')

    expect(polaroid600.classes()).toContain('disabled')
    expect(polaroid800.classes()).not.toContain('disabled')

    expect(polaroid1260.classes()).toContain('disabled')
  })

  it('adds disabled class to other polaroids when isConnected prop is true and size 1260x800', async () => {
    wrapper.setProps({ isConnected: true, config: { width: 1260, height: 800 } })
    await nextTick()
    const polaroid600 = wrapper.find('[data-testid="polaroid-600"]')
    const polaroid800 = wrapper.find('[data-testid="polaroid-800"]')
    const polaroid1260 = wrapper.find('[data-testid="polaroid-1260"]')

    expect(polaroid600.classes()).toContain('disabled')
    expect(polaroid800.classes()).toContain('disabled')

    expect(polaroid1260.classes()).not.toContain('disabled')
  })
})
