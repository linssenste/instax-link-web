import { describe, it, expect, vi, afterEach } from 'vitest'
import { InstaxPrinter } from '../instax'
import { InstaxPrintError, isPrintError } from '../instax.errors'

/**
 * A printer that answers the print command and reports a film count.
 *
 * `filmCount` is what it claims is left, and it only goes down when `feeds` is
 * true - which is the whole point: a pack that has been reseated while empty
 * reports a full count and then never uses a sheet.
 */
function fakePrinter(options: {
	printStatus?: number
	filmCount?: number
	feeds?: boolean
	volunteers?: { status: number } | null
} = {}) {
	const { printStatus = 0, feeds = true, volunteers = null } = options
	let filmCount = options.filmCount ?? 7
	let listener: ((event: Event) => void) | null = null

	// the printer echoes the command it is answering, and the parser switches on it
	const packet = (op: number, status: number, command = 0, payload: number[] = []) => {
		const head = [0x61, 0x42, 0, 0, op >> 8, op & 0xff, status, command, ...payload]
		head[3] = head.length + 1
		return new DataView(new Uint8Array([
			...head, (255 - (head.reduce((a, b) => a + b, 0) & 255)) & 255
		]).buffer)
	}

	const notify = {
		startNotifications: vi.fn(async () => notify),
		stopNotifications: vi.fn(),
		addEventListener: vi.fn((_t: string, handler: (event: Event) => void) => { listener = handler }),
		removeEventListener: vi.fn(() => { listener = null })
	}

	const emit = (value: DataView) => queueMicrotask(() => listener?.({ target: { value } } as never))

	const write = {
		writeValueWithoutResponse: vi.fn(async (value: Uint8Array) => {
			const op = (value[4] << 8) | value[5]

			if (op === 0x0002 && value[6] === 2) return emit(packet(op, 0, 2, [filmCount & 15]))

			if (op === 0x1080) {
				if (printStatus === 0 && feeds) filmCount = Math.max(0, filmCount - 1)
				emit(packet(op, printStatus))
				// whatever the printer volunteers, it does so after it has answered
				if (volunteers != null) setTimeout(() => emit(packet(0x1080, volunteers.status)), 5)
				return
			}

			return emit(packet(op, 0))
		})
	}

	const printer = new InstaxPrinter()
	;(printer as unknown as { _characteristicRef: unknown })._characteristicRef = { server: null, notify, write }

	return { printer, filmCountNow: () => filmCount }
}

/** printImage waits out the print; the test has no reason to wait with it */
async function runPrint(run: () => Promise<unknown>) {
	vi.useFakeTimers()
	try {
		let settled = false
		const pending = run().finally(() => { settled = true })
		const caught = pending.catch((error: unknown) => error)

		for (let step = 0; step < 400 && !settled; step++) await vi.advanceTimersByTimeAsync(500)

		return await caught
	} finally {
		vi.useRealTimers()
	}
}

describe('printImage failure detection', () => {
	afterEach(() => vi.useRealTimers())

	it('reports a print that used no film, however healthy the answers were', async () => {
		// the printer takes the command, answers 0, and never feeds - which is what
		// an empty pack behind a counter that was reset by reseating it looks like
		const { printer } = fakePrinter({ filmCount: 7, feeds: false })

		const error = await runPrint(() =>
			printer.printImage(1, () => { }, new AbortController().signal)
		)

		expect(isPrintError(error)).toBe(true)
		expect((error as InstaxPrintError).reason).toBe('not-printed')
		expect((error as InstaxPrintError).message).toContain('7')
	})

	it('does not cry off a print that did come out', async () => {
		const { printer, filmCountNow } = fakePrinter({ filmCount: 7, feeds: true })
		const printed: number[] = []

		const result = await runPrint(() =>
			printer.printImage(1, (id) => printed.push(id), new AbortController().signal)
		)

		expect(isPrintError(result)).toBe(false)
		expect(printed).toEqual([1])
		expect(filmCountNow()).toBe(6)
	})

	it('reports a print the printer turned down', async () => {
		const { printer } = fakePrinter({ printStatus: 0x05 })

		const error = await runPrint(() =>
			printer.printImage(1, () => { }, new AbortController().signal)
		)

		expect((error as InstaxPrintError).reason).toBe('refused')
		expect((error as InstaxPrintError).status).toBe(0x05)
	})

	it('reports a fault the printer volunteers while printing', async () => {
		// these packets used to land between two writes' subscriptions and be lost
		const { printer } = fakePrinter({ volunteers: { status: 0x09 } })

		const error = await runPrint(() =>
			printer.printImage(1, () => { }, new AbortController().signal)
		)

		expect((error as InstaxPrintError).reason).toBe('reported')
		expect((error as InstaxPrintError).status).toBe(0x09)
	})

	it('is not startled by the printer talking normally while it prints', async () => {
		const { printer } = fakePrinter({ volunteers: { status: 0 } })

		const result = await runPrint(() =>
			printer.printImage(1, () => { }, new AbortController().signal)
		)

		expect(isPrintError(result)).toBe(false)
	})

	it('carries the bytes so an unrecognised fault is still reportable', async () => {
		const { printer } = fakePrinter({ printStatus: 0x42 })

		const error = await runPrint(() =>
			printer.printImage(1, () => { }, new AbortController().signal)
		)

		expect((error as InstaxPrintError).detail).toContain('status 0x42')
		expect((error as InstaxPrintError).detail).toContain('refused')
	})

	it('stops at the first copy that fails rather than working through the rest', async () => {
		const { printer } = fakePrinter({ filmCount: 7, feeds: false })
		const printed: number[] = []

		await runPrint(() =>
			printer.printImage(5, (id) => printed.push(id), new AbortController().signal)
		)

		expect(printed).toEqual([])
	})
})
