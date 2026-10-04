import { mount, type VueWrapper } from '@vue/test-utils'
import { describe, it, expect, afterEach } from 'vitest'
import { cssOf, sourceOf } from '../css'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import FilmSlider from '../../film/FilmSlider.vue'

describe('FilmSlider', () => {
	let wrapper: VueWrapper

	const mountSlider = (props = {}) => {
		wrapper = mount(FilmSlider, {
			props: {
				label: 'Contrast', testid: 'film-contrast', modelValue: 0,
				min: -60, max: 60, step: 1, display: '0', anchor: 0,
				...props
			}
		})
		return wrapper
	}

	const slider = () => wrapper.find('[data-testid="film-contrast"]')
	const anchor = () => wrapper.find('[data-testid="film-contrast-anchor"]')
	const lastValue = () => {
		const emitted = wrapper.emitted('update:modelValue')
		return emitted?.[emitted.length - 1][0] as number
	}

	afterEach(() => wrapper?.unmount())

	it('shows the label and the reading', () => {
		mountSlider({ display: '18' })

		expect(wrapper.text()).toContain('Contrast')
		expect(wrapper.text()).toContain('18')
	})

	it('names the slider for a screen reader', () => {
		mountSlider()

		expect(slider().attributes('aria-label')).toBe('Contrast')
	})

	it('reports a value that is nowhere near the anchor unchanged', async () => {
		mountSlider()
		await slider().setValue('40')

		expect(lastValue()).toBe(40)
	})

	describe('The anchor', () => {
		it('marks where the slider rests', () => {
			mountSlider({ anchor: 0 })

			// halfway along a -60..60 travel, inset by half a knob at each end
			expect(anchor().attributes('style')).toContain('(100% - var(--bar-height)) * 0.5')
		})

		it('sits at the value it was given, not in the middle', () => {
			mountSlider({ min: 0, max: 0.6, anchor: 0.15, modelValue: 0.15 })

			expect(anchor().attributes('style')).toContain('(100% - var(--bar-height)) * 0.25')
		})

		it('lands dead centre of the knob at either end of the travel', () => {
			// the inset used to be written as a flat 8px against a 16px knob, which
			// left the mark half a pixel off at the ends. That shows plainly on a
			// setting whose zero is the far left
			mountSlider({ min: 0, max: 8, anchor: 0, modelValue: 0 })
			const style = anchor().attributes('style')

			expect(style).toContain('calc(var(--bar-height) / 2')
			expect(style).not.toContain('8px')
			expect(style).not.toContain('16px')
		})

		it('pulls a drag that passes close by onto it', async () => {
			mountSlider()
			// within 1.5% of a 120 wide travel
			await slider().setValue('1')

			expect(lastValue()).toBe(0)
		})

		it('lets go as soon as the drag is clear of it', async () => {
			// it used to hold on across 4% of the travel, which on a fine stepped
			// slider swallowed several usable settings either side of zero
			mountSlider()
			await slider().setValue('3')

			expect(lastValue()).toBe(3)
		})

		it('leaves the settings next to zero reachable', async () => {
			mountSlider({ min: -0.5, max: 0.5, step: 0.01, modelValue: 0 })

			for (const value of ['0.02', '-0.02', '0.05', '-0.05']) {
				await slider().setValue(value)
				expect(lastValue(), value).toBe(Number(value))
			}
		})

		it('returns to the resting value when clicked', async () => {
			mountSlider({ modelValue: 42 })
			await anchor().trigger('click')

			expect(lastValue()).toBe(0)
		})

		it('puts the thumb back where it snapped to', async () => {
			// the snapped value can be the one already bound, which renders nothing
			// and would leave the thumb sitting where the pointer dropped it
			mountSlider({ modelValue: 0 })
			await slider().setValue('1')

			expect((slider().element as HTMLInputElement).value).toBe('0')
		})

		it('hides under the knob as soon as it comes over, not only on landing', async () => {
			// the knob is a band thick, so it covers the mark from half its own width
			// away. Leaving the mark showing until the value matched exactly left a
			// dot poking out from under the knob on the way past
			mountSlider({ modelValue: 0 })
			expect(anchor().classes()).toContain('quiet')

			// a fifth of the way along a -60..60 travel is clear of it
			await wrapper.setProps({ modelValue: 24 })
			expect(anchor().classes()).not.toContain('quiet')

			// but a step or two out is still underneath
			await wrapper.setProps({ modelValue: 2 })
			expect(anchor().classes()).toContain('quiet')
		})

		it('stands aside once the knob is sitting on it', () => {
			// two targets on the same spot is how the rotation dial used to steal
			// presses from its own knob, so the mark gives its area up
			mountSlider({ modelValue: 0 })
			expect(anchor().classes()).toContain('quiet')

			wrapper.unmount()
			mountSlider({ modelValue: 30 })
			expect(anchor().classes()).not.toContain('quiet')
		})

		it('names what it resets, so it is not an unlabelled button', () => {
			mountSlider()

			expect(anchor().attributes('aria-label')).toBe('Reset Contrast')
		})

		it('is left out where the slider has no resting point', () => {
			mountSlider({ anchor: null })

			expect(anchor().exists()).toBe(false)
		})

		it('snaps nothing when there is no anchor', async () => {
			mountSlider({ anchor: null })
			await slider().setValue('1')

			expect(lastValue()).toBe(1)
		})
	})

	describe('Built from the rotation dial', () => {
		// jsdom applies no scoped styles, so the rules are checked in the source
		const SLIDER = 'src/components/film/FilmSlider.vue'
		const source = () => sourceOf(SLIDER)
		const ruleFor = cssOf(SLIDER)

		it('carries the band thickness of the dial ring', () => {
			expect(ruleFor('.slider')).toContain('--bar-height: 15px')

			const dial = readFileSync(
				resolve(process.cwd(), 'src/components/polaroid/RotateSelector.vue'), 'utf8'
			)
			expect(dial).toContain('--ring-width: 15px')
		})

		it('rounds the ends of the band, so it reads as the ring laid out flat', () => {
			expect(ruleFor('input[type=range]::-webkit-slider-runnable-track'))
				.toContain('border-radius: calc(var(--bar-height) / 2)')
		})

		it('rides the knob in the band rather than on top of it', () => {
			const thumb = ruleFor('input[type=range]::-webkit-slider-thumb')

			expect(thumb).toContain('height: var(--bar-height)')
			expect(thumb).toContain('border-radius: 50%')
		})

		it('sits the mark on the band, above the input so it can be pressed', () => {
			const rule = ruleFor('.anchor')

			expect(rule).toContain('height: var(--bar-height)')
			expect(rule).toContain('z-index: 1')
		})

		it('draws the mark out into a line across the band on hover', () => {
			// the same treatment the dial gives its own anchors
			expect(source()).toContain('.anchor:hover:not(.quiet)::before')
			expect(ruleFor('\t.anchor:hover:not(.quiet)::before')).toContain('height: 21px')
		})

		it('takes the mark out of sight once the knob is over it', () => {
			expect(ruleFor('.anchor.quiet::before')).toContain('opacity: 0')
			expect(ruleFor('.anchor.quiet')).toContain('pointer-events: none')
		})

		it('offers the knob to be grabbed, and shows it being held', () => {
			expect(ruleFor('input[type=range]')).toContain('cursor: grab')
			expect(ruleFor('input[type=range]:active')).toContain('cursor: grabbing')
			expect(ruleFor('input[type=range]::-webkit-slider-thumb')).toContain('cursor: grab')
			expect(ruleFor('input[type=range]:active::-webkit-slider-thumb'))
				.toContain('cursor: grabbing')
		})

		it('lifts the knob off the band as the dial does, by the same amount', () => {
			const dial = readFileSync(
				resolve(process.cwd(), 'src/components/polaroid/RotateSelector.vue'), 'utf8'
			)

			expect(dial).toContain('transform: scale(1.45)')
			expect(ruleFor('input[type=range]:active::-webkit-slider-thumb'))
				.toContain('transform: scale(1.45)')
			expect(ruleFor('\tinput[type=range]:hover::-webkit-slider-thumb'))
				.toContain('transform: scale(1.45)')
		})
	})
})
