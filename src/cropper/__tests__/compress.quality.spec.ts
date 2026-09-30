import { describe, it, expect, vi } from 'vitest'
import {
	encodeWithinBudget, TARGET_QUALITY, MIN_QUALITY, MAX_ATTEMPTS
} from '../compress.quality'

const BUDGET = 1024 * 60

/**
 * Stand-in for the encoder, sized the way a JPEG is: smooth, monotone and steep
 * towards the top of the quality range. `weight` is how much detail the image has,
 * which is what decides whether the budget binds at all.
 */
const encoder = (weight: number, exponent = 4) => {
	const sizeFor = (quality: number) => Math.round(weight * Math.pow(quality, exponent))
	return Object.assign(
		vi.fn(async (quality: number) => ({ size: sizeFor(quality) }) as Blob),
		{ sizeFor }
	)
}

const qualities = (encode: { mock: { calls: number[][] } }) => encode.mock.calls.map(([q]) => q)

describe('encodeWithinBudget', () => {
	describe('when the image already fits', () => {
		it('sends it at target quality after a single encode', async () => {
			// a photo that is visually transparent well under the budget used to be
			// pushed up to fill it, and those bytes are pure time on the wire
			const encode = encoder(60_000)
			const result = await encodeWithinBudget(encode, BUDGET)

			expect(result?.quality).toBe(TARGET_QUALITY)
			expect(result?.attempts).toBe(1)
			expect(encode).toHaveBeenCalledTimes(1)
		})

		it('does not spend the budget it did not need', async () => {
			const encode = encoder(60_000)
			const result = await encodeWithinBudget(encode, BUDGET)

			expect(result!.blob.size).toBeLessThan(BUDGET * 0.75)
		})

		it('ignores a hint from a harder image before it', async () => {
			// the previous image needing q0.4 must not cost this one any quality
			const encode = encoder(60_000)
			const result = await encodeWithinBudget(encode, BUDGET, 0.4)

			expect(result?.quality).toBe(TARGET_QUALITY)
			expect(encode).toHaveBeenCalledTimes(1)
		})
	})

	describe('when the budget binds', () => {
		it('lands just under the budget, not over it', async () => {
			const encode = encoder(400_000)
			const result = await encodeWithinBudget(encode, BUDGET)

			expect(result).not.toBeNull()
			expect(result!.blob.size).toBeLessThanOrEqual(BUDGET)
			expect(result!.blob.size).toBeGreaterThan(BUDGET * 0.9)
		})

		it('gets there in fewer encodes than bisecting would', async () => {
			// the binary search this replaces took six encodes to close the interval
			const encode = encoder(400_000)
			const result = await encodeWithinBudget(encode, BUDGET)

			expect(result!.attempts).toBeLessThanOrEqual(3)
		})

		it('never encodes above the target quality', async () => {
			const encode = encoder(400_000)
			await encodeWithinBudget(encode, BUDGET)

			for (const quality of qualities(encode)) expect(quality).toBeLessThanOrEqual(TARGET_QUALITY)
		})

		it('opens the search at the quality the last image needed', async () => {
			const encode = encoder(400_000)
			await encodeWithinBudget(encode, BUDGET, 0.55)

			expect(qualities(encode).slice(0, 2)).toEqual([TARGET_QUALITY, 0.55])
		})

		it('holds to the budget across a range of image weights', async () => {
			for (const weight of [90_000, 150_000, 400_000, 900_000, 2_000_000]) {
				const encode = encoder(weight)
				const result = await encodeWithinBudget(encode, BUDGET)

				expect(result!.blob.size).toBeLessThanOrEqual(BUDGET)
				expect(result!.attempts).toBeLessThanOrEqual(MAX_ATTEMPTS)
			}
		})

		it('copes with a curve far steeper than it assumes', async () => {
			// the assumed exponent only seeds the first step; the fit takes over
			const encode = encoder(3_000_000, 9)
			const result = await encodeWithinBudget(encode, BUDGET)

			expect(result!.blob.size).toBeLessThanOrEqual(BUDGET)
		})

		it('copes with a curve far shallower than it assumes', async () => {
			const encode = encoder(200_000, 1.5)
			const result = await encodeWithinBudget(encode, BUDGET)

			expect(result!.blob.size).toBeLessThanOrEqual(BUDGET)
		})
	})

	describe('when nothing fits', () => {
		it('reports no result rather than a file the printer would reject', async () => {
			// the transfer packs the length into a uint16, so an overshoot is not
			// something to wave through on a tolerance
			const encode = encoder(80_000_000)

			await expect(encodeWithinBudget(encode, BUDGET)).resolves.toBeNull()
		})

		it('spends its last encode on the lowest quality rather than another guess', async () => {
			const encode = encoder(80_000_000)
			await encodeWithinBudget(encode, BUDGET)

			expect(qualities(encode).at(-1)).toBe(MIN_QUALITY)
		})

		it('still takes an image that only the lowest quality fits', async () => {
			// weight chosen so it fits at MIN_QUALITY and nowhere above it
			const weight = Math.floor(BUDGET / Math.pow(MIN_QUALITY, 4)) - 1
			const encode = encoder(weight)
			const result = await encodeWithinBudget(encode, BUDGET)

			expect(result?.quality).toBe(MIN_QUALITY)
			expect(result!.blob.size).toBeLessThanOrEqual(BUDGET)
		})
	})

	it('never runs away, whatever the encoder reports', async () => {
		const encode = vi.fn(async () => ({ size: BUDGET + 1 }) as Blob)
		await encodeWithinBudget(encode, BUDGET)

		expect(encode.mock.calls.length).toBeLessThanOrEqual(MAX_ATTEMPTS + 1)
	})
})
