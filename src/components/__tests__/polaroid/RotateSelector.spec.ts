import { mount, type VueWrapper } from '@vue/test-utils'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'

import RotateSelector from '../../polaroid/RotateSelector.vue'

// the dial reads its own box to turn a pointer position into an angle, and jsdom
// lays nothing out, so it is given a 90x90 box centred on (50, 50)
const CENTRE = 50
const BOX = 90

describe('RotateSelector', () => {
	let wrapper: VueWrapper
	let rectSpy: ReturnType<typeof vi.spyOn>

	const mountDial = (props = {}) => {
		wrapper = mount(RotateSelector, { attachTo: document.body, props })
		return wrapper
	}

	const dial = () => wrapper.find('[data-testid="rotate-dial"]')
	const input = () => wrapper.find('[data-testid="rotation-input"]')
	const knob = () => wrapper.find('.knob')

	// a point on the circle at the given angle, measured clockwise from the top
	const pointAt = (degrees: number) => {
		const radians = (degrees - 90) * Math.PI / 180
		return {
			clientX: CENTRE + 35 * Math.cos(radians),
			clientY: CENTRE + 35 * Math.sin(radians),
			pointerType: 'mouse',
			button: 0,
			pointerId: 1
		}
	}

	beforeEach(() => {
		rectSpy = vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({
			left: CENTRE - BOX / 2, top: CENTRE - BOX / 2, width: BOX, height: BOX,
			right: 0, bottom: 0, x: 0, y: 0, toJSON: () => ({})
		} as DOMRect)
		mountDial()
	})

	afterEach(() => {
		rectSpy.mockRestore()
		wrapper?.unmount()
	})

	describe('Showing the angle', () => {
		it('starts at the bound value', () => {
			wrapper.unmount()
			mountDial({ modelValue: 90 })

			expect(wrapper.vm.angle).toBe(90)
			expect((input().element as HTMLInputElement).value).toBe('90')
		})

		it('places the knob by handing the angle to css', async () => {
			wrapper.unmount()
			mountDial({ modelValue: 90 })

			// the script supplies only the angle; the ring radius lives in the
			// stylesheet, so the two cannot drift apart
			expect(knob().attributes('style')).toContain('--angle: 90deg')
		})

		it('follows the bound value when it changes outside', async () => {
			await wrapper.setProps({ modelValue: 215 })

			expect(wrapper.vm.angle).toBe(215)
			expect(knob().attributes('style')).toContain('--angle: 215deg')
		})

		it('normalises whatever it is given', async () => {
			await wrapper.setProps({ modelValue: 400 })
			expect(wrapper.vm.angle).toBe(40)

			await wrapper.setProps({ modelValue: -30 })
			expect(wrapper.vm.angle).toBe(330)
		})

		it('reports itself as a slider', () => {
			expect(dial().attributes('role')).toBe('slider')
			expect(dial().attributes('aria-valuemin')).toBe('0')
			expect(dial().attributes('aria-valuemax')).toBe('359')
			expect(dial().attributes('aria-valuenow')).toBe('0')

			// it is reached by keyboard like any other slider, so the arrow keys it
			// already answers to can actually be got at. The readout inside it is the
			// second stop, for typing an exact angle
			expect(dial().attributes('tabindex')).toBe('0')
			expect(input().attributes('tabindex')).toBeUndefined()
		})

		it('says it is focused on the knob rather than round the whole square', () => {
			// jsdom applies no scoped styles, so the rule is checked in the source
			const source = readFileSync(
				resolve(process.cwd(), 'src/components/polaroid/RotateSelector.vue'), 'utf8'
			)

			// the same ring the film sliders put round their knob when tabbed to
			const start = source.indexOf('.dial:focus-visible .knob-dot {')
			expect(start).toBeGreaterThan(-1)

			const rule = source.slice(start, source.indexOf('}', start))
			expect(rule).toContain('transform: scale(1.45)')
			expect(rule).toContain('box-shadow: 0 0 0 3px rgba(var(--dynamic-bg-color), .35)')
		})

		it('brings the knob up from anywhere on the dial, as the sliders do', () => {
			const source = readFileSync(
				resolve(process.cwd(), 'src/components/polaroid/RotateSelector.vue'), 'utf8'
			)

			// it used to come up only when the knob itself was under the pointer
			expect(source).toContain('.dial:hover .knob-dot')
			expect(source).not.toContain('.knob:hover .knob-dot')
		})

		it('keeps aria-valuenow in step with the angle', async () => {
			await wrapper.setProps({ modelValue: 123 })

			expect(dial().attributes('aria-valuenow')).toBe('123')
			expect(dial().attributes('aria-valuetext')).toBe('123 degrees')
		})
	})

	describe('Quarter turns', () => {
		it('offers one marker per quarter', () => {
			expect(wrapper.findAll('.snap')).toHaveLength(4)
		})

		it('jumps to the marker that was clicked', async () => {
			for (const angle of [90, 180, 270, 0]) {
				await wrapper.find(`[data-testid="rotate-snap-${angle}"]`).trigger('click')

				expect(wrapper.vm.angle).toBe(angle)
			}
		})

		it('places each marker at its own angle', () => {
			for (const angle of [0, 90, 180, 270]) {
				expect(wrapper.find(`[data-testid="rotate-snap-${angle}"]`).attributes('style'))
					.toContain(`--angle: ${angle}deg`)
			}
		})

		it('drops the hover mark on the anchor it just parked the knob on', async () => {
			const marker = wrapper.find('[data-testid="rotate-snap-90"]')
			await marker.trigger('click')

			// the pointer is still over it, so :hover would keep the line drawn out
			expect(marker.classes()).toContain('quiet')
		})

		it('stays quiet for as long as the knob covers it', async () => {
			const marker = wrapper.find('[data-testid="rotate-snap-90"]')
			await marker.trigger('click')

			// the knob is smaller than the anchor's target, so leaving the anchor is
			// not enough: it hands its area over until the knob moves on
			await marker.trigger('pointerleave')
			expect(marker.classes()).toContain('quiet')

			await wrapper.setProps({ modelValue: 45 })
			expect(marker.classes()).not.toContain('quiet')
		})

		it('gives its area over to the knob while covered', async () => {
			const marker = wrapper.find('[data-testid="rotate-snap-90"]')
			await marker.trigger('click')

			// inert, so the cursor and a press both belong to the knob beneath it
			expect(marker.classes()).toContain('quiet')
		})

		it('quiets whichever anchor the knob lands on, however it got there', async () => {
			await wrapper.setProps({ modelValue: 180 })

			expect(wrapper.find('[data-testid="rotate-snap-180"]').classes()).toContain('quiet')
			expect(wrapper.find('[data-testid="rotate-snap-0"]').classes()).not.toContain('quiet')
		})

		it('raises the knob that has taken the anchor over', async () => {
			await wrapper.find('[data-testid="rotate-snap-90"]').trigger('click')

			// the knob now covers the anchor, so it carries the raised look
			expect(dial().classes()).toContain('knob-parked')
		})

		it('lowers the knob again once the pointer leaves the dial', async () => {
			await wrapper.find('[data-testid="rotate-snap-90"]').trigger('click')
			expect(dial().classes()).toContain('knob-parked')

			await dial().trigger('pointerleave')

			expect(dial().classes()).not.toContain('knob-parked')
		})

		it('only quiets the anchor that was taken', async () => {
			await wrapper.find('[data-testid="rotate-snap-90"]').trigger('click')

			expect(wrapper.find('[data-testid="rotate-snap-180"]').classes()).not.toContain('quiet')
		})

		it('names each marker for assistive tech', () => {
			expect(wrapper.find('[data-testid="rotate-snap-180"]').attributes('aria-label'))
				.toBe('Rotate to 180 degrees')
		})
	})

	describe('Dragging', () => {
		const drag = async (...angles: number[]) => {
			await dial().trigger('pointerdown', pointAt(angles[0]))
			for (const angle of angles.slice(1)) await dial().trigger('pointermove', pointAt(angle))
			await dial().trigger('pointerup', pointAt(angles[angles.length - 1]))
		}

		it('follows the pointer round the dial', async () => {
			await dial().trigger('pointerdown', pointAt(140))

			expect(wrapper.vm.angle).toBe(140)
			expect(dial().classes()).toContain('dragging')
		})

		it('keeps tracking while the pointer moves', async () => {
			await drag(140, 200, 250)

			expect(wrapper.vm.angle).toBe(250)
			expect(dial().classes()).not.toContain('dragging')
		})

		it('sticks to a quarter turn when it comes close', async () => {
			// 274 is within the snap threshold of 270
			await dial().trigger('pointerdown', pointAt(274))

			expect(wrapper.vm.angle).toBe(270)
		})

		it('does not snap from further out', async () => {
			await dial().trigger('pointerdown', pointAt(255))

			expect(wrapper.vm.angle).toBe(255)
		})

		it('ignores a drag that starts on the readout', async () => {
			await input().trigger('pointerdown', pointAt(140))

			expect(dial().classes()).not.toContain('dragging')
			expect(wrapper.vm.angle).toBe(0)
		})

		it('ignores a non-primary mouse button', async () => {
			await dial().trigger('pointerdown', { ...pointAt(140), button: 2 })

			expect(wrapper.vm.angle).toBe(0)
		})

		it('stops tracking after release', async () => {
			await drag(140)
			await dial().trigger('pointermove', pointAt(300))

			expect(wrapper.vm.angle).toBe(140)
		})
	})

	describe('Keyboard', () => {
		// the readout is the focusable part, so the keys are handled from there
		it('steps a degree at a time with the arrows', async () => {
			await input().trigger('keydown', { key: 'ArrowUp' })
			expect(wrapper.vm.angle).toBe(1)

			await input().trigger('keydown', { key: 'ArrowDown' })
			expect(wrapper.vm.angle).toBe(0)
		})

		it('steps ten at a time with shift', async () => {
			await input().trigger('keydown', { key: 'ArrowRight', shiftKey: true })

			expect(wrapper.vm.angle).toBe(10)
		})

		it('wraps rather than stopping at the ends', async () => {
			await input().trigger('keydown', { key: 'ArrowLeft' })

			expect(wrapper.vm.angle).toBe(359)
		})

		it('returns to the top with Home', async () => {
			await wrapper.setProps({ modelValue: 200 })
			await input().trigger('keydown', { key: 'Home' })

			expect(wrapper.vm.angle).toBe(0)
		})

		it('leaves other keys alone', async () => {
			await input().trigger('keydown', { key: 'a' })

			expect(wrapper.vm.angle).toBe(0)
		})
	})

	describe('The knob itself', () => {
		it('is its own target, so it can be grabbed and hovered', () => {
			expect(knob().exists()).toBe(true)
			expect(wrapper.find('.knob-dot').exists()).toBe(true)
		})

		it('starts a drag when grabbed directly', async () => {
			await knob().trigger('pointerdown', pointAt(140))

			expect(dial().classes()).toContain('dragging')
			expect(wrapper.vm.angle).toBe(140)
		})

		it('stays enlarged for as long as the drag lasts', async () => {
			await knob().trigger('pointerdown', pointAt(140))
			expect(dial().classes()).toContain('dragging')

			await dial().trigger('pointerup', pointAt(140))
			expect(dial().classes()).not.toContain('dragging')
		})
	})

	describe('Typing a value', () => {
		it('takes the typed angle', async () => {
			await input().setValue('135')

			expect(wrapper.vm.angle).toBe(135)
		})

		it('wraps a value past a full turn', async () => {
			await input().setValue('540')
			await input().trigger('keyup.enter')

			expect(wrapper.vm.angle).toBe(180)
		})

		it('resets the field when normalising lands on the same angle', async () => {
			await input().setValue('370')
			await input().trigger('keyup.enter')

			expect(wrapper.vm.angle).toBe(10)

			// typing 370 again must not leave 370 sitting in the field
			await input().setValue('370')
			await input().trigger('keyup.enter')

			expect((input().element as HTMLInputElement).value).toBe('10')
		})

		it('falls back to zero for something that is not a number', async () => {
			await input().setValue('')
			await input().trigger('keyup.enter')

			expect(wrapper.vm.angle).toBe(0)
		})
	})

	describe('Reporting changes', () => {
		it('emits the new angle for v-model', async () => {
			await wrapper.find('[data-testid="rotate-snap-90"]').trigger('click')

			expect(wrapper.emitted('update:modelValue')).toEqual([[90]])
		})

		it('does not emit when the angle has not moved', async () => {
			await wrapper.find('[data-testid="rotate-snap-0"]').trigger('click')

			expect(wrapper.emitted('update:modelValue')).toBeUndefined()
		})

		it('does not echo a value that came from the parent', async () => {
			await wrapper.setProps({ modelValue: 45 })

			expect(wrapper.emitted('update:modelValue')).toBeUndefined()
		})
	})
})
