import { describe, it, expect } from 'vitest'

import {
	commandFor, titleWith, SHORTCUTS, NUDGE_STEP, NUDGE_STRIDE, ROTATE_STEP
} from '../shortcuts'

const press = (key: string, options: Partial<KeyboardEvent> = {}, target?: HTMLElement) => {
	const event = new KeyboardEvent('keydown', { key, cancelable: true, ...options })
	if (target) Object.defineProperty(event, 'target', { value: target })
	return commandFor(event)
}

const element = (tag: string, attrs: Record<string, string> = {}) => {
	const node = document.createElement(tag)
	for (const [name, value] of Object.entries(attrs)) node.setAttribute(name, value)
	return node
}

describe('Editor shortcuts', () => {
	it('works the same on every platform, with no Cmd or Ctrl to split on', () => {
		// single letters, Shift at most: nothing here needs a different key on a Mac
		for (const shortcut of Object.values(SHORTCUTS)) {
			expect(shortcut.hint, shortcut.description).not.toMatch(/cmd|ctrl|alt|option|meta/i)
		}
	})

	it('describes every shortcut, for the tooltips and a list later on', () => {
		for (const [name, shortcut] of Object.entries(SHORTCUTS)) {
			expect(shortcut.hint.length, name).toBeGreaterThan(0)
			expect(shortcut.description.length, name).toBeGreaterThan(10)
		}
	})

	describe('Moving the image', () => {
		it('steps one pixel per arrow', () => {
			expect(press('ArrowLeft')).toEqual({ kind: 'move', x: -NUDGE_STEP, y: 0 })
			expect(press('ArrowRight')).toEqual({ kind: 'move', x: NUDGE_STEP, y: 0 })
			expect(press('ArrowUp')).toEqual({ kind: 'move', x: 0, y: -NUDGE_STEP })
			expect(press('ArrowDown')).toEqual({ kind: 'move', x: 0, y: NUDGE_STEP })
		})

		it('strides with Shift held', () => {
			expect(press('ArrowRight', { shiftKey: true }))
				.toEqual({ kind: 'move', x: NUDGE_STRIDE, y: 0 })
			expect(NUDGE_STRIDE).toBeGreaterThan(NUDGE_STEP)
		})
	})

	describe('The framing keys', () => {
		it('fits to the width and the height', () => {
			expect(press('w')).toEqual({ kind: 'fit', horizontal: true })
			expect(press('h')).toEqual({ kind: 'fit', horizontal: false })
		})

		it('centres on one axis, and the other with Shift', () => {
			expect(press('c')).toEqual({ kind: 'centre', horizontal: true })
			expect(press('C', { shiftKey: true })).toEqual({ kind: 'centre', horizontal: false })
		})

		it('turns a quarter each way', () => {
			expect(press('r')).toEqual({ kind: 'rotate', degrees: ROTATE_STEP })
			expect(press('R', { shiftKey: true })).toEqual({ kind: 'rotate', degrees: -ROTATE_STEP })
		})

		it('opens the film look and toggles the settings', () => {
			expect(press('f')).toEqual({ kind: 'film' })
			expect(press('s')).toEqual({ kind: 'settings' })
		})

		it('answers to either case, since Shift is a modifier of its own here', () => {
			expect(press('W')).toEqual(press('w'))
			expect(press('F')).toEqual(press('f'))
		})

		it('ignores a key it has nothing for', () => {
			for (const key of ['q', 'z', 'Enter', ' ', 'Tab', 'Escape']) {
				expect(press(key), key).toBeNull()
			}
		})
	})

	describe('When the keys are not the editor\'s', () => {
		it('leaves anything held with Ctrl, Cmd or Alt to the browser', () => {
			for (const modifier of ['ctrlKey', 'metaKey', 'altKey'] as const) {
				expect(press('w', { [modifier]: true }), modifier).toBeNull()
				expect(press('ArrowRight', { [modifier]: true }), modifier).toBeNull()
			}
		})

		it('keeps out of a field being typed into', () => {
			// otherwise writing a caption would fit, centre and rotate the photo
			for (const tag of ['input', 'textarea', 'select']) {
				expect(press('w', {}, element(tag)), tag).toBeNull()
				expect(press('ArrowLeft', {}, element(tag)), tag).toBeNull()
			}
		})

		it('keeps out of rich text as well', () => {
			const editable = element('div', { contenteditable: 'true' })
			Object.defineProperty(editable, 'isContentEditable', { value: true })

			expect(press('r', {}, editable)).toBeNull()
		})

		it('stands aside where a focused control has already answered', () => {
			// the rotation dial takes the arrows for its own one degree steps, and says
			// so by preventing the default
			const event = new KeyboardEvent('keydown', { key: 'ArrowUp', cancelable: true })
			event.preventDefault()

			expect(commandFor(event)).toBeNull()
		})
	})

	it('writes a tooltip with the shortcut after the name', () => {
		expect(titleWith('Film look', SHORTCUTS.filmLook)).toBe('Film look (F)')
	})
})
