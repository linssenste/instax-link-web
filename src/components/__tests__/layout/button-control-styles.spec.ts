import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

// jsdom does not apply scoped component styles, so these declarations are
// checked in the source. They exist because a <button> brings UA styles that a
// <div> does not: content is centred, and box-sizing defaults to border-box.
const read = (path: string) =>
	readFileSync(resolve(process.cwd(), 'src/components', path), 'utf8')

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
		// with border-box the padding eats into the 48px, losing the deep bottom
		// border that makes it read as a polaroid
		const rule = ruleFor(read('layout/PolaroidSizeSelector.vue'), '.polaroid')

		expect(rule).toContain('box-sizing: content-box')
		expect(rule).toContain('height: 48px')
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
})
