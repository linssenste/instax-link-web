import { mount, type VueWrapper } from '@vue/test-utils'
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { cssOf, sourceOf } from '../css'
import { nextTick } from 'vue'

import FilmDialog from '../../film/FilmDialog.vue'
import { ADJUSTMENT_RANGES, DEFAULT_ADJUSTMENTS } from '../../../polaroid/film'

describe('FilmDialog', () => {
	let wrapper: VueWrapper

	const mountDialog = (props = {}) => {
		wrapper = mount(FilmDialog, {
			attachTo: document.body,
			// rendered in place, so the teleported panel is reachable from the wrapper
			global: { stubs: { teleport: true } },
			props: {
				open: true,
				adjustments: { ...DEFAULT_ADJUSTMENTS },
				source: null,
				...props
			}
		})
		return wrapper
	}

	const lastAdjustments = () => {
		const emitted = wrapper.emitted('update:adjustments')
		return emitted?.[emitted.length - 1][0] as typeof DEFAULT_ADJUSTMENTS
	}


	// jsdom lays nothing out, so the rules that decide what scrolls and what is
	// drawn are checked in the source
	const DIALOG = 'src/components/film/FilmDialog.vue'
	const source = sourceOf(DIALOG)
	const ruleFor = cssOf(DIALOG)

	beforeEach(() => {
		vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
			callback(0)
			return 1
		})
		vi.stubGlobal('cancelAnimationFrame', vi.fn())
		mountDialog()
	})

	afterEach(() => {
		wrapper?.unmount()
		vi.unstubAllGlobals()
	})

	describe('Showing and dismissing', () => {
		it('renders nothing while closed', () => {
			wrapper.unmount()
			mountDialog({ open: false })

			expect(wrapper.find('[data-testid="film-dialog"]').exists()).toBe(false)
		})

		it('is a modal dialog with a name', () => {
			const panel = wrapper.find('[data-testid="film-dialog"]')

			expect(panel.attributes('role')).toBe('dialog')
			expect(panel.attributes('aria-modal')).toBe('true')

			// the shell generates the heading's id, so the name is checked by
			// following the reference rather than by matching a fixed string
			const labelledBy = panel.attributes('aria-labelledby')
			expect(labelledBy).toBeTruthy()
			expect(panel.find(`#${labelledBy}`).text()).toBe('Film look')
		})

		it('closes on the close button', async () => {
			await wrapper.find('[data-testid="film-dialog-close"]').trigger('click')

			expect(wrapper.emitted('close')).toHaveLength(1)
		})

		it('closes on escape from anywhere inside it', async () => {
			// bound to the document, so it works once focus has moved into a slider
			document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
			await nextTick()

			expect(wrapper.emitted('close')).toHaveLength(1)
		})

		it('ignores other keys', async () => {
			document.dispatchEvent(new KeyboardEvent('keydown', { key: 'a' }))
			await nextTick()

			expect(wrapper.emitted('close')).toBeUndefined()
		})

		it('stops listening once it is closed', async () => {
			await wrapper.setProps({ open: false })

			document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
			await nextTick()

			expect(wrapper.emitted('close')).toBeUndefined()
		})

		it('closes when the area around it is clicked', async () => {
			await wrapper.find('.scrim').trigger('click')

			expect(wrapper.emitted('close')).toHaveLength(1)
		})

		it('keeps the click-away shortcut out of the tab order', () => {
			// escape and the close button are the paths that matter
			expect(wrapper.find('.scrim').attributes('tabindex')).toBe('-1')
			expect(wrapper.find('.scrim').attributes('aria-hidden')).toBe('true')
		})
	})

	describe('Fitting the window', () => {
		it('scrolls the sliders and nothing else', () => {
			const rule = ruleFor('.controls')

			expect(rule).toContain('overflow-y: auto')
			// without this it cannot shrink below its content, and the panel scrolls
			// instead, carrying the title and the actions out of reach
			expect(rule).toContain('min-height: 0')
		})

		it('holds the photo at its own size, however little room is left', () => {
			expect(ruleFor('.preview')).toContain('flex: none')
		})

		it('passes the room it was given straight through to the sliders', () => {
			const rule = ruleFor('.body')

			expect(rule).toContain('flex: 1 1 auto')
			expect(rule).toContain('min-height: 0')
		})

		it('groups the sliders by spacing rather than by heading', () => {
			// four groups: the light, the colour, the film's limits, its texture
			expect(wrapper.findAll('.group').length).toBe(4)
			expect(wrapper.find('.group h3').exists()).toBe(false)
			expect(wrapper.find('.group h4').exists()).toBe(false)
		})

		it('leaves a wider gap between the groups than within them', () => {
			const between = /gap:\s*(\d+)px/.exec(ruleFor('.controls'))?.[1]
			const within = /gap:\s*(\d+)px/.exec(ruleFor('.group'))?.[1]

			expect(Number(between)).toBeGreaterThan(Number(within))
		})

		/** stand in for a box jsdom never lays out, then read it as the dialog does */
		const atScroll = (scrollHeight: number, clientHeight: number, scrollTop: number) => {
			const element = wrapper.find('[data-testid="film-controls"]').element

			Object.defineProperties(element, {
				scrollHeight: { value: scrollHeight, configurable: true },
				clientHeight: { value: clientHeight, configurable: true },
				scrollTop: { value: scrollTop, configurable: true }
			})

			wrapper.vm.measureOverflow()
			return { above: wrapper.vm.moreAbove, below: wrapper.vm.moreBelow }
		}

		it('marks a line only at the edge with something out of sight', () => {
			// taller content than there is room for, starting at the top
			expect(atScroll(900, 300, 0)).toEqual({ above: false, below: true })

			// part way down there is something out of sight at both ends
			expect(atScroll(900, 300, 400)).toEqual({ above: true, below: true })

			// and at the end, only above
			expect(atScroll(900, 300, 600)).toEqual({ above: true, below: false })
		})

		it('marks nothing at all when everything fits', () => {
			expect(atScroll(300, 300, 0)).toEqual({ above: false, below: false })
		})

		it('allows a pixel of slack, so no line hangs on at the end of the travel', () => {
			// a scroll position is fractional on a zoomed display
			expect(atScroll(900, 300, 599.6).below).toBe(false)
		})

		it('draws those lines in the theme colour, one edge each', () => {
			expect(source).toContain(`'more-above': moreAbove`)
			expect(source).toContain(`'more-below': moreBelow`)
			expect(ruleFor('.controls.more-above')).toContain('border-top-color: rgba(var(--dynamic-bg-color)')
			expect(ruleFor('.controls.more-below')).toContain('border-bottom-color: rgba(var(--dynamic-bg-color)')
		})

		it('keeps the lines from shifting the layout as they appear', () => {
			// the borders are always there and start out invisible: a border coming
			// and going would change the height and set the measurement off again
			const rule = ruleFor('.controls')

			// the width is a design value to taste; what must not change is that the
			// border is always there and starts out invisible
			expect(rule).toMatch(/border-top: \d+px solid transparent/)
			expect(rule).toMatch(/border-bottom: \d+px solid transparent/)
		})

		it('holds the sliders clear of the scrollbar', () => {
			expect(ruleFor('.controls')).toContain('padding-right')
		})

		it('puts the scrollbar against the screen edge on a phone', () => {
			// the scrolling box gives up the panel's side padding and takes its own,
			// so the bar sits at the edge and the sliders still do not run under it
			const mobile = source.slice(source.indexOf('@media (max-width: 620px)'))

			expect(mobile).toContain('padding-left: 0')
			expect(mobile).toContain('padding-right: 0')
			expect(mobile.slice(mobile.indexOf('.controls'))).toContain('padding-right: 16px')
		})

		it('puts every adjustment in one group or another, leaving none out', () => {
			expect(wrapper.findAll('.group input[type=range]').length)
				.toBe(Object.keys(ADJUSTMENT_RANGES).length)
		})
	})

	describe('Putting it back', () => {
		it('offers nothing to put back until something has been moved', () => {
			expect(wrapper.find('[data-testid="film-reset"]').exists()).toBe(false)
		})

		it('appears once a setting is off the standard look', async () => {
			await wrapper.setProps({ adjustments: { ...DEFAULT_ADJUSTMENTS, contrast: 40 } })

			expect(wrapper.find('[data-testid="film-reset"]').exists()).toBe(true)
		})

		it('goes away again once everything is back', async () => {
			await wrapper.setProps({ adjustments: { ...DEFAULT_ADJUSTMENTS, contrast: 40 } })
			await wrapper.setProps({ adjustments: { ...DEFAULT_ADJUSTMENTS } })

			expect(wrapper.find('[data-testid="film-reset"]').exists()).toBe(false)
		})

		it('notices a change to any one of the settings', async () => {
			for (const key of Object.keys(DEFAULT_ADJUSTMENTS)) {
				const value = DEFAULT_ADJUSTMENTS[key as keyof typeof DEFAULT_ADJUSTMENTS]
				await wrapper.setProps({
					adjustments: { ...DEFAULT_ADJUSTMENTS, [key]: value === 0 ? 0.5 : 0 }
				})

				expect(wrapper.find('[data-testid="film-reset"]').exists(), key).toBe(true)
			}
		})

		it('is the same size as Done, not a smaller afterthought beside it', async () => {
			await wrapper.setProps({ adjustments: { ...DEFAULT_ADJUSTMENTS, contrast: 40 } })

			// the tint is what makes it the second choice; both take the app's button
			// height and the same minimum width
			const rule = ruleFor('.reset')
			expect(rule).toContain('min-width: 120px')
			expect(rule).not.toMatch(/height:\s*\d+px/)
			expect(rule).not.toMatch(/font-size:\s*\d+px/)
			expect(rule).toContain('rgba(var(--dynamic-bg-color), .12)')

			expect(ruleFor('.done')).toContain('min-width: 120px')
		})

		it('keeps Done at the far end whether or not Reset is beside it', () => {
			// or the button people press most would move about under the cursor
			expect(ruleFor('.done')).toContain('margin-left: auto')
		})
	})

	describe('Adjustments', () => {
		const controls = [
			'brightness', 'contrast', 'midtones', 'saturation', 'temperature', 'tint',
			'lift', 'wash', 'grain', 'blur'
		]

		it('marks the zero of every slider, so nothing is a one way trip', () => {
			// the same idea as the quarter turns on the rotation dial
			for (const key of controls) {
				expect(wrapper.find(`[data-testid="film-${key}-anchor"]`).exists(), key).toBe(true)
			}
		})

		it('returns a slider to zero when its mark is clicked', async () => {
			await wrapper.setProps({ adjustments: { ...DEFAULT_ADJUSTMENTS, contrast: 44 } })
			await wrapper.find('[data-testid="film-contrast-anchor"]').trigger('click')

			expect(lastAdjustments().contrast).toBe(0)
		})

		it('offers a slider for every adjustment', () => {
			for (const key of controls) {
				expect(wrapper.find(`[data-testid="film-${key}"]`).exists(), key).toBe(true)
			}
		})

		it('names each slider for a screen reader', () => {
			for (const key of controls) {
				expect(wrapper.find(`[data-testid="film-${key}"]`).attributes('aria-label'), key)
					.toBeTruthy()
			}
		})

		it('starts from the look the export has always had', () => {
			expect((wrapper.find('[data-testid="film-contrast"]').element as HTMLInputElement).value)
				.toBe(String(DEFAULT_ADJUSTMENTS.contrast))
		})

		it('reports a moved slider without touching the others', async () => {
			await wrapper.find('[data-testid="film-brightness"]').setValue('0.2')

			expect(lastAdjustments()).toEqual({ ...DEFAULT_ADJUSTMENTS, brightness: 0.2 })
		})

		it('reports numbers rather than the strings the input hands over', async () => {
			await wrapper.find('[data-testid="film-temperature"]').setValue('-40')

			expect(lastAdjustments().temperature).toBe(-40)
		})

		it('puts everything back on reset', async () => {
			await wrapper.setProps({ adjustments: { ...DEFAULT_ADJUSTMENTS, contrast: 55 } })
			await wrapper.find('[data-testid="film-reset"]').trigger('click')

			expect(lastAdjustments()).toEqual(DEFAULT_ADJUSTMENTS)
		})
	})

})
