import { mount } from '@vue/test-utils'
import { describe, it, expect } from 'vitest'

import LoadingButton from '../../controls/LoadingButton.vue'

describe('LoadingButton', () => {
	const mountButton = (props = {}) => mount(LoadingButton, {
		props: { label: 'Download', icon: '/download.svg', ...props }
	})

	it('renders a non-submitting button with its label and icon', () => {
		const wrapper = mountButton()

		expect(wrapper.element.tagName).toBe('BUTTON')
		expect(wrapper.attributes('type')).toBe('button')
		expect(wrapper.text()).toBe('Download')
		expect(wrapper.find('img').attributes('src')).toBe('/download.svg')
	})

	it('keeps the icon out of the accessible name', () => {
		expect(mountButton().find('img').attributes('alt')).toBe('')
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
			expect(wrapper.find('img').exists()).toBe(false)
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

			expect(wrapper.find('img').classes()).not.toContain('spaced')
			expect(wrapper.text()).toBe('')
		})

		it('drops the gap for the spinner too', () => {
			const wrapper = mount(LoadingButton, { props: { icon: '/download.svg', loading: true } })

			expect(wrapper.find('.button-spinner').classes()).not.toContain('spaced')
		})
	})

	it('spaces the icon from the label when both are present', () => {
		expect(mountButton().find('img').classes()).toContain('spaced')
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

	it('sizes the icon as asked', () => {
		const wrapper = mountButton({ iconSize: 18 })

		expect(wrapper.find('img').attributes('width')).toBe('18')
		expect(wrapper.find('img').attributes('height')).toBe('18')
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
