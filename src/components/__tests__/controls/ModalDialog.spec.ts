import { mount, type VueWrapper } from '@vue/test-utils'
import { describe, it, expect, afterEach } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import ModalDialog from '../../controls/ModalDialog.vue'

describe('ModalDialog', () => {
	let wrapper: VueWrapper

	const mountDialog = (props = {}, slots = {}) => {
		wrapper = mount(ModalDialog, {
			attachTo: document.body,
			// rendered in place, so the teleported panel is reachable from the wrapper
			global: { stubs: { teleport: true } },
			props: { open: true, title: 'Film look', testid: 'film-dialog', ...props },
			slots: { default: '<p class="content-slot">contents</p>', ...slots }
		})
		return wrapper
	}

	const panel = () => wrapper.find('[data-testid="film-dialog"]')

	afterEach(() => wrapper?.unmount())

	it('renders nothing while closed', () => {
		mountDialog({ open: false })

		expect(panel().exists()).toBe(false)
	})

	it('is a modal dialog named by its own heading', () => {
		mountDialog()

		expect(panel().attributes('role')).toBe('dialog')
		expect(panel().attributes('aria-modal')).toBe('true')

		const labelledBy = panel().attributes('aria-labelledby')
		expect(labelledBy).toBeTruthy()
		expect(panel().find(`#${labelledBy}`).text()).toBe('Film look')
	})

	it('shows what it was given to show', () => {
		mountDialog()

		expect(wrapper.find('.content-slot').text()).toBe('contents')
	})

	it('leaves out the footer band when nothing is put in it', () => {
		mountDialog()
		expect(wrapper.find('.foot').exists()).toBe(false)

		wrapper.unmount()
		mountDialog({}, { footer: '<button>Done</button>' })
		expect(wrapper.find('.foot').exists()).toBe(true)
	})

	describe('Ways out', () => {
		it('closes on its own close button', async () => {
			mountDialog()
			await wrapper.find('[data-testid="film-dialog-close"]').trigger('click')

			expect(wrapper.emitted('close')).toHaveLength(1)
		})

		it('names the close button after what it closes', () => {
			mountDialog()

			expect(wrapper.find('[data-testid="film-dialog-close"]').attributes('aria-label'))
				.toBe('Close Film look')
		})

		it('closes on a click away', async () => {
			mountDialog()
			await wrapper.find('.scrim').trigger('click')

			expect(wrapper.emitted('close')).toHaveLength(1)
		})

		it('keeps the click away out of the tab order, so it is not a second stop', () => {
			mountDialog()
			const scrim = wrapper.find('.scrim')

			expect(scrim.attributes('tabindex')).toBe('-1')
			expect(scrim.attributes('aria-hidden')).toBe('true')
		})

		it('closes on escape from anywhere', async () => {
			mountDialog()
			document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))

			expect(wrapper.emitted('close')).toHaveLength(1)
		})

		it('ignores other keys', () => {
			mountDialog()
			document.dispatchEvent(new KeyboardEvent('keydown', { key: 'a' }))

			expect(wrapper.emitted('close')).toBeUndefined()
		})

		it('stops listening once it is closed', async () => {
			mountDialog()
			await wrapper.setProps({ open: false })

			document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
			expect(wrapper.emitted('close')).toBeUndefined()
		})

		it('stops listening once it is gone', () => {
			mountDialog()
			wrapper.unmount()

			expect(() => document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' })))
				.not.toThrow()
		})
	})

	it('gives every dialog its own heading id, so two can be open at once', () => {
		// ids have to be unique within the document, so the counter cannot live in
		// the setup block: that runs once per component and every dialog would claim
		// the same one
		wrapper = mount({
			components: { ModalDialog },
			template: `
				<div>
					<ModalDialog :open="true" title="First" testid="first" />
					<ModalDialog :open="true" title="Second" testid="second" />
				</div>
			`
		}, { attachTo: document.body, global: { stubs: { teleport: true } } })

		const first = wrapper.find('[data-testid="first"]').attributes('aria-labelledby')
		const second = wrapper.find('[data-testid="second"]').attributes('aria-labelledby')

		expect(first).toBeTruthy()
		expect(second).not.toBe(first)
	})

	describe('Arriving and leaving', () => {
		const source = readFileSync(
			resolve(process.cwd(), 'src/components/controls/ModalDialog.vue'), 'utf8'
		)
		const ruleFor = (selector: string) => {
			const start = source.indexOf(`${selector} {`)
			expect(start, `${selector} not found`).toBeGreaterThan(-1)
			return source.slice(start, source.indexOf('}', start))
		}

		it('is wrapped in a transition, so it does not simply appear', () => {
			expect(source).toContain('<Transition name="dialog">')
		})

		it('fades the backdrop', () => {
			expect(ruleFor('.dialog-enter-from,\n.dialog-leave-to')).toContain('opacity: 0')
		})

		it('settles the panel into the middle of the window', () => {
			expect(ruleFor('.dialog-enter-from .panel,\n.dialog-leave-to .panel'))
				.toContain('transform: scale(')
		})

		it('brings it up from the bottom edge on a phone instead', () => {
			const mobile = source.slice(source.indexOf('@media (max-width: 620px)'))

			expect(mobile).toContain('.dialog-leave-to .panel')
			expect(mobile).toContain('transform: translateY(100%)')
		})

		it('slides the sheet without fading it, and fades only the dim', () => {
			const mobile = source.slice(source.indexOf('@media (max-width: 620px)'))

			// the backdrop holds full opacity, so the panel is not faded along with it
			expect(mobile).toContain('.dialog-leave-to {\n\t\topacity: 1;')
			expect(mobile).toContain('.dialog-leave-to .scrim {\n\t\topacity: 0;')
		})

		it('carries the dim on the scrim, so the sheet can move without it', () => {
			// on the backdrop it would slide and fade with everything inside it
			expect(ruleFor('.scrim')).toContain('background-color: rgba(0, 0, 0,')
			expect(ruleFor('.backdrop')).not.toContain('background-color')
		})

		it('spreads the scrim over the whole window, not a band across the top', () => {
			// it is a button, and every button in the app is 40px tall: an explicit
			// height beats inset: 0, which left the dim and the click away in a strip
			expect(ruleFor('.scrim')).toContain('height: auto')
		})

		it('fades the dim, which every browser can animate', () => {
			expect(ruleFor('.dialog-enter-active .scrim,\n.dialog-leave-active .scrim'))
				.toContain('transition: opacity')
		})

		it('dims with a plain colour rather than a filter', () => {
			// a backdrop-filter could not be eased in anywhere: Safari applies one at
			// full strength whatever is asked of it, and it put the scrim on a
			// composited layer of its own, which then covered the panel
			expect(source).not.toMatch(/backdrop-filter:\s*blur/)
			expect(ruleFor('.scrim')).toContain('background-color: rgba(0, 0, 0,')
		})

		it('orders the scrim under the panel', () => {
			expect(ruleFor('.scrim')).toContain('z-index: 0')
			expect(ruleFor('.panel')).toContain('z-index: 1')
		})

		it('holds the dim against the global button hover', () => {
			// the scrim is a button, and button:hover outranks a single class: without
			// this the dim turns the theme colour as the pointer crosses it
			const dim = /rgba\(0, 0, 0, \.\d+\)/.exec(ruleFor('.scrim'))![0]
			expect(ruleFor('.scrim:hover')).toContain(`background-color: ${dim}`)
		})

		it('moves the panel on the compositor, so a busy main thread cannot stall it', () => {
			// transform and opacity only: anything else would be laid out per frame
			for (const selector of ['.dialog-enter-active .panel', '.dialog-leave-active .panel']) {
				expect(ruleFor(selector)).toContain('transition: transform');
			}
		})

		it('leaves a little quicker than it arrives', () => {
			const duration = (rule: string) => Number(/(\d+)ms/.exec(rule)?.[1])

			expect(duration(ruleFor('.dialog-leave-active .panel')))
				.toBeLessThan(duration(ruleFor('.dialog-enter-active .panel')))
		})

		it('holds still for anyone who asked for less movement', () => {
			const reduced = source.slice(source.indexOf('@media (prefers-reduced-motion: reduce)'))

			expect(reduced).toContain('transition: none')
			expect(reduced).toContain('transform: none')
		})
	})

	describe('Fitting a short window', () => {
		// jsdom lays nothing out, so the rules that make the bands hold their place
		// are checked in the source
		const source = readFileSync(
			resolve(process.cwd(), 'src/components/controls/ModalDialog.vue'), 'utf8'
		)
		const ruleFor = (selector: string) => {
			const start = source.indexOf(`${selector} {`)
			expect(start, `${selector} not found`).toBeGreaterThan(-1)
			return source.slice(start, source.indexOf('}', start))
		}

		it('never scrolls itself, so the head and the foot cannot be carried away', () => {
			const rule = ruleFor('.panel')

			expect(rule).toContain('overflow: hidden')
			expect(rule).toContain('max-height: 100%')
			expect(rule).not.toContain('overflow-y: auto')
		})

		it('holds the head and the foot at their own size', () => {
			expect(ruleFor('.head')).toContain('flex: none')
			expect(ruleFor('.foot')).toContain('flex: none')
		})

		it('lets the content shrink below its own size, so it can take the scrolling', () => {
			const rule = ruleFor('.content')

			expect(rule).toContain('flex: 1 1 auto')
			expect(rule).toContain('min-height: 0')
		})

		it('floats the foot over the content, carrying nothing of its own', () => {
			// no shadow: where content scrolls under it, the scrolling part draws a
			// line, and only when there is something out of sight to draw it for
			const rule = ruleFor('.foot')

			expect(rule).toContain('z-index: 1')
			expect(rule).not.toContain('box-shadow')
		})

		it('keeps the foot clear of a phone\'s home indicator', () => {
			expect(source).toContain('env(safe-area-inset-bottom)')
		})
	})

	it('is full width by default, for a dialog that is somewhere to work', () => {
		mountDialog()

		expect(panel().classes()).not.toContain('compact')
	})

	it('can be narrowed for a dialog that only says something', () => {
		// a short message across 720px makes the eye travel back over half a panel
		// of nothing to find the next line
		mountDialog({ compact: true })

		expect(panel().classes()).toContain('compact')
	})
})
