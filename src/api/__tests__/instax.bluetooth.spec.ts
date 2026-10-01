import { describe, it, expect, vi, afterEach } from 'vitest'
import { InstaxPrinter } from '../instax'
import { INSTAX_OPCODES } from '../events'

/** A well formed reply frame: header, length, opcode, status, command, checksum. */
function replyFor(opCode: number, status = 0, command = 0): DataView {
	const head = [0x61, 0x42, 0, 0, opCode >> 8, opCode & 0xff, status, command]
	head[3] = head.length + 1
	return new DataView(new Uint8Array([
		...head, (255 - (head.reduce((a, b) => a + b, 0) & 255)) & 255
	]).buffer)
}

/**
 * A link whose every move is under the test's control.
 *
 * `autoReply` off means notifications only arrive when the test delivers them,
 * which is what makes the reply-routing races observable rather than a matter of
 * who happens to win a microtask.
 */
function fakeLink(options: { autoReply?: boolean } = {}) {
	const { autoReply = true } = options
	const writes: Uint8Array[] = []
	let listener: ((event: Event) => void) | null = null

	const notify = {
		startNotifications: vi.fn(async () => notify),
		stopNotifications: vi.fn(async () => notify),
		addEventListener: vi.fn((_t: string, handler: (event: Event) => void) => { listener = handler }),
		removeEventListener: vi.fn(() => { listener = null })
	}

	const write = {
		writeValueWithoutResponse: vi.fn(async (value: Uint8Array) => {
			writes.push(value)
			if (autoReply) deliver((value[4] << 8) | value[5])
		})
	}

	const deliver = (opCode: number, status = 0, command = 0) =>
		listener?.({ target: { value: replyFor(opCode, status, command) } } as unknown as Event)

	const printer = new InstaxPrinter()
	;(printer as unknown as { _characteristicRef: unknown })._characteristicRef = {
		server: null, notify, write
	}

	return { printer, writes, write, notify, deliver }
}

/** Let every pending microtask run, without depending on how many there are. */
const settle = () => new Promise((resolve) => setTimeout(resolve, 0))

describe('InstaxBluetooth transport', () => {
	afterEach(() => vi.useRealTimers())

	describe('a write that fails', () => {
		it('does not steal the reply belonging to a later command', async () => {
			// the failed command used to leave its 500ms timer running, and that timer
			// cleared whichever waiter was in the slot when it fired - so the next
			// command's answer was routed nowhere and it timed out for no reason
			vi.useFakeTimers()
			const { printer, write, deliver } = fakeLink({ autoReply: false })

			write.writeValueWithoutResponse.mockRejectedValueOnce(new Error('GATT failed'))

			const failed = printer.sendCommand(INSTAX_OPCODES.SUPPORT_FUNCTION_INFO, [1])
			await expect(failed).rejects.toThrow('GATT failed')

			// the abandoned timer would come due in here
			const second = printer.sendCommand(INSTAX_OPCODES.SUPPORT_FUNCTION_INFO, [2])
			await vi.advanceTimersByTimeAsync(400)

			deliver(INSTAX_OPCODES.SUPPORT_FUNCTION_INFO, 0, 2)
			await expect(second).resolves.toBeDefined()
		})

		it('leaves no timer behind to reject into nothing', async () => {
			vi.useFakeTimers()
			const { printer, write } = fakeLink({ autoReply: false })
			const unhandled = vi.fn()
			process.on('unhandledRejection', unhandled)

			write.writeValueWithoutResponse.mockRejectedValueOnce(new Error('GATT failed'))
			await printer.sendCommand(INSTAX_OPCODES.SUPPORT_FUNCTION_INFO, [1]).catch(() => { /* expected */ })

			await vi.advanceTimersByTimeAsync(2000)
			process.off('unhandledRejection', unhandled)

			expect(unhandled).not.toHaveBeenCalled()
		})
	})

	describe('two commands at once', () => {
		it('sends the second only once the first has its answer', async () => {
			// they used to be allowed to overlap, and the loser was dropped outright:
			// in the image loop that is a slice never written and a truncated packet
			const { printer, writes, deliver } = fakeLink({ autoReply: false })

			const first = printer.sendCommand(INSTAX_OPCODES.SUPPORT_FUNCTION_INFO, [1])
			const second = printer.sendCommand(INSTAX_OPCODES.SUPPORT_FUNCTION_INFO, [2])

			// a macrotask, so every queued microtask has run: counting ticks would be
			// a hostage to how many awaits the send path happens to have
			await settle()
			expect(writes).toHaveLength(1)

			deliver(INSTAX_OPCODES.SUPPORT_FUNCTION_INFO, 0, 1)
			await first

			await settle()
			expect(writes).toHaveLength(2)

			deliver(INSTAX_OPCODES.SUPPORT_FUNCTION_INFO, 0, 2)
			await expect(second).resolves.toBeDefined()
		})

		it('never drops a command on the floor', async () => {
			const { printer, writes } = fakeLink()

			await Promise.all([
				printer.sendCommand(INSTAX_OPCODES.SUPPORT_FUNCTION_INFO, [0]),
				printer.sendCommand(INSTAX_OPCODES.SUPPORT_FUNCTION_INFO, [1]),
				printer.sendCommand(INSTAX_OPCODES.SUPPORT_FUNCTION_INFO, [2])
			])

			// all three reached the characteristic, in order
			expect(writes).toHaveLength(3)
			expect(writes.map((frame) => frame[6])).toEqual([0, 1, 2])
		})

		it('keeps serving later commands after one of them fails', async () => {
			const { printer, writes, write } = fakeLink()
			write.writeValueWithoutResponse.mockRejectedValueOnce(new Error('GATT failed'))

			await printer.sendCommand(INSTAX_OPCODES.SUPPORT_FUNCTION_INFO, [0]).catch(() => { /* expected */ })
			await printer.sendCommand(INSTAX_OPCODES.SUPPORT_FUNCTION_INFO, [1])

			expect(writes.length).toBeGreaterThanOrEqual(1)
		})
	})

	describe('when there is no connection', () => {
		it('says so rather than failing on a null characteristic', async () => {
			// the disconnect handler nulls these, so `write!` was a TypeError waiting
			// to happen, and it arrived with no indication that the link was gone
			const { printer } = fakeLink()
			;(printer as unknown as { _characteristicRef: { write: null } })._characteristicRef.write = null

			await expect(printer.sendCommand(INSTAX_OPCODES.SUPPORT_FUNCTION_INFO, [1]))
				.rejects.toThrow(/Not connected/)
		})

		it('says so for a command that wants no answer either', async () => {
			const { printer } = fakeLink()
			;(printer as unknown as { _characteristicRef: { write: null } })._characteristicRef.write = null

			await expect(printer.setColor(['#ffffff'])).rejects.toThrow(/Not connected/)
		})
	})

	describe('notifications', () => {
		it('subscribes once however many commands are sent', async () => {
			const { printer, notify } = fakeLink()

			for (let attempt = 0; attempt < 5; attempt++) {
				await printer.sendCommand(INSTAX_OPCODES.SUPPORT_FUNCTION_INFO, [1])
			}

			expect(notify.startNotifications).toHaveBeenCalledTimes(1)
		})

		it('times out rather than waiting for ever on a silent printer', async () => {
			vi.useFakeTimers()
			const { printer } = fakeLink({ autoReply: false })

			const pending = printer.sendCommand(INSTAX_OPCODES.SUPPORT_FUNCTION_INFO, [1])
			const settled = expect(pending).rejects.toThrow(/timeout/i)
			await vi.advanceTimersByTimeAsync(1000)

			await settled
		})
	})
})
