import { mount } from '@vue/test-utils'
import { describe, it, expect, beforeEach } from 'vitest'
import { createVuetify } from 'vuetify'
import { nextTick } from 'vue'
import * as components from 'vuetify/components'
import * as directives from 'vuetify/directives'

import ThemeColorSelector from '@/components/layout/ThemeColorSelector.vue'

describe('PolaroidSizeSelector', () => {
  let wrapper: any

  beforeEach(() => {
    const vuetify = createVuetify({ components, directives })

    wrapper = mount(ThemeColorSelector, {
      global: {
        plugins: [vuetify]
      }
    })
  })

  it('renders the component', () => {
    expect(wrapper.exists()).toBe(true)
  })

  it('emits the selected color when clicked', async () => {
    const pinkSelector = wrapper.find('[data-testid="pink-color-selector-item"]')
    await pinkSelector.trigger('click')
    await nextTick()
    expect(wrapper.emitted('color-change')).toBeTruthy()
    expect(wrapper.emitted('color-change')[0][0]).toBe('pink')
  })

  it('displays the selected color when clicked', async () => {
    const pinkSelector = wrapper.find('[data-testid="pink-color-selector-item"]')
    await pinkSelector.trigger('click')
    await nextTick()
    expect(pinkSelector.classes()).toContain('color-selector-item-selected')
  })

  it('stores the selected color in local storage', async () => {
    const orangeSelector = wrapper.find('[data-testid="orange-color-selector-item"]')
    await orangeSelector.trigger('click')
    await nextTick()
    expect(localStorage.getItem('background')).toBe('orange')
  })

  it('changes the selected color and updates the local storage when clicked', async () => {
    const redSelector = wrapper.find('[data-testid="red-color-selector-item"]')
    await redSelector.trigger('click')
    await nextTick()
    expect(wrapper.vm.selectedColor).toBe('red')
    expect(localStorage.getItem('background')).toBe('red')

    const orangeSelector = wrapper.find('[data-testid="orange-color-selector-item"]')
    await orangeSelector.trigger('click')
    await nextTick()
    expect(wrapper.vm.selectedColor).toBe('orange')
    expect(localStorage.getItem('background')).toBe('orange')
  })

  it('applies the selected color class to only one color selector item at a time', async () => {
    const orangeSelector = wrapper.find('[data-testid="orange-color-selector-item"]')
    const pinkSelector = wrapper.find('[data-testid="pink-color-selector-item"]')
    await orangeSelector.trigger('click')
    await nextTick()
    expect(orangeSelector.classes()).toContain('color-selector-item-selected')
    expect(pinkSelector.classes()).not.toContain('color-selector-item-selected')
  })

  it('displays all available color selector items', () => {
    const pinkSelector = wrapper.find('[data-testid="pink-color-selector-item"]')
    const redSelector = wrapper.find('[data-testid="red-color-selector-item"]')
    const orangeSelector = wrapper.find('[data-testid="orange-color-selector-item"]')
    const purpleSelector = wrapper.find('[data-testid="purple-color-selector-item"]')

    expect(pinkSelector.exists()).toBe(true)
    expect(redSelector.exists()).toBe(true)
    expect(orangeSelector.exists()).toBe(true)
    expect(purpleSelector.exists()).toBe(true)
  })
})
