import { describe, it, expect } from 'vitest'
import {
	TransferTuning, writeStride, WRITE_SIZES,
	INITIAL_WRITE_DELAY, MIN_WRITE_DELAY, MAX_WRITE_DELAY
} from '../instax.transfer'

describe('writeStride', () => {
	it('splits a packet into as few writes as the link allows', () => {
		// a square packet is 1819 bytes; at 512 that is four writes, not ten
		expect(Math.ceil(1819 / writeStride(1819, 512))).toBe(4)
		expect(Math.ceil(911 / writeStride(911, 512))).toBe(2)
	})

	it('never exceeds the write size it is given', () => {
		for (const total of [911, 1819, 20, 513, 1024]) {
			for (const max of WRITE_SIZES) expect(writeStride(total, max)).toBeLessThanOrEqual(max)
		}
	})

	it('covers the whole packet', () => {
		for (const total of [911, 1819, 1, 182, 183]) {
			for (const max of WRITE_SIZES) {
				const stride = writeStride(total, max)
				expect(Math.ceil(total / stride) * stride).toBeGreaterThanOrEqual(total)
			}
		}
	})

	it('does not leave a single byte trailing write', () => {
		// 911 bytes cut at a fixed stride of 182 ended in a write of one byte, a
		// whole round trip and its pause for one byte, once per packet
		const stride = writeStride(911, 182)
		const writes = Math.ceil(911 / stride)

		expect(911 - (writes - 1) * stride).toBeGreaterThan(1)
		expect(writes).toBe(6)
	})

	it('spreads evenly rather than front loading', () => {
		const stride = writeStride(1819, 512)

		expect(stride).toBe(455)
		expect(1819 - 3 * 455).toBeGreaterThan(1)
	})

	it('holds up for degenerate sizes', () => {
		expect(writeStride(0, 182)).toBe(1)
		expect(writeStride(100, 0)).toBe(100)
	})
})

describe('TransferTuning', () => {
	it('starts optimistic, at the largest write', () => {
		const tuning = new TransferTuning()

		expect(tuning.writeSize).toBe(WRITE_SIZES[0])
		expect(tuning.writeDelay).toBe(INITIAL_WRITE_DELAY)
	})

	it('tries a smaller write before it slows down', () => {
		// an oversized write is the one thing here that fails outright rather than
		// merely too fast, so it is the first thing to give up
		const tuning = new TransferTuning()
		tuning.backOff()

		expect(tuning.writeSize).toBe(WRITE_SIZES[1])
		expect(tuning.writeDelay).toBe(INITIAL_WRITE_DELAY)
	})

	it('works down every write size it knows', () => {
		const tuning = new TransferTuning()

		for (let step = 1; step < WRITE_SIZES.length; step++) {
			expect(tuning.backOff()).toBe(true)
			expect(tuning.writeSize).toBe(WRITE_SIZES[step])
		}
	})

	it('only lengthens the pause once no smaller write is left', () => {
		const tuning = new TransferTuning()
		for (let step = 1; step < WRITE_SIZES.length; step++) tuning.backOff()

		tuning.backOff()

		expect(tuning.writeSize).toBe(WRITE_SIZES.at(-1))
		expect(tuning.writeDelay).toBeGreaterThan(INITIAL_WRITE_DELAY)
	})

	it('gives up rather than retrying forever', () => {
		const tuning = new TransferTuning()

		let attempts = 0
		while (tuning.backOff()) {
			attempts++
			expect(attempts).toBeLessThan(100)
		}

		expect(tuning.writeDelay).toBeGreaterThan(MAX_WRITE_DELAY)
	})

	it('eases the pause back on a clean transfer', () => {
		const tuning = new TransferTuning()
		tuning.succeeded()

		expect(tuning.writeDelay).toBeLessThan(INITIAL_WRITE_DELAY)
	})

	it('never eases below the floor, however many prints go through', () => {
		const tuning = new TransferTuning()
		for (let print = 0; print < 50; print++) tuning.succeeded()

		expect(tuning.writeDelay).toBe(MIN_WRITE_DELAY)
	})

	it('keeps what a failure taught it when the next transfer succeeds', () => {
		// the write size was reset per transfer before, so a printer that needed a
		// smaller write was rediscovered, and retried against, on every image
		const tuning = new TransferTuning()
		tuning.backOff()
		tuning.succeeded()

		expect(tuning.writeSize).toBe(WRITE_SIZES[1])
	})
})
