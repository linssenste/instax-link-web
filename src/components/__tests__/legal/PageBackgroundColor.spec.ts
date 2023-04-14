import { mount } from '@vue/test-utils'
import { describe, it, expect, beforeEach } from 'vitest'
import PageBackgroundSelector from '@/components/legal/PageBackgroundSelector.vue'
import * as components from 'vuetify/components'
import * as directives from 'vuetify/directives'
import { createVuetify } from 'vuetify'
import { nextTick } from 'vue'

describe('Color selector', () => {
  let wrapper: any

  beforeEach(() => {
    const vuetify = createVuetify({ components, directives })

    wrapper = mount(PageBackgroundSelector, {
      global: {
        plugins: [vuetify]
      }
    })
  })

  it('selects pink color', async () => {
    const pink = wrapper.find('[data-testid="color-pink"]')
    await pink.trigger('click')
    await nextTick()
    expect(wrapper.vm.$data.selectedColor).toBe('pink')
  })

  it('selects red color', async () => {
    const red = wrapper.find('[data-testid="color-red"]')
    await red.trigger('click')
    await nextTick()
    expect(wrapper.vm.$data.selectedColor).toBe('red')
  })

  it('selects orange color', async () => {
    const orange = wrapper.find('[data-testid="color-orange"]')
    await orange.trigger('click')
    await nextTick()
    expect(wrapper.vm.$data.selectedColor).toBe('orange')
  })

  it('selects yellow color', async () => {
    const yellow = wrapper.find('[data-testid="color-yellow"]')
    await yellow.trigger('click')
    await nextTick()
    expect(wrapper.vm.$data.selectedColor).toBe('yellow')
  })

  it('selects green color', async () => {
    const green = wrapper.find('[data-testid="color-green"]')
    await green.trigger('click')
    await nextTick()
    expect(wrapper.vm.$data.selectedColor).toBe('green')
  })

  it('selects indigo color', async () => {
    const indigo = wrapper.find('[data-testid="color-indigo"]')
    await indigo.trigger('click')
    await nextTick()
    expect(wrapper.vm.$data.selectedColor).toBe('indigo')
  })

  it('selects purple color', async () => {
    const purple = wrapper.find('[data-testid="color-purple"]')
    await purple.trigger('click')
    await nextTick()
    expect(wrapper.vm.$data.selectedColor).toBe('purple')
  })
})
