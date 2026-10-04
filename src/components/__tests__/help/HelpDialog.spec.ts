import { mount, type VueWrapper } from '@vue/test-utils'
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { cssOf, sourceOf } from '../css'

import HelpDialog from '../../help/HelpDialog.vue'
import { InstaxFilmVariant } from '../../../interfaces/PrinterStateConfig'
import { PRINT_RESOLUTION } from '../../../polaroid/frame.geometry'
import { SHORTCUTS } from '../../../polaroid/shortcuts'

const DIALOG = 'src/components/help/HelpDialog.vue'
const ruleFor = cssOf(DIALOG)

describe('HelpDialog', () => {
	let wrapper: VueWrapper

	const mountDialog = (props = {}) => {
		wrapper = mount(HelpDialog, {
			attachTo: document.body,
			// rendered in place, so the teleported panel is reachable from the wrapper
			global: { stubs: { teleport: true } },
			props: { open: true, ...props }
		})
		return wrapper
	}

	beforeEach(() => mountDialog())
	afterEach(() => wrapper?.unmount())

	it('renders nothing while closed', () => {
		wrapper.unmount()
		mountDialog({ open: false })

		expect(wrapper.find('[data-testid="help-dialog"]').exists()).toBe(false)
	})

	it('is the same dialog shell the film look uses', () => {
		const panel = wrapper.find('[data-testid="help-dialog"]')

		expect(panel.attributes('role')).toBe('dialog')
		expect(panel.attributes('aria-modal')).toBe('true')
		expect(wrapper.find('[data-testid="help-dialog-close"]').exists()).toBe(true)
	})

	it('closes from the shell and from its own button', async () => {
		await wrapper.find('[data-testid="help-dialog-close"]').trigger('click')
		expect(wrapper.emitted('close')).toHaveLength(1)

		await wrapper.find('[data-testid="help-done"]').trigger('click')
		expect(wrapper.emitted('close')).toHaveLength(2)
	})

	it('says what the project is for, briefly', () => {
		const lead = wrapper.find('.lead').text()

		expect(lead).toContain('INSTAX')
		expect(lead).toMatch(/bluetooth/i)
		expect(lead).toMatch(/download/i)

		// the queue is the thing it does that the official apps do not, and the point
		// of it is not having to wait for one print to finish
		expect(lead).toMatch(/queue/i)
		expect(lead).toMatch(/still printing|while the previous/i)

		// the dialog is a reference, not a README
		expect(lead.length).toBeLessThan(360)
	})

	it('makes clear it is nobody\'s official app', () => {
		const disclaimer = wrapper.find('[data-testid="help-disclaimer"]').text()

		expect(disclaimer).toMatch(/not affiliated/i)
		expect(disclaimer).toContain('INSTAX')
		expect(disclaimer).toContain('FUJIFILM')
	})

	it('wears the printer names in the face the connected printer uses', () => {
		const rule = ruleFor('.film-name')

		expect(rule).toContain("font-family: 'Keedy Sans'")
		expect(rule).toContain('font-size: 21px')

		// the same two the printer card wears, so they read as one family
		const card = cssOf('src/components/printer/PrinterStatusCard.vue')('.printer-name')
		expect(card).toContain("font-family: 'Keedy Sans'")
		expect(card).toContain('font-size: 21px')
	})

	describe('Printers', () => {
		it('lists every film the app knows about, at its print size', () => {
			// driven off the app's own table, so a new variant cannot be left out
			expect(wrapper.findAll('.films li').length).toBe(Object.values(InstaxFilmVariant).length)

			for (const variant of Object.values(InstaxFilmVariant)) {
				const size = PRINT_RESOLUTION[variant]
				expect(wrapper.text(), variant).toContain(`${size.width} × ${size.height}`)
			}
		})

		it('names every Link printer under the film it takes', () => {
			// the name now reads "instax mini", the way the printer card says it
			const row = (variant: InstaxFilmVariant) => wrapper.findAll('.films li')
				.find((item) => item.find('.film-name').text() === `instax ${variant}`)!.text()

			expect(row(InstaxFilmVariant.MINI)).toContain('mini Link 3')
			expect(row(InstaxFilmVariant.MINI)).toContain('mini Link+')
			expect(row(InstaxFilmVariant.SQUARE)).toContain('SQUARE Link')
			expect(row(InstaxFilmVariant.WIDE)).toContain('Link WIDE 2')
		})

		it('links every model to its own page at instax.com', () => {
			const models = wrapper.findAll('.film-models a');

			// seven printers across the three films, each with a slug of its own
			expect(models.length).toBe(7);

			for (const link of models) {
				expect(link.attributes('href')).toMatch(/^https:\/\/www\.instax\.com\/[a-z0-9_]+\/en\/$/);
				expect(link.attributes('target')).toBe('_blank');
				expect(link.attributes('rel')).toContain('noreferrer');
			}

			// no two printers point at the same page
			const hrefs = models.map((link) => link.attributes('href'));
			expect(new Set(hrefs).size).toBe(hrefs.length);
		});

		it('names the model in each link, so the target is not a mystery', () => {
			const link = wrapper.findAll('.film-models a')
				.find((item) => item.text() === 'mini Link+')!;

			expect(link.attributes('href')).toBe('https://www.instax.com/mini_link_plus/en/');
			expect(link.attributes('title')).toContain('instax mini Link+');
		});

		it('keeps the separators out of what is read aloud', () => {
			for (const separator of wrapper.findAll('.film-separator')) {
				expect(separator.attributes('aria-hidden')).toBe('true');
			}
		});

		it('picks the model out in the theme colour under the pointer', () => {
			expect(sourceOf(DIALOG)).toContain('.film-models a:hover')
			expect(sourceOf(DIALOG)).toContain('color: rgb(var(--dynamic-bg-color))')
		});

		it('says the pairing rule the app actually uses', () => {
			// it filters on a name prefix rather than a list of models
			expect(wrapper.find('.note').text()).toContain('INSTAX')
		})
	})

	describe('Shortcuts', () => {
		const toggle = () => wrapper.find('[data-testid="help-shortcuts-toggle"]')
		const panel = () => wrapper.find('[data-testid="help-shortcuts"]')

		it('starts folded away, being the longest part and the least often wanted', () => {
			expect(toggle().attributes('aria-expanded')).toBe('false')
			expect(panel().classes()).not.toContain('open')
		})

		it('opens and closes again', async () => {
			await toggle().trigger('click')
			expect(toggle().attributes('aria-expanded')).toBe('true')
			expect(panel().classes()).toContain('open')

			await toggle().trigger('click')
			expect(toggle().attributes('aria-expanded')).toBe('false')
			expect(panel().classes()).not.toContain('open')
		})

		it('says which region it opens, so it is announced as a disclosure', () => {
			expect(toggle().attributes('aria-controls')).toBe('help-shortcuts')
			expect(panel().attributes('id')).toBe('help-shortcuts')
		})

		it('eases open rather than appearing, whatever the list\'s length', () => {
			const rule = ruleFor('.panel')

			// a grid row from nothing to its content, rather than a guessed max-height
			expect(rule).toContain('grid-template-rows: 0fr')
			expect(rule).toContain('transition: grid-template-rows')
			expect(sourceOf(DIALOG)).not.toContain('max-height')
		})

		it('runs two pairs across where there is room, and one on a phone', () => {
			// one key column and one description column by default
			expect(ruleFor('.shortcuts')).toContain('grid-template-columns: auto 1fr')

			// and a second pair of columns once the dialog is wide enough
			const wide = sourceOf(DIALOG).slice(sourceOf(DIALOG).indexOf('@media (min-width: 560px)'))
			expect(wide).toContain('grid-template-columns: auto 1fr auto 1fr')
		})

		it('names what it opens before it is opened', () => {
			expect(toggle().text()).toMatch(/keyboard/i)
		})

		it('lists every one the editor answers to', () => {
			// read from the same table the tooltips use, so the two cannot disagree
			expect(wrapper.findAll('.shortcuts dd').length).toBe(Object.keys(SHORTCUTS).length)

			for (const shortcut of Object.values(SHORTCUTS)) {
				expect(wrapper.text(), shortcut.hint).toContain(shortcut.description)
			}
		})

		it('shows a two key shortcut as two keys', () => {
			const keys = wrapper.findAll('.shortcuts dt')
				.map((row) => row.findAll('kbd').map((key) => key.text()))

			expect(keys).toContainEqual(['Shift', 'C'])
			expect(keys).toContainEqual(['W'])
		})
	})

	describe('Sign off', () => {
		it('links the source, opened away from the editor', () => {
			const link = wrapper.find('[data-testid="help-github"]')

			expect(link.attributes('href')).toBe('https://github.com/linssenste/instax-link-web')
			expect(link.attributes('target')).toBe('_blank')
			expect(link.attributes('rel')).toContain('noreferrer')
		})

		it('keeps the mark out of what is read aloud', () => {
			expect(wrapper.find('.github-mark').attributes('aria-hidden')).toBe('true')
			expect(wrapper.find('[data-testid="help-github"]').text()).toMatch(/github/i)
		})

		it('wears the display face the printer names wear, rather than a third one', () => {
			expect(ruleFor('.github')).toContain("font-family: 'Keedy Sans'")
		})
	})

})
