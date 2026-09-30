import { mount, type VueWrapper } from '@vue/test-utils'
import { describe, it, expect, afterEach } from 'vitest'
import { cssOf } from '../css'

import CloseButton from '../../controls/CloseButton.vue'

describe('CloseButton', () => {
	let wrapper: VueWrapper

	const mountButton = (props = {}) => {
		wrapper = mount(CloseButton, { props: { label: 'Close film look', ...props } })
		return wrapper
	}

	afterEach(() => wrapper?.unmount())

	it('is a button named by what it closes', () => {
		mountButton()

		expect(wrapper.element.tagName).toBe('BUTTON')
		expect(wrapper.attributes('aria-label')).toBe('Close film look')
		expect(wrapper.attributes('type')).toBe('button')
	})

	it('falls back to the name for the tooltip', () => {
		mountButton()
		expect(wrapper.attributes('title')).toBe('Close film look')

		wrapper.unmount()
		mountButton({ title: 'Close' })
		expect(wrapper.attributes('title')).toBe('Close')
	})

	it('keeps the mark out of the accessible name', () => {
		// a mask rather than an image, so it can take a colour from the theme
		mountButton()

		expect(wrapper.find('span').attributes('aria-hidden')).toBe('true')
		expect(wrapper.find('img').exists()).toBe(false)
	})

	it('reports being pressed', async () => {
		mountButton()
		await wrapper.trigger('click')

		expect(wrapper.emitted('click')).toHaveLength(1)
	})

	it('carries a test handle when one is asked for', () => {
		mountButton({ testid: 'remove-image-button' })

		expect(wrapper.attributes('data-testid')).toBe('remove-image-button')
	})

	describe('Tone', () => {
		it('sits on a panel in the theme colour by default', () => {
			mountButton()
			expect(wrapper.classes()).toContain('theme')
		})

		it('goes plain grey where it sits over a photo', () => {
			mountButton({ tone: 'plain' })

			expect(wrapper.classes()).toContain('plain')
			expect(wrapper.classes()).not.toContain('theme')
		})

		it('paints each tone its own way', () => {
			// jsdom applies no scoped styles, so the rules are checked in the source
			const ruleFor = cssOf('src/components/controls/CloseButton.vue')

			expect(ruleFor('.close.theme')).toContain('rgba(var(--dynamic-bg-color), .12)')
			expect(ruleFor('.close.theme .mark')).toContain('rgb(var(--dynamic-bg-color))')
			expect(ruleFor('.close.plain')).toContain('#e0e0e0cc')
		})
	})

	it('takes a size, since it sits on a panel and over a photo at different scales', () => {
		mountButton({ size: 30 })

		expect(wrapper.attributes('style')).toContain('--close-size: 30px')
	})
})
