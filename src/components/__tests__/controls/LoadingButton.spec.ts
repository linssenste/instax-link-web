import { mount } from '@vue/test-utils'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, it, expect } from 'vitest'

import LoadingButton from '../../controls/LoadingButton.vue'

// jsdom applies no scoped styles, so the rules are read from the source. Walking
// lines rather than slicing on braces: a selector can appear in a grouped rule too,
// and a v-bind interpolation carries a brace of its own.
const lines = readFileSync(
	resolve(process.cwd(), 'src/components/controls/LoadingButton.vue'), 'utf8'
).split('\n')

const ruleFor = (selector: string) => {
	const opens = `${selector} {`
	const start = lines.findIndex((line, index) =>
		line === opens && !(lines[index - 1] ?? '').trimEnd().endsWith(',')
	)

	expect(start, `${selector} not found on its own`).toBeGreaterThan(-1)

	const end = lines.findIndex((line, index) => index > start && line === '}')
	return lines.slice(start, end).join('\n')
}

describe('LoadingButton', () => {
	const mountButton = (props = {}) => mount(LoadingButton, {
		props: { label: 'Download', icon: '/download.svg', ...props }
	})

	it('renders a non-submitting button with its label and icon', () => {
		const wrapper = mountButton()

		expect(wrapper.element.tagName).toBe('BUTTON')
		expect(wrapper.attributes('type')).toBe('button')
		expect(wrapper.text()).toBe('Download')
		expect(wrapper.find('.button-icon').attributes('style')).toContain('url("/download.svg")')
	})

	it('keeps the icon out of the accessible name', () => {
		// a mask rather than an image, so the mark takes the button's own colour
		const wrapper = mountButton()

		expect(wrapper.find('img').exists()).toBe(false)
		expect(wrapper.find('.button-icon').attributes('aria-hidden')).toBe('true')
	})

	it('quotes the mask source, which a data uri needs', () => {
		// a small icon is inlined as a data uri carrying a raw apostrophe. Unquoted,
		// url() cannot hold one: the declaration is thrown away and the mark comes out
		// as a filled square in the button's colour
		const inlined = "data:image/svg+xml,%3csvg%20xmlns='http://www.w3.org/2000/svg'/%3e"
		const wrapper = mountButton({ icon: inlined })

		expect(wrapper.find('.button-icon').attributes('style'))
			.toContain(`url("${inlined}")`)
	})

	it('draws the icon in the button\'s own colour', () => {
		// the icons ship with a placeholder fill that reads as off-white on a coloured
		// button, and an img cannot be recoloured
		const rule = ruleFor('.button-icon')

		expect(rule).toContain('background-color: currentColor')
		expect(rule).toContain('mask: var(--button-icon)')
	})

	it('emits click when pressed', async () => {
		const wrapper = mountButton()

		await wrapper.trigger('click')

		expect(wrapper.emitted('click')).toHaveLength(1)
	})

	describe('While loading', () => {
		it('swaps the icon for a spinner and disables itself', () => {
			const wrapper = mountButton({ loading: true })

			expect(wrapper.find('.button-spinner').exists()).toBe(true)
			expect(wrapper.find('.button-icon').exists()).toBe(false)
			expect(wrapper.attributes('disabled')).toBeDefined()
		})

		it('shows the loading label when one is given', () => {
			expect(mountButton({ loading: true, loadingLabel: 'Rendering' }).text()).toBe('Rendering')
		})

		it('keeps the normal label when no loading label is given', () => {
			expect(mountButton({ loading: true }).text()).toBe('Download')
		})

		it('does not emit click', async () => {
			const wrapper = mountButton({ loading: true })

			await wrapper.trigger('click')

			expect(wrapper.emitted('click')).toBeUndefined()
		})

		it('marks the spinner as decorative', () => {
			expect(mountButton({ loading: true }).find('.button-spinner').attributes('aria-hidden')).toBe('true')
		})
	})

	describe('While disabled', () => {
		it('does not emit click', async () => {
			const wrapper = mountButton({ disabled: true })

			await wrapper.trigger('click')

			expect(wrapper.emitted('click')).toBeUndefined()
			expect(wrapper.attributes('disabled')).toBeDefined()
		})

		it('shows no spinner', () => {
			expect(mountButton({ disabled: true }).find('.button-spinner').exists()).toBe(false)
		})
	})

	describe('Without a label', () => {
		it('drops the gap that would offset a centred icon', () => {
			const wrapper = mount(LoadingButton, { props: { icon: '/download.svg' } })

			expect(wrapper.find('.button-icon').classes()).not.toContain('spaced')
			expect(wrapper.text()).toBe('')
		})

		it('drops the gap for the spinner too', () => {
			const wrapper = mount(LoadingButton, { props: { icon: '/download.svg', loading: true } })

			expect(wrapper.find('.button-spinner').classes()).not.toContain('spaced')
		})
	})

	it('spaces the icon from the label when both are present', () => {
		expect(mountButton().find('.button-icon').classes()).toContain('spaced')
	})

	it('passes attributes through to the button', () => {
		const wrapper = mountButton({ label: '' })
		expect(wrapper.attributes('type')).toBe('button')

		const labelled = mount(LoadingButton, {
			props: { icon: '/x.svg' },
			attrs: { 'aria-label': 'Download the polaroid', 'data-testid': 'icon-button' }
		})
		expect(labelled.attributes('aria-label')).toBe('Download the polaroid')
		expect(labelled.attributes('data-testid')).toBe('icon-button')
	})

	it('sizes the icon and the spinner that replaces it alike', () => {
		// both are bound to the same prop through the stylesheet, so a button does not
		// change size the moment it starts working. jsdom does not apply a bound CSS
		// variable, so the binding is read from the source
		const binding = "v-bind('`${iconSize}px`')"

		expect(ruleFor('.button-icon')).toContain(`width: ${binding}`)
		expect(ruleFor('.button-spinner')).toContain(`width: ${binding}`)
	})

	describe('Reads as genuinely unavailable', () => {
		it('sets the disabled attribute, not just a faded look', () => {
			const wrapper = mountButton({ loading: true })

			// the attribute is what stops the browser dispatching the click
			expect(wrapper.attributes('disabled')).toBeDefined()
			expect((wrapper.element as HTMLButtonElement).disabled).toBe(true)
		})

		it('marks a loading button as busy, so the cursor can differ from unavailable', () => {
			expect(mountButton({ loading: true }).classes()).toContain('busy')
			expect(mountButton({ disabled: true }).classes()).not.toContain('busy')
		})

		it('blocks activation for both loading and disabled', async () => {
			for (const state of [{ loading: true }, { disabled: true }]) {
				const wrapper = mountButton(state)

				await wrapper.trigger('click')

				expect(wrapper.emitted('click'), JSON.stringify(state)).toBeUndefined()
			}
		})
	})
})
