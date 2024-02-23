import { mount, shallowMount } from '@vue/test-utils'
import { describe, it, expect, beforeEach } from 'vitest'
import { nextTick } from 'vue'

// component
import ThemeColorSelector from '../../../components/layout/ThemeColorSelector.vue'

describe('Theme color selection', () => {
  let wrapper 

  beforeEach(() => {
    wrapper = mount(ThemeColorSelector);
  })

  it('renders all color options and the component itself', () => {
    expect(wrapper.exists()).toBe(true)
    const colors = ['black', 'red', 'orange', 'yellow', 'green', 'blue', 'pink']
    colors.forEach(color => {
      expect(wrapper.find(`[data-testid="${color}-color-item"]`).exists()).toBe(true)
    })
  })

  it('ensures only one color is selected at a time', async () => {
    const firstColor = 'red'
    const secondColor = 'blue'

    await wrapper.find(`[data-testid="${firstColor}-color-item"]`).trigger('click')
    await nextTick()
  
    await wrapper.find(`[data-testid="${secondColor}-color-item"]`).trigger('click')
    await nextTick()

    expect(wrapper.find(`[data-testid="${firstColor}-color-item"]`).classes()).not.toContain('color-selected')
    expect(wrapper.find(`[data-testid="${secondColor}-color-item"]`).classes()).toContain('color-selected')
  })

  describe('Color button interactions', () => {
    it.each(['red', 'orange', 'yellow', 'green', 'blue', 'pink'])(
      'emits "color-change", applies class, and stores "%s" in local storage when clicked',
      async (color) => {
        const selector = wrapper.find(`[data-testid="${color}-color-item"]`)
        await selector.trigger('click')
        await nextTick()

        // Check emission of 'color-change'
        expect(wrapper.emitted('color-change')).toBeTruthy()
        expect(wrapper.emitted('color-change').slice(-1)[0][0]).toBe(color)

        expect(selector.classes()).toContain('color-selected')

        expect(localStorage.getItem('theme-color')).toBe(color)

        // Check if CSS variable is updated
        const computedStyle = window.getComputedStyle(document.documentElement)
        expect(computedStyle.getPropertyValue('--dynamic-bg-color')).toBe(`var(--${color}-color)`)
      }
    )
  })

  describe('Setting default color on load', () => {
    it('defaults to red if no color is set in local storage', async () => {
      localStorage.removeItem('theme-color') // Ensure no color is set
      const wrapper = shallowMount(ThemeColorSelector)
      await nextTick()
      const redSelector = wrapper.find('[data-testid="red-color-item"]')
      expect(redSelector.classes()).toContain('color-selected')
    })
  
    it('uses color from local storage if available', async () => {
      localStorage.setItem('theme-color', 'green')
      const wrapper = shallowMount(ThemeColorSelector);
      await nextTick()
      const greenSelector = wrapper.find('[data-testid="green-color-item"]')
      expect(greenSelector.classes()).toContain('color-selected')
    })
  })
})
