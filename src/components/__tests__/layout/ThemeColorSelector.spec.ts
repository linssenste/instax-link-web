import { mount, shallowMount } from '@vue/test-utils'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { nextTick } from 'vue'

// component
import ThemeColorSelector from '../../../components/layout/ThemeColorSelector.vue'

describe('Theme color selection', () => {
  let wrapper 

  beforeEach(() => {
    wrapper = mount(ThemeColorSelector);
    // the load colour is random, so drop into black first: nothing is then active
    // and every click in these tests is a fresh selection rather than the toggle
    wrapper.vm.changeThemeColor('black');
  })

  it('renders all color options and the component itself', () => {
    expect(wrapper.exists()).toBe(true)
    expect(wrapper.vm.colors.length).toBeGreaterThan(0)

    wrapper.vm.colors.forEach(color => {
      expect(wrapper.find(`[data-testid="${color}-color-item"]`).exists()).toBe(true)
    })

    // no stray swatches beyond the palette
    expect(wrapper.findAll('.color-item')).toHaveLength(wrapper.vm.colors.length)
  })

  describe('Accessibility', () => {
    it('exposes every swatch as a named button', () => {
      wrapper.vm.colors.forEach(color => {
        const swatch = wrapper.find(`[data-testid="${color}-color-item"]`)
        expect(swatch.element.tagName).toBe('BUTTON')
        expect(swatch.attributes('aria-label')).toBe(`Theme color ${color}`)
      })
    })

    it('marks the active swatch as pressed', async () => {
      wrapper.vm.changeThemeColor('blue')
      await nextTick()

      expect(wrapper.find('[data-testid="blue-color-item"]').attributes('aria-pressed')).toBe('true')
      expect(wrapper.find('[data-testid="red-color-item"]').attributes('aria-pressed')).toBe('false')
    })

    it('groups the swatches under a label', () => {
      const group = wrapper.find('[role="group"]')
      expect(group.exists()).toBe(true)
      expect(group.attributes('aria-label')).toBe('Theme color')
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
    it.each(mount(ThemeColorSelector).vm.colors)(
      'emits "color-change", applies class, and stores "%s" in local storage when clicked',
      async (color) => {
        const selector = wrapper.find(`[data-testid="${color}-color-item"]`)
        await selector.trigger('click')
        await nextTick()

        // Check emission of 'color-change'
        expect(wrapper.emitted('color-change')).toBeTruthy()
        expect(wrapper.emitted('color-change').slice(-1)[0][0]).toBe(color)

        expect(selector.classes()).toContain('color-selected')

        // Check if CSS variable is updated
        const computedStyle = window.getComputedStyle(document.documentElement)
        expect(computedStyle.getPropertyValue('--dynamic-bg-color')).toBe(`var(--${color}-color)`)
      }
    )
  })

  describe('Setting a color on load', () => {
    it('picks one of the palette colors at random', async () => {
      const random = vi.spyOn(Math, 'random').mockReturnValue(0)
      const first = shallowMount(ThemeColorSelector)
      await nextTick()

      expect(first.vm.selectedColor).toBe(first.vm.colors[0])
      expect(first.find(`[data-testid="${first.vm.colors[0]}-color-item"]`).classes()).toContain('color-selected')
      first.unmount()

      // just under 1 lands on the last entry rather than off the end
      random.mockReturnValue(0.999)
      const last = shallowMount(ThemeColorSelector)
      await nextTick()

      expect(last.vm.selectedColor).toBe(last.vm.colors[last.vm.colors.length - 1])
      last.unmount()
      random.mockRestore()
    })

    it('never opens in black, which is the hidden mode', () => {
      for (const value of [0, 0.2, 0.5, 0.75, 0.999]) {
        const random = vi.spyOn(Math, 'random').mockReturnValue(value)
        const fresh = shallowMount(ThemeColorSelector)

        expect(fresh.vm.selectedColor).not.toBe('black')
        expect(fresh.vm.colors).not.toContain('black')

        fresh.unmount()
        random.mockRestore()
      }
    })

    it('emits the randomly chosen color on load', async () => {
      const random = vi.spyOn(Math, 'random').mockReturnValue(0)
      const fresh = shallowMount(ThemeColorSelector)
      await nextTick()

      expect(fresh.emitted('color-change')[0][0]).toBe(fresh.vm.colors[0])
      fresh.unmount()
      random.mockRestore()
    })

    it('keeps nothing in local storage, so the next load is independent', async () => {
      localStorage.clear()

      const fresh = shallowMount(ThemeColorSelector)
      await nextTick()
      fresh.find('[data-testid="blue-color-item"]').trigger('click')
      await nextTick()

      expect(localStorage.getItem('theme-color')).toBeNull()
      fresh.unmount()
    })
  })

  describe('Black and white mode', () => {
    const swatch = (color: string) => wrapper.find(`[data-testid="${color}-color-item"]`)

    it('falls back to black when the active color is clicked again', async () => {
      await swatch('blue').trigger('click')
      expect(wrapper.vm.selectedColor).toBe('blue')

      await swatch('blue').trigger('click')
      await nextTick()

      expect(wrapper.vm.selectedColor).toBe('black')
      expect(wrapper.emitted('color-change').slice(-1)[0][0]).toBe('black')
    })

    it('leaves no swatch marked as active in black and white', async () => {
      await swatch('green').trigger('click')
      await swatch('green').trigger('click')
      await nextTick()

      wrapper.vm.colors.forEach(color => {
        expect(swatch(color).classes()).not.toContain('color-selected')
        expect(swatch(color).attributes('aria-pressed')).toBe('false')
      })
    })

    it('drives the theme variable to black', async () => {
      await swatch('red').trigger('click')
      await swatch('red').trigger('click')
      await nextTick()

      const computedStyle = window.getComputedStyle(document.documentElement)
      expect(computedStyle.getPropertyValue('--dynamic-bg-color')).toBe('var(--black-color)')
    })

    it('does not carry black over to the next load', async () => {
      await swatch('yellow').trigger('click')
      await swatch('yellow').trigger('click')
      expect(wrapper.vm.selectedColor).toBe('black')

      const reloaded = mount(ThemeColorSelector)

      // every load starts from the palette again
      expect(reloaded.vm.selectedColor).not.toBe('black')
      reloaded.unmount()
    })

    it('comes back out of black when another color is picked', async () => {
      await swatch('orange').trigger('click')
      await swatch('orange').trigger('click')
      expect(wrapper.vm.selectedColor).toBe('black')

      await swatch('blue').trigger('click')
      await nextTick()

      expect(wrapper.vm.selectedColor).toBe('blue')
      expect(swatch('blue').classes()).toContain('color-selected')
    })

    it('does not trip on the initial emit for the colour it opened with', async () => {
      const random = vi.spyOn(Math, 'random').mockReturnValue(0)
      const fresh = mount(ThemeColorSelector)
      await nextTick()

      // mounting applies the chosen colour; it must not read as a re-click
      expect(fresh.vm.selectedColor).toBe(fresh.vm.colors[0])
      expect(fresh.emitted('color-change')[0][0]).toBe(fresh.vm.colors[0])
      fresh.unmount()
      random.mockRestore()
    })
  })
})
