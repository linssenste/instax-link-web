import { mount } from '@vue/test-utils'
import { describe, it, expect, beforeEach } from 'vitest'
import { createVuetify } from 'vuetify'
import { nextTick } from 'vue'
import * as components from 'vuetify/components'
import * as directives from 'vuetify/directives'

import ColorSelector from '@/components/polaroid/ColorSelector.vue'

describe('ColorSelector', () => {
  let wrapper: any

  beforeEach(() => {
    const vuetify = createVuetify({ components, directives })

    wrapper = mount(ColorSelector, {
      global: {
        plugins: [vuetify]
      }
    })
  })

  it('renders the component', () => {
    expect(wrapper.exists()).toBe(true)
  })

  const colors = [
    { name: 'white', hex: '#FFFFFF' },
    { name: 'black', hex: '#000000' },
    { name: 'purple', hex: '#665BC0' },
    { name: 'indigo', hex: '#68C0C0' },
    { name: 'red', hex: '#BB2D1B' },
    { name: 'orange', hex: '#EE8740' },
    { name: 'yellow', hex: '#F8DA5F' },
    { name: 'pink', hex: '#E16FBC' }
  ]

  colors.forEach((color, index) => {
    it(`emits the ${color.name} color when clicked`, async () => {
      const selector = wrapper.find(`[data-testid="${color.name}-color-selector-item"]`)
      await selector.trigger('click')
      await nextTick()
      console.log(wrapper.emitted('color-change'), index)
      expect(wrapper.emitted('color-change')).toBeTruthy()
      expect(wrapper.emitted('color-change')[0][0]).toBe(color.hex)
    })

    it(`displays the ${color.name} color when clicked`, async () => {
      const selector = wrapper.find(`[data-testid="${color.name}-color-selector-item"]`)
      await selector.trigger('click')
      await nextTick()
      expect(selector.classes()).toContain('color-selector-item-selected')
    })
  })

  it('applies the selected color class to only one color selector item at a time', async () => {
    const firstSelector = wrapper.find('[data-testid="black-color-selector-item"]')
    const secondSelector = wrapper.find('[data-testid="white-color-selector-item"]')
    await firstSelector.trigger('click')
    await nextTick()
    expect(firstSelector.classes()).toContain('color-selector-item-selected')
    expect(secondSelector.classes()).not.toContain('color-selector-item-selected')
  })

  it('displays all available color selector items', () => {
    colors.forEach((color) => {
      const selector = wrapper.find(`[data-testid="${color.name}-color-selector-item"]`)
      expect(selector.exists()).toBe(true)
    })
  })
})
