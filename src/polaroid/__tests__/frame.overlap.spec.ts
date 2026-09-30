import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { InstaxFilmVariant } from '../../interfaces/PrinterStateConfig'
import { POLAROID_EXPORT_WIDTH, POLAROID_FRAME_WIDTH, POLAROID_FRAME_HEIGHT } from '../frame.geometry'

/**
 * The frame artwork has a transparent window and the photo goes behind it, so the
 * photo has to be a little larger than that window: too small and a seam of
 * background shows, too large and the frame swallows a visible margin of the
 * picture. These are the numbers that were measured off the artwork itself, and
 * these tests hold the two places that use them in step with one another.
 *
 * Windows in artwork pixels, measured along a line through the middle of each.
 */
const DISPLAY_WINDOW = {
	[InstaxFilmVariant.MINI]: { left: 21.0, right: 261.5, top: 37.5 },
	[InstaxFilmVariant.SQUARE]: { left: 27.0, right: 343.0, top: 40.0 },
	[InstaxFilmVariant.WIDE]: { left: 21.3, right: 499.3, top: 38.6 }
}

const EXPORT_ARTWORK = {
	[InstaxFilmVariant.MINI]: { width: 640, window: { left: 48, right: 594, top: 85 } },
	[InstaxFilmVariant.SQUARE]: { width: 836, window: { left: 61, right: 779, top: 91 } },
	[InstaxFilmVariant.WIDE]: { width: 1200, window: { left: 49, right: 1147, top: 89 } }
}

const VARIANTS = [InstaxFilmVariant.MINI, InstaxFilmVariant.SQUARE, InstaxFilmVariant.WIDE]

const read = (path: string) => readFileSync(resolve(process.cwd(), path), 'utf8')

/** the percentages the crop window is laid out with, straight from the stylesheet */
const cropRule = (variant: InstaxFilmVariant) => {
	const source = read('src/components/polaroid/PolaroidFrame.vue')
	const start = source.indexOf(`.inner-${variant} {`)
	expect(start, `.inner-${variant} not found`).toBeGreaterThan(-1)

	const rule = source.slice(start, source.indexOf('}', start))
	const top = Number(/top:\s*([\d.]+)%/.exec(rule)?.[1])
	const width = Number(/width:\s*([\d.]+)%/.exec(rule)?.[1])

	expect(Number.isFinite(top) && Number.isFinite(width), `.inner-${variant}`).toBe(true)
	return { top, width }
}

/** where the download places the photo, straight from the compositor */
const placement = (variant: InstaxFilmVariant) => {
	const source = read('src/cropper/cropper.download.ts')
	const value = (name: string) => {
		const list = new RegExp(`const ${name}: Record<string, number> = \\{([^}]*)\\}`).exec(source)?.[1]
		return Number(new RegExp(`${variant}:\\s*(\\d+)`).exec(list ?? '')?.[1])
	}

	return { left: value('PHOTO_LEFT'), top: value('PHOTO_TOP') }
}

describe('How far the frame overlaps the photo', () => {
	describe('On screen', () => {
		it('covers the crop window on every side, so no seam of background shows', () => {
			for (const variant of VARIANTS) {
				const { top, width } = cropRule(variant)
				const box = POLAROID_FRAME_WIDTH[variant]
				const window = DISPLAY_WINDOW[variant]

				// the crop window is centred, so its sides follow from its width
				const cropWidth = box * width / 100
				const left = (box - cropWidth) / 2

				expect(window.left - left, `${variant} left`).toBeGreaterThan(0)
				expect((left + cropWidth) - window.right, `${variant} right`).toBeGreaterThan(0)
				expect(window.top - POLAROID_FRAME_HEIGHT * top / 100, `${variant} top`)
					.toBeGreaterThan(0)
			}
		})

		it('keeps that overlap small, within a few pixels of the window', () => {
			// it used to run to eleven on one side, enough to hide a guide drawn on the
			// boundary and a visible margin of the picture with it
			for (const variant of VARIANTS) {
				const { top, width } = cropRule(variant)
				const box = POLAROID_FRAME_WIDTH[variant]
				const window = DISPLAY_WINDOW[variant]

				const cropWidth = box * width / 100
				const left = (box - cropWidth) / 2

				expect(window.left - left, `${variant} left`).toBeLessThan(6)
				expect((left + cropWidth) - window.right, `${variant} right`).toBeLessThan(6)
				expect(window.top - POLAROID_FRAME_HEIGHT * top / 100, `${variant} top`)
					.toBeLessThan(6)
			}
		})
	})

	describe('On the download', () => {
		it('covers the photo on every side there too', () => {
			for (const variant of VARIANTS) {
				const { left, top } = placement(variant)
				const { window } = EXPORT_ARTWORK[variant]
				const width = POLAROID_EXPORT_WIDTH[variant]

				expect(window.left - left, `${variant} left`).toBeGreaterThan(0)
				expect((left + width) - window.right, `${variant} right`).toBeGreaterThan(0)
				expect(window.top - top, `${variant} top`).toBeGreaterThan(0)
			}
		})

		it('sits the photo evenly, rather than twice as deep on one side', () => {
			// the left inset used to be shared out by hand and the top was one number
			// for all three, which put the print off centre against its own frame
			for (const variant of VARIANTS) {
				const { left } = placement(variant)
				const { window } = EXPORT_ARTWORK[variant]
				const width = POLAROID_EXPORT_WIDTH[variant]

				const leftLip = window.left - left
                const rightLip = (left + width) - window.right

				expect(Math.abs(leftLip - rightLip), `${variant}`).toBeLessThan(6)
			}
		})

		it('hides the same share of the picture as the screen does', () => {
			// Otherwise the print is framed differently from the preview it came from.
			// Measured as how much wider the photo is than the window it goes behind,
			// which is the part the frame takes: comparing one side alone would not
			// work, since the crop window is centred in its box while the artwork's
			// own window is a pixel or two off centre.
			for (const variant of VARIANTS) {
				const box = POLAROID_FRAME_WIDTH[variant]
				const window = DISPLAY_WINDOW[variant]
				const onScreen = (box * cropRule(variant).width / 100) - (window.right - window.left)

				const artwork = EXPORT_ARTWORK[variant]
				const onPrint = POLAROID_EXPORT_WIDTH[variant]
					- (artwork.window.right - artwork.window.left)

				expect(onPrint / (artwork.width / box), `${variant}`).toBeCloseTo(onScreen, 0)
			}
		})
	})
})
