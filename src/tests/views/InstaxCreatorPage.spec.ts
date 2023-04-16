import { mount } from '@vue/test-utils'
import { createVuetify } from 'vuetify'
import { describe, it, vi, expect, beforeEach } from 'vitest'
import { nextTick } from 'vue'
import * as components from 'vuetify/components'
import * as directives from 'vuetify/directives'
import 'regenerator-runtime/runtime'

import InstaxCreatorPage from '@/views/InstaxCreatorPage.vue'
global.ResizeObserver = vi.fn().mockImplementation(() => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn()
}))
describe('Component tests', () => {
  let wrapper: any

  const printMock = vi.fn()

  beforeEach(() => {
    const vuetify = createVuetify({ components, directives })

    wrapper = mount(InstaxCreatorPage, {
      global: {
        plugins: [vuetify]
      },
      props: {
        color: 'primary',
        printerStatus: -1,
        config: {
          width: 800,
          height: 800,
          imagesLeft: 10
        },
        print: printMock
      }
    })
  })

  it('renders the component', async () => {
    expect(wrapper.exists()).toBe(true)
  })

  it('renders the PolaroidEditor component', async () => {
    expect(wrapper.findComponent({ name: 'PolaroidEditor' }).exists()).toBe(true)
  })

  it('renders the disabled download button if no connection', async () => {
    expect(wrapper.find('[data-testid="download-button"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="print-button"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="download-button"]').attributes('class')).toContain(
      'v-btn--disabled'
    )
  })

  it('renders the download & print button disabled if connected but no valid image', async () => {
    wrapper.setProps({
      printerStatus: 1,
      config: {
        width: 1260,
        height: 800
      }
    })
    await nextTick()

    expect(wrapper.find('[data-testid="print-button"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="download-button"]').attributes('class')).toContain(
      'v-btn--disabled'
    )
  })

  //   it('renders the PrinterStatusText component when there is no fatal print error', async () => {
  //     expect(wrapper.findComponent({ name: 'PrinterStatusText' }).exists()).toBe(true)
  //   })

  //   it('renders the ConfettiExplosion component when showExplosion is true', async () => {
  //     wrapper.vm.showExplosion = true
  //     await nextTick()

  //     expect(wrapper.findComponent({ name: 'ConfettiExplosion' }).exists()).toBe(true)
  //   })

  //   it('calls printImageRequest when the print button is clicked', async () => {
  //     wrapper.setProps({
  //       printerStatus: 1,
  //       config: {
  //         width: 1260,
  //         height: 800
  //       }
  //     })
  //     await nextTick()

  //     wrapper.vm.isSaveable = true
  //     await nextTick()
  //     const toggleStatus = wrapper.vm.togglePrinting
  //     let printButton = wrapper.find('[data-testid="print-button"]')

  //     expect(printButton.exists()).toBe(true)
  //     await printButton.trigger('click')
  //     // wrapper.find('[data-testid="print-button"]').trigger('click')
  //     await nextTick()
  //     expect(wrapper.vm.togglePrinting).toBe(!toggleStatus)
  //     expect(wrapper.vm.loadPrinting).toBe(true)
  //     printButton = wrapper.find('[data-testid="print-button"]')

  //     const cancelButton = wrapper.find('[data-testid="cancel-button"]')
  //     expect(printButton.exists()).toBe(false)
  //     expect(cancelButton.exists()).toBe(true)

  //     expect(cancelButton.attributes('class')).toContain('v-btn--loading')
  //   })

  it('updates totalPrints when the plus and minus buttons are clicked', async () => {
    wrapper.setProps({
      printerStatus: 2,
      config: {
        width: 1260,
        height: 800
      }
    })
    await nextTick()
    const minusButton = wrapper.find('[data-testid="minus-button"]')
    const plusButton = wrapper.find('[data-testid="plus-button"]')

    await minusButton.trigger('click')
    await nextTick()
    expect(wrapper.vm.totalPrints).toBe(1) // Can't go below 1

    await plusButton.trigger('click')
    await nextTick()
    expect(wrapper.vm.totalPrints).toBe(2)

    await plusButton.trigger('click')
    await nextTick()
    expect(wrapper.vm.totalPrints).toBe(3)

    await minusButton.trigger('click')
    await nextTick()
    expect(wrapper.vm.totalPrints).toBe(2)
  })

  it('disables the print button when isSaveable is false', async () => {
    wrapper.setProps({
      printerStatus: 1
    })
    await nextTick()
    wrapper.vm.isSaveable = false
    await nextTick()

    expect(wrapper.find('[data-testid="print-button"]').attributes('disabled')).toBeDefined()
  })

  it('enables the print button when isSaveable is true', async () => {
    wrapper.setProps({
      printerStatus: 1
    })
    await nextTick()
    wrapper.vm.isSaveable = true
    await nextTick()

    expect(wrapper.find('[data-testid="print-button"]').attributes('disabled')).toBeUndefined()
  })

  it('displays a printing error message when fatalPrintError is true', async () => {
    wrapper.setProps({
      printerStatus: 2
    })
    await nextTick()
    wrapper.vm.fatalPrintError = true
    await nextTick()

    expect(wrapper.find('[data-testid="printing-error"]').exists()).toBe(true)
  })
})
