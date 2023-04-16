import { mount } from '@vue/test-utils'
import { createVuetify } from 'vuetify'
import { describe, it, vi, expect, beforeEach } from 'vitest'
import * as components from 'vuetify/components'
import * as directives from 'vuetify/directives'
import router from '@/router'
import 'regenerator-runtime/runtime'
import { RouterView } from 'vue-router'

import App from '@/App.vue'
import PrinterAppTemplate from '@/components/layout/PrinterAppTemplate.vue'
global.ResizeObserver = vi.fn().mockImplementation(() => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn()
}))

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

describe('App.vue', () => {
  let wrapper: any

  beforeEach(() => {
    const vuetify = createVuetify({ components, directives })

    wrapper = mount(App, {
      global: {
        plugins: [vuetify, router]
      }
    })
  })

  it('renders the App component', async () => {
    expect(wrapper.exists()).toBe(true)
  })

  it('renders the PrinterAppTemplate component', async () => {
    expect(wrapper.findComponent({ name: 'PrinterAppTemplate' }).exists()).toBe(true)
  })

  it('navigates to /creator route when the app is loaded', async () => {
    await delay(100)

    expect(router.currentRoute.value.name).toBe('instax-creator')
  })

  it('renders router-view component', async () => {
    expect(wrapper.findComponent({ name: 'RouterView' }).exists()).toBe(true)
  })

  it('updates themeColor when color-update event is emitted', async () => {
    const newColor = 'blue'
    wrapper.findComponent({ name: 'PrinterAppTemplate' }).vm.$emit('color-update', newColor)
    await wrapper.vm.$nextTick()
    expect(wrapper.vm.themeColor).toBe(newColor)
  })

  it('updates config when config-update event is emitted', async () => {
    const newConfig = {
      width: 1000,
      height: 1000
    }
    wrapper.findComponent({ name: 'PrinterAppTemplate' }).vm.$emit('config-update', newConfig)
    await wrapper.vm.$nextTick()
    expect(wrapper.vm.config).toEqual(newConfig)
  })

  it('renders the PrinterAppTemplate component', () => {
    const printerAppTemplate = wrapper.findComponent(PrinterAppTemplate)
    expect(printerAppTemplate.exists()).toBe(true)
  })

  it('renders the router-view element', () => {
    const routerView = wrapper.findComponent(RouterView)
    expect(routerView.exists()).toBe(true)
  })
})
