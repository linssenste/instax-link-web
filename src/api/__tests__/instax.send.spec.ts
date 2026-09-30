import { describe, it, expect, vi, beforeEach } from 'vitest'
import { InstaxPrinter } from '../instax'
import { InstaxFilmVariant } from '../../interfaces/PrinterStateConfig'
import { WRITE_SIZES, INITIAL_WRITE_DELAY } from '../instax.transfer'
import { isPrintError, type InstaxPrintError } from '../instax.errors'

/** A reply the printer would send: header, length, opcode, status, checksum. */
function replyPacket(opCode: number, status = 0): DataView {
	const packet = [0x61, 0x42, 0x00, 0x09, opCode >> 8, opCode & 0xff, status, 0x00]
	const checksum = (255 - (packet.reduce((sum, byte) => sum + byte, 0) & 255)) & 255
	return new DataView(new Uint8Array([...packet, checksum]).buffer)
}

/**
 * A printer that acknowledges everything, recording what it was written.
 *
 * `acceptWrite` stands in for the link's MTU: a write longer than it is rejected
 * the way an oversized characteristic write is, and never acknowledged.
 */
function fakePrinter(options: { acceptWrite?: number, startStatus?: number } = {}) {
	const writes: Uint8Array[] = []
	let listener: ((event: Event) => void) | null = null

	const notify = {
		startNotifications: vi.fn(async () => notify),
		stopNotifications: vi.fn(async () => notify),
		addEventListener: vi.fn((_type: string, handler: (event: Event) => void) => { listener = handler }),
		removeEventListener: vi.fn(() => { listener = null })
	}

	const answer = (value: DataView) =>
		queueMicrotask(() => listener?.({ target: { value } } as unknown as Event))

	const write = {
		writeValueWithoutResponse: vi.fn(async (value: Uint8Array) => {
			if (options.acceptWrite != null && value.length > options.acceptWrite) {
				throw new Error('GATT Error: not supported.')
			}

			writes.push(value)
			// the printer replies to a complete command frame, which is what the
			// last write of each packet completes
			const opCode = (value[4] << 8) | value[5]
			if (value[0] === 0x41 && value[1] === 0x62) {
				// a printer with nothing to print on turns the transfer down here
				const status = opCode === 0x1000 ? (options.startStatus ?? 0) : 0
				answer(replyPacket(opCode, status))
			} else answer(replyPacket(0x1001))
		})
	}

	const printer = new InstaxPrinter()
	;(printer as unknown as { _characteristicRef: unknown })._characteristicRef = {
		server: null, notify, write
	}

	return { printer, writes, notify, write }
}

/** Whether a promise has settled, so a timer pump can stop once it has. */
function done(promise: Promise<unknown>): boolean {
	let settled = false
	promise.then(() => { settled = true }, () => { settled = true })
	return settled
}

const image = (bytes: number) =>
	`data:image/jpeg;base64,${btoa(String.fromCharCode(...new Uint8Array(bytes).fill(0x41)))}`

