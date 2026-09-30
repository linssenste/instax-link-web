import { mount, type VueWrapper } from '@vue/test-utils'
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { cssOf } from '../css'

// the printer panel reaches konva through the export helpers, and the node build of
// it wants a native canvas that is not installed
vi.mock('konva', () => ({ default: { Filters: {} } }))

import MobileOverlay from '../../layout/MobileOverlay.vue'
import { InstaxFilmVariant } from '../../../interfaces/PrinterStateConfig'

describe('MobileOverlay', () => {
	let wrapper: VueWrapper

	const mountOverlay = () => {
		wrapper = mount(MobileOverlay, {
			props: { config: { connection: false, type: InstaxFilmVariant.SQUARE } },
			global: {
				stubs: { PrinterConnection: true, ThemeColorSelector: true, PolaroidSizeSelector: true }
			}
		})
		return wrapper
	}

	const overlay = () => wrapper.find('.overlay')

	beforeEach(() => mountOverlay())
	afterEach(() => wrapper?.unmount())

	const open = async () => {
		await wrapper.find('.close-button').trigger('click')
		return overlay()
	}

	it('stays shut until it is asked for', () => {
		expect(overlay().exists()).toBe(false)
	})

	it('opens on the menu button', async () => {
		expect((await open()).exists()).toBe(true)
	})

	it('closes on its own close button', async () => {
		await open()
		await wrapper.findAll('.close-button')[1].trigger('click')

		expect(overlay().exists()).toBe(false)
	})

	describe('Clicking away', () => {
		it('closes, the same as the film dialog does', async () => {
			await open()
			await wrapper.find('.scrim').trigger('click')

			expect(overlay().exists()).toBe(false)
		})

		it('is a pointer shortcut and not a second tab stop', async () => {
			await open()
			const scrim = wrapper.find('.scrim')

			expect(scrim.attributes('tabindex')).toBe('-1')
			expect(scrim.attributes('aria-hidden')).toBe('true')
		})

		it('sits behind the controls rather than over them', async () => {
			// they are positioned siblings that come after it, so DOM order is what
			// keeps it underneath
			await open()
			const children = [...overlay().element.children].map((child) => child.className)

			expect(children[0]).toContain('scrim')
		})

		// jsdom applies no scoped styles, so the rules are checked in the source
		const ruleFor = cssOf('src/components/layout/MobileOverlay.vue')

		it('keeps itself invisible against the global button styles', () => {
			// button:hover outranks a single class
			expect(ruleFor('.scrim:hover')).toContain('background-color: transparent')
		})

		it('covers the whole overlay, not a band across the top', () => {
			// every button in the app is 40px tall, and an explicit height beats
			// inset: 0, which would leave only a strip clickable
			expect(ruleFor('.scrim')).toContain('height: auto')
		})
	})
})
