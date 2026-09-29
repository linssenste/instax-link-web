import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

// jsdom does not apply scoped component styles, so these declarations are
// checked in the source. They exist because a <button> brings UA styles that a
// <div> does not: content is centred, and box-sizing defaults to border-box.
const read = (path: string) =>
	readFileSync(resolve(process.cwd(), 'src/components', path), 'utf8')

const readFrom = (path: string) =>
	readFileSync(resolve(process.cwd(), 'src', path), 'utf8')

const ruleFor = (source: string, selector: string) => {
	const start = source.indexOf(`${selector} {`)
	expect(start, `${selector} not found`).toBeGreaterThan(-1)
	return source.slice(start, source.indexOf('}', start))
}

describe('Controls converted from div to button', () => {
	it('anchors the upload overlay, which a button would otherwise centre', () => {
		const rule = ruleFor(read('files/SelectImageUpload.vue'), '.area-background')

		expect(rule).toContain('position: absolute')
		expect(rule).toContain('top: 0')
		expect(rule).toContain('left: 0')
	})

	it('keeps the film size preview on content-box, so it stays polaroid shaped', () => {
		// the height and padding are design values to taste; what must not change is
		// the box model. On border-box the padding eats into the height instead of
		// adding to it, which loses the deep bottom border of a polaroid
		const rule = ruleFor(read('layout/PolaroidSizeSelector.vue'), '.polaroid')

		expect(rule).toContain('box-sizing: content-box')
		expect(rule).toMatch(/height:\s*\d+px/)
	})

	it('neutralises the global button chrome on each converted control', () => {
		const controls: [string, string][] = [
			['layout/ThemeColorSelector.vue', '.color-item'],
			['layout/PolaroidSizeSelector.vue', '.polaroid'],
			['files/SelectImageUpload.vue', '.upload-area'],
			['polaroid/CropperArea.vue', '.remove-button']
		]

		for (const [file, selector] of controls) {
			const rule = ruleFor(read(file), selector)

			// the global button rule sets a theme background, a border and .85 opacity
			expect(rule, selector).toContain('border: none')
			expect(rule, selector).toContain('opacity: 1')
		}
	})

	it('gives every converted control a visible focus ring', () => {
		const controls: [string, string][] = [
			['layout/ThemeColorSelector.vue', '.color-item:focus-visible'],
			['layout/PolaroidSizeSelector.vue', '.polaroid:focus-visible'],
			['files/SelectImageUpload.vue', '.upload-area:focus-visible'],
			['polaroid/CropperArea.vue', '.remove-button:focus-visible']
		]

		for (const [file, selector] of controls) {
			expect(ruleFor(read(file), selector), selector).toContain('outline:')
		}
	})

	it('keeps the icon-only download button circular and light', () => {
		// the action button next to it asks for 100% width, so this one must not
		// shrink; and the spinner inside draws in currentColor
		const rule = ruleFor(read('layout/SettingsExpansion.vue'), '.download-icon-button')

		expect(rule).toContain('flex: none')
		expect(rule).toContain('border-radius: 50%')
		expect(rule).toContain('color: white')
	})

	it('keeps the corner controls clickable above the editor', () => {
		// the editor promotes itself to animate in, which puts it in the positioned
		// painting layer. Coming later in the DOM, it would otherwise cover the
		// controls and swallow their clicks
		const app = readFrom('App.vue')

		for (const selector of ['.theme-colors', '.printer-panel', '.printer-variant-settings']) {
			expect(ruleFor(app, selector), selector).toContain('z-index: 1')
		}
	})

	it('contains the editor stacking context so its inner z-indexes stay inside', () => {
		const rule = ruleFor(read('polaroid/PolaroidEditor.vue'), '.editor-root')

		expect(rule).toContain('position: relative')
		expect(rule).toContain('z-index: 0')
	})

	it('drops the layer promotion once the reveal has finished', () => {
		const rule = ruleFor(read('polaroid/PolaroidEditor.vue'), '.editor-root.ready')

		expect(rule).toContain('will-change: auto')
	})

	it('paints buttons in the chosen colour, and lightens only on hover', () => {
		const style = readFrom('style.css')

		// resting state is the exact theme colour, not a faded pass at it
		expect(ruleFor(style, 'button')).toContain('background-color: rgb(var(--dynamic-bg-color))')
		expect(ruleFor(style, 'button')).toContain('opacity: 1')

		// hover mixes white in rather than restoring full strength, and a disabled
		// button is excluded so it cannot look pressable
		const hover = ruleFor(style, '\tbutton:hover:where(:not(:disabled))')
		expect(hover).toContain('color-mix(in srgb, rgb(var(--dynamic-bg-color)) 80%, #ffffff)')
	})

	it('leaves a disabled button out of the hover treatment', () => {
		// :disabled still matches :hover, so it has to be excluded by hand or a
		// button mid-render lightens under the cursor and invites another click
		const style = readFrom('style.css')

		expect(style).toContain('button:hover:where(:not(:disabled))')
	})

	it('keeps the hover rule weak enough for components to override', () => {
		// :where() costs no specificity, so this stays an element rule and a single
		// scoped class still wins. Written as :not() it would outrank them all and
		// paint the size selector, upload area and grab handle in the theme colour
		const style = readFrom('style.css')

		expect(style).not.toContain('button:hover:not(')
		expect(style).toContain(':where(:not(:disabled))')
	})

	it('deepens the handle tint on hover instead of lifting it with a shadow', () => {
		const rule = ruleFor(read('layout/SettingsExpansion.vue'), '\t.expand-button:hover:not(:disabled)')

		// the global button hover adds a shadow; the handle sits flat on the panel
		expect(rule).toContain('box-shadow: none')
		expect(rule).toContain('rgba(var(--dynamic-bg-color), .2)')
	})

	it('masks the expand chevron so it can take the theme colour on hover', () => {
		const panel = read('layout/SettingsExpansion.vue')

		// an <img> cannot be recoloured; a mask can
		expect(ruleFor(panel, '.chevron')).toContain('mask:')
		expect(ruleFor(panel, '\t.expand-button:hover:not(:disabled) .chevron'))
			.toContain('rgb(var(--dynamic-bg-color))')

		// and a disabled handle stays out of it
		expect(panel).toContain('.expand-button:hover:not(:disabled)')
	})

	it('gives every shared button the same grey unavailable state', () => {
		// connect and download are the same component, so they must not disagree
		const rule = ruleFor(read('controls/LoadingButton.vue'), 'button:disabled')

		expect(rule).toContain('background-color: rgb(var(--grey-color))')
		expect(rule).toContain('cursor: not-allowed')

		// and nothing overrides it per button
		expect(read('printer/PrinterConnection.vue')).not.toContain('connect-button:disabled')
	})
})