describe('sendImage', () => {
	beforeEach(() => vi.restoreAllMocks())

	it('subscribes once for the whole transfer', async () => {
		// every acknowledged write used to subscribe and unsubscribe around itself,
		// which is two GATT round trips per packet on top of the data
		const { printer, notify } = fakePrinter()

		await printer.sendImage(image(20_000), true, InstaxFilmVariant.SQUARE, () => { }, new AbortController().signal)

		expect(notify.startNotifications).toHaveBeenCalledTimes(1)
		expect(notify.stopNotifications).not.toHaveBeenCalled()
	})

	it('opens at the write size the printer was measured to take', async () => {
		// probing above 182 cost two failed transfers per connection and never once
		// succeeded, so this starts where the hardware actually is
		const { printer, writes } = fakePrinter()

		await printer.sendImage(image(20_000), true, InstaxFilmVariant.SQUARE, () => { }, new AbortController().signal)

		expect(WRITE_SIZES[0]).toBe(182)
		for (const chunk of writes) expect(chunk.length).toBeLessThanOrEqual(182)
	})

	it('does not pause after a write it is already waiting on an answer for', async () => {
		// the last write of each packet is acknowledged, which is a wait in itself,
		// so there is exactly one fewer pause per packet than there are writes
		const { printer } = fakePrinter()
		const pauses: number[] = []
		const realTimeout = globalThis.setTimeout
		const spy = vi.spyOn(globalThis, 'setTimeout').mockImplementation(((fn: () => void, ms?: number) => {
			if (ms === INITIAL_WRITE_DELAY) pauses.push(ms)
			return realTimeout(fn, ms)
		}) as typeof globalThis.setTimeout)

		try {
			await printer.sendImage(image(20_000), true, InstaxFilmVariant.SQUARE, () => { }, new AbortController().signal)
		} finally {
			spy.mockRestore()
		}

		// the writes counted here are the packet's own; the start and end commands
		// are writes too, and never paused for
		const packets = Math.ceil(20_000 / 1808)
		const perPacket = Math.ceil((1808 + 11) / WRITE_SIZES[0])

		expect(packets).toBeGreaterThan(1)
		expect(pauses).toHaveLength(packets * (perPacket - 1))
	})

	it('falls back to a smaller write when the link rejects the large one', async () => {
		// an MTU that only carries 182 byte payloads, which is the low end of what
		// turns up in the wild
		const { printer, writes } = fakePrinter({ acceptWrite: 182 })

		await printer.sendImage(image(8000), true, InstaxFilmVariant.SQUARE, () => { }, new AbortController().signal)

		for (const chunk of writes) expect(chunk.length).toBeLessThanOrEqual(182)
	})

	it('keeps the smaller write for the next image rather than retrying the large one', async () => {
		const { printer, writes } = fakePrinter({ acceptWrite: 182 })
		const signal = new AbortController().signal

		await printer.sendImage(image(4000), true, InstaxFilmVariant.SQUARE, () => { }, signal)
		const afterFirst = writes.length
		writes.length = 0

		await printer.sendImage(image(4000), true, InstaxFilmVariant.SQUARE, () => { }, signal)

		// the first image paid for the discovery; the second must not pay again
		expect(writes.length).toBeLessThanOrEqual(afterFirst)
		for (const chunk of writes) expect(chunk.length).toBeLessThanOrEqual(182)
	})

	it('reports progress that climbs to completion', async () => {
		const { printer } = fakePrinter()
		const progress: number[] = []

		await printer.sendImage(
			image(20_000), false, InstaxFilmVariant.SQUARE,
			(value) => progress.push(value), new AbortController().signal
		)

		const transfer = progress.filter((value) => value >= 0 && value <= 1)
		expect(transfer.length).toBeGreaterThan(1)
		expect(transfer).toEqual([...transfer].sort((a, b) => a - b))
		expect(transfer.at(-1)).toBeCloseTo(1, 2)
	})

	it('refuses an image the two byte length field cannot describe', async () => {
		// it used to wrap silently, and the printer would take a truncated image
		const { printer } = fakePrinter()

		await expect(
			printer.sendImage(image(70_000), true, InstaxFilmVariant.SQUARE, () => { }, new AbortController().signal)
		).rejects.toThrow(/transfer limit/)
	})

	it('gives up with a real message when the printer never answers', async () => {
		// a printer that has gone quiet does not answer the cancel either, and that
		// used to throw straight out of the retry as a bare notification timeout
		vi.useFakeTimers()

		try {
			const { printer, write } = fakePrinter()
			write.writeValueWithoutResponse.mockImplementation(async () => { /* silence */ })

			const sending = printer.sendImage(
				image(2000), true, InstaxFilmVariant.SQUARE, () => { }, new AbortController().signal
			)
			const settled = expect(sending).rejects.toThrow(/stopped responding/)

			// every retry waits out a response timeout, which is the point; there is
			// no reason for the test to wait out the same seconds in real time
			for (let step = 0; step < 200 && !done(sending); step++) {
				await vi.advanceTimersByTimeAsync(500)
			}

			await settled
		} finally {
			vi.useRealTimers()
		}
	})

	it('asks every info command and hands back untouched bytes', async () => {
		// the parser keeps a nibble of one byte and drops the status that came with
		// it, so this is the only view of what the printer actually said
		const { printer, writes } = fakePrinter()

		const readings = await printer.probe()

		expect(readings.length).toBeGreaterThan(5)
		for (const reading of readings) {
			expect(reading.opCode).toMatch(/^0x[0-9a-f]{4}$/)
			expect(typeof reading.status).toBe('number')
		}

		// nothing it sends may move film or change a setting
		const opCodes = writes.map((frame) => (frame[4] << 8) | frame[5])
		expect(opCodes).not.toContain(0x1080) // print
		expect(opCodes).not.toContain(0x1081) // eject film cover
		expect(opCodes.some((op) => op === 0x0002)).toBe(true)
	})

	it('reports a command the printer will not answer instead of giving up', async () => {
		const { printer, write } = fakePrinter()
		let answered = 0
		const real = write.writeValueWithoutResponse.getMockImplementation()!
		write.writeValueWithoutResponse.mockImplementation(async (value: Uint8Array) => {
			// the third question goes unanswered, as an unsupported one would
			if (++answered === 3) return
			return real(value)
		})

		const readings = await printer.probe()

		expect(readings.some((reading) => reading.payload === 'no answer')).toBe(true)
		expect(readings.length).toBeGreaterThan(5)
	}, 20_000)

	describe('when the printer turns the image down', () => {
		// measured: a Link printer with an empty pack answers the transfer start
		// with status 0xb4 rather than going quiet
		const REFUSED = 0xb4

		it('reports it as the printer refusing, not as a link fault', async () => {
			const { printer } = fakePrinter({ startStatus: REFUSED })

			const error = await printer.sendImage(
				image(8000), true, InstaxFilmVariant.SQUARE, () => { }, new AbortController().signal
			).catch((thrown: unknown) => thrown)

			expect(isPrintError(error)).toBe(true)
			expect((error as InstaxPrintError).reason).toBe('refused')
			expect((error as InstaxPrintError).status).toBe(REFUSED)
		})

		it('does not send the image again and again at a refusal it has understood', async () => {
			// it used to work the whole back off ladder, offering the same image to a
			// printer that had already said no, eight times over
			const { printer, writes } = fakePrinter({ startStatus: REFUSED })

			await printer.sendImage(
				image(8000), true, InstaxFilmVariant.SQUARE, () => { }, new AbortController().signal
			).catch(() => { /* expected */ })

			const starts = writes.filter((frame) => ((frame[4] << 8) | frame[5]) === 0x1000)
			expect(starts).toHaveLength(1)
		})

		it('leaves the write size alone, since the link was never the problem', async () => {
			const { printer, writes } = fakePrinter({ startStatus: REFUSED })

			await printer.sendImage(
				image(8000), true, InstaxFilmVariant.SQUARE, () => { }, new AbortController().signal
			).catch(() => { /* expected */ })
			writes.length = 0

			await printer.sendImage(
				image(8000), true, InstaxFilmVariant.SQUARE, () => { }, new AbortController().signal
			).catch(() => { /* expected */ })

			for (const chunk of writes) expect(chunk.length).toBeLessThanOrEqual(WRITE_SIZES[0])
		})
	})

	it('stops when the transfer is aborted', async () => {
		const { printer, writes } = fakePrinter()
		const controller = new AbortController()

		const sending = printer.sendImage(
			image(60_000), true, InstaxFilmVariant.SQUARE,
			() => controller.abort(), controller.signal
		)

		await sending
		expect(writes.length).toBeLessThan(Math.ceil(60_000 / 1808) * 4)
	})
})
