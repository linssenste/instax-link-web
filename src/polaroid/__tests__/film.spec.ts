import { describe, it, expect } from 'vitest'

import {
	applyFilm, blurRadiusFor, filmFilter, hasPixelWork, isNeutral,
	DEFAULT_ADJUSTMENTS, NEUTRAL_ADJUSTMENTS, type FilmAdjustments
} from '../film'

const pixel = (red: number, green: number, blue: number): ImageData =>
	({ data: new Uint8ClampedArray([red, green, blue, 255]), width: 1, height: 1 } as ImageData)

const run = (data: ImageData, overrides: Partial<FilmAdjustments>) => {
	applyFilm(data, { ...NEUTRAL_ADJUSTMENTS, ...overrides })
	return [data.data[0], data.data[1], data.data[2]]
}

describe('Film adjustments', () => {
	it('starts from the film\'s own range rather than from a clean image', () => {
		// measured off scanned polaroids: they floor around 54 to 66 and ceiling
		// around 200, and they carry no grain worth the name
		expect(DEFAULT_ADJUSTMENTS.lift).toBeGreaterThan(0.5)
		expect(DEFAULT_ADJUSTMENTS.wash).toBeGreaterThan(0.5)
		expect(DEFAULT_ADJUSTMENTS.grain).toBe(0)
	})

	it('starts from a look with some film character to it', () => {
		expect(DEFAULT_ADJUSTMENTS).toEqual({
			brightness: 0.02, contrast: 16, midtones: 0, saturation: 0.45, temperature: 28,
			tint: 0, lift: 0.85, wash: 0.85, grain: 0, blur: 0
		})
	})

	it('leaves the pixels untouched when nothing is dialled in', () => {
		const data = pixel(10, 120, 240)
		applyFilm(data, NEUTRAL_ADJUSTMENTS)

		expect([...data.data]).toEqual([10, 120, 240, 255])
	})

	it('recognises a neutral setting', () => {
		expect(isNeutral(NEUTRAL_ADJUSTMENTS)).toBe(true)
		expect(isNeutral(DEFAULT_ADJUSTMENTS)).toBe(false)
	})

	it('counts a blur as something to apply, though no pixel pass can do it', () => {
		const soft = { ...NEUTRAL_ADJUSTMENTS, blur: 3 }

		// the two have to disagree here, or a photo that is only blurred either
		// skips the blur or runs a pixel pass that changes nothing
		expect(isNeutral(soft)).toBe(false)
		expect(hasPixelWork(soft)).toBe(false)
	})

	describe('Brightness', () => {
		it('lifts every channel equally', () => {
			expect(run(pixel(100, 100, 100), { brightness: 0.1 })).toEqual([126, 126, 126])
		})

		it('drops every channel for a negative value', () => {
			const [red] = run(pixel(100, 100, 100), { brightness: -0.1 })
			expect(red).toBeLessThan(100)
		})

		it('clamps rather than wrapping round', () => {
			expect(run(pixel(250, 250, 250), { brightness: 0.5 })).toEqual([255, 255, 255])
			expect(run(pixel(5, 5, 5), { brightness: -0.5 })).toEqual([0, 0, 0])
		})
	})

	describe('Contrast', () => {
		it('pushes away from mid grey', () => {
			const [light] = run(pixel(200, 200, 200), { contrast: 40 })
			const [dark] = run(pixel(60, 60, 60), { contrast: 40 })

			expect(light).toBeGreaterThan(200)
			expect(dark).toBeLessThan(60)
		})

		it('pulls towards mid grey when negative', () => {
			const [light] = run(pixel(200, 200, 200), { contrast: -40 })
			expect(light).toBeLessThan(200)
			expect(light).toBeGreaterThan(128)
		})

		it('leaves mid grey where it is', () => {
			expect(run(pixel(128, 128, 128), { contrast: 50 })).toEqual([128, 128, 128])
		})
	})

	describe('Saturation', () => {
		it('pushes colour away from its own brightness', () => {
			const [red, green, blue] = run(pixel(200, 100, 100), { saturation: 1 })

			expect(red).toBeGreaterThan(200)
			expect(green).toBeLessThan(100)
			expect(blue).toBeLessThan(100)
		})

		it('drains colour towards grey', () => {
			const [red, green, blue] = run(pixel(200, 100, 100), { saturation: -1 })

			expect(red).toBe(green)
			expect(green).toBe(blue)
		})

		it('weighs green above blue rather than averaging', () => {
			// a flat average would drain these two to the same grey
			const [green] = run(pixel(0, 255, 0), { saturation: -1 })
			const [blue] = run(pixel(0, 0, 255), { saturation: -1 })

			expect(green).toBeGreaterThan(blue)
		})

		it('leaves grey grey', () => {
			expect(run(pixel(120, 120, 120), { saturation: 2 })).toEqual([120, 120, 120])
		})
	})

	describe('Temperature', () => {
		it('warms towards pink and orange', () => {
			const [red, green, blue] = run(pixel(120, 120, 120), { temperature: 100 })

			// green comes along for the ride, or the cast lands on red rather than
			// on the orange a warm frame actually goes
			expect(red).toBeGreaterThan(120)
			expect(green).toBeGreaterThan(120)
			expect(green).toBeLessThan(red)
			expect(blue).toBeLessThan(120)
		})

		it('puts the cast in the shadows, where the dyes are least neutral', () => {
			const shadow = run(pixel(30, 30, 30), { temperature: 100 })
			const highlight = run(pixel(220, 220, 220), { temperature: 100 })

			expect(shadow[0] - shadow[2]).toBeGreaterThan(highlight[0] - highlight[2])
		})

		it('cools towards the blue cast of a cold shot', () => {
			const [red, , blue] = run(pixel(120, 120, 120), { temperature: -100 })

			expect(red).toBeLessThan(120)
			expect(blue).toBeGreaterThan(120)
		})

		it('does nothing at zero', () => {
			expect(run(pixel(120, 130, 140), { temperature: 0 })).toEqual([120, 130, 140])
		})
	})

	describe('Grain', () => {
		it('scatters the values without shifting them far', () => {
			const data = new Uint8ClampedArray(400 * 4).fill(128)
			const imageData = { data, width: 100, height: 1 } as ImageData

			applyFilm(imageData, { ...NEUTRAL_ADJUSTMENTS, grain: 0.3 })

			const values = [...data].filter((_, index) => index % 4 !== 3)
			expect(new Set(values).size).toBeGreaterThan(1)

			const average = values.reduce((sum, value) => sum + value, 0) / values.length
			expect(average).toBeGreaterThan(115)
			expect(average).toBeLessThan(141)
		})
	})

	describe('As a Konva filter', () => {
		it('hands back a function bound to the settings', () => {
			const filter = filmFilter({ ...NEUTRAL_ADJUSTMENTS, brightness: 0.1 })
			const data = pixel(100, 100, 100)

			filter(data)

			expect(data.data[0]).toBe(126)
		})

		it('leaves the alpha channel alone', () => {
			const data = pixel(10, 20, 30)
			applyFilm(data, DEFAULT_ADJUSTMENTS)

			expect(data.data[3]).toBe(255)
		})
	})

	describe('Blur', () => {
		it('is left to the renderer, since it reads neighbouring pixels', () => {
			const data = pixel(10, 120, 240)
			applyFilm(data, { ...NEUTRAL_ADJUSTMENTS, blur: 8 })

			expect([...data.data]).toEqual([10, 120, 240, 255])
		})

		it('scales with the frame, so a look survives the jump to print size', () => {
			// authored against a 320px frame: the same setting has to soften a
			// miniature and a print by the same amount of the picture
			expect(blurRadiusFor(4, 320)).toBe(4)
			expect(blurRadiusFor(4, 640)).toBe(8)
			expect(blurRadiusFor(4, 160)).toBe(2)
		})

		it('asks for nothing when there is nothing to blur', () => {
			expect(blurRadiusFor(0, 800)).toBe(0)
			expect(blurRadiusFor(4, 0)).toBe(0)
		})
	})

	describe('Midtones', () => {
		it('brightens the middle of the range', () => {
			const [mid] = run(pixel(128, 128, 128), { midtones: 1 })
			expect(mid).toBeGreaterThan(128)
		})

		it('darkens it the other way', () => {
			const [mid] = run(pixel(128, 128, 128), { midtones: -1 })
			expect(mid).toBeLessThan(128)
		})

		it('holds both ends of the range still', () => {
			// this is what separates it from the exposure: raising the brightness
			// drags the black point up with it, raising the midtones does not
			for (const midtones of [1, -1, 0.4]) {
				expect(run(pixel(0, 0, 0), { midtones }), String(midtones)).toEqual([0, 0, 0])
				expect(run(pixel(255, 255, 255), { midtones }), String(midtones))
					.toEqual([255, 255, 255])
			}
		})

		it('moves the midtones without the black point, unlike the exposure', () => {
			const byExposure = run(pixel(0, 0, 0), { brightness: 0.2 })[0]
			const byMidtones = run(pixel(0, 0, 0), { midtones: 0.6 })[0]

			expect(byExposure).toBeGreaterThan(0)
			expect(byMidtones).toBe(0)
		})

		it('keeps the picture the right way up', () => {
			const dark = run(pixel(60, 60, 60), { midtones: 0.5 })[0]
			const light = run(pixel(190, 190, 190), { midtones: 0.5 })[0]

			expect(light).toBeGreaterThan(dark)
		})

		it('treats every channel the same, so it shifts no colour', () => {
			const [red, green, blue] = run(pixel(120, 120, 120), { midtones: 0.7 })

			expect(red).toBe(green)
			expect(green).toBe(blue)
		})

		it('does nothing at zero', () => {
			expect(run(pixel(0, 130, 255), { midtones: 0 })).toEqual([0, 130, 255])
		})
	})

	describe('Tint', () => {
		// the other half of a white balance: the scans run from 21 counts of magenta
		// to 41 of green with no fixed relation to how warm or cold they are, so this
		// axis cannot be reached through the temperature at all
		const tintOf = ([red, green, blue]: number[]) => green - (red + blue) / 2

		it('casts towards green', () => {
			expect(tintOf(run(pixel(120, 120, 120), { tint: -100 }))).toBeGreaterThan(20)
		})

		it('casts towards magenta the other way', () => {
			expect(tintOf(run(pixel(120, 120, 120), { tint: 100 }))).toBeLessThan(-20)
		})

		it('reaches as far as the scans do', () => {
			expect(tintOf(run(pixel(120, 120, 120), { tint: -100 }))).toBeGreaterThanOrEqual(35)
			expect(tintOf(run(pixel(120, 120, 120), { tint: 100 }))).toBeLessThanOrEqual(-35)
		})

		it('moves an axis the temperature cannot', () => {
			// warming and cooling walk one line through colour space; the tint leaves
			// it, which is the whole reason for having it
			const warm = tintOf(run(pixel(120, 120, 120), { temperature: 100 }))
			const cold = tintOf(run(pixel(120, 120, 120), { temperature: -100 }))
			const green = tintOf(run(pixel(120, 120, 120), { tint: -100 }))

			expect(green).toBeGreaterThan(Math.max(warm, cold))
		})

		it('leaves the overall brightness roughly alone', () => {
			// green moves against red and blue together, so the picture shifts colour
			// rather than exposure
			const plain = run(pixel(120, 120, 120), {})
			const tinted = run(pixel(120, 120, 120), { tint: 100 })

			const luma = ([r, g, b]: number[]) => 0.2126 * r + 0.7152 * g + 0.0722 * b
			expect(Math.abs(luma(tinted) - luma(plain))).toBeLessThan(22)
		})

		it('tones a frame that has had its colour drained', () => {
			// it goes on after the saturation, like the dyes of a real stock, so a
			// monochrome frame can still be given a cast
			const [red, green, blue] = run(pixel(200, 40, 40), { saturation: -1, tint: -100 })

			expect(green).toBeGreaterThan(red)
			expect(green).toBeGreaterThan(blue)
		})

		it('does nothing at zero', () => {
			expect(run(pixel(120, 130, 140), { tint: 0 })).toEqual([120, 130, 140])
		})
	})

	describe('Lift and wash', () => {
		// the one thing that most makes a picture read as instant film: the stock
		// cannot hold a true black or a paper white
		it('lifts the blacks off zero', () => {
			expect(run(pixel(0, 0, 0), { lift: 1 })[0]).toBeGreaterThan(50)
		})

		it('pulls the whites in off paper white', () => {
			expect(run(pixel(255, 255, 255), { wash: 1 })[0]).toBeLessThan(215)
		})

		it('lands inside the range a real polaroid holds', () => {
			// scanned frames floor at 54 to 66 and ceiling around 200
			const black = run(pixel(0, 0, 0), { lift: 1 })[0]
			const white = run(pixel(255, 255, 255), { wash: 1 })[0]

			expect(black).toBeGreaterThanOrEqual(54)
			expect(black).toBeLessThanOrEqual(70)
			expect(white).toBeGreaterThanOrEqual(190)
			expect(white).toBeLessThanOrEqual(215)
		})

		it('moves each end on its own', () => {
			// the scans need combinations one control could not reach: a floor of 109
			// with a ceiling of 238, and a floor of 25 with a ceiling of 161
			const milkyBlacks = run(pixel(0, 0, 0), { lift: 1, wash: 0 })
			const fullWhites = run(pixel(255, 255, 255), { lift: 1, wash: 0 })

			expect(milkyBlacks[0]).toBeGreaterThan(50)
			expect(fullWhites[0]).toBe(255)

			const deepBlacks = run(pixel(0, 0, 0), { lift: 0, wash: 1 })
			const dullWhites = run(pixel(255, 255, 255), { lift: 0, wash: 1 })

			expect(deepBlacks[0]).toBe(0)
			expect(dullWhites[0]).toBeLessThan(215)
		})

		it('keeps the picture the right way up', () => {
			const dark = run(pixel(40, 40, 40), { lift: 1, wash: 1 })[0]
			const light = run(pixel(200, 200, 200), { lift: 1, wash: 1 })[0]

			expect(light).toBeGreaterThan(dark)
		})

		it('does nothing at zero', () => {
			expect(run(pixel(0, 130, 255), { lift: 0, wash: 0 })).toEqual([0, 130, 255])
		})

		it('scales the whole way, rather than switching on at the end', () => {
			const half = run(pixel(0, 0, 0), { lift: 0.5 })[0]
			const full = run(pixel(0, 0, 0), { lift: 1 })[0]

			expect(half).toBeGreaterThan(0)
			expect(half).toBeLessThan(full)
		})
	})

})
