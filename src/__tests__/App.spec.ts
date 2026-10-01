import { mount, flushPromises, type VueWrapper } from '@vue/test-utils'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

import { InstaxPrintError } from '../api/instax.errors'
import { InstaxFilmVariant } from '../interfaces/PrinterStateConfig'
import { QUEUE_STATE, MAX_QUEUE_LENGTH, type QueueImage } from '../interfaces/QueueImage'
import type { PrinterStateConfig } from '../interfaces/PrinterStateConfig'

/**
 * The printer, stood in for.
 *
 * App drives the queue off a two second poll, so the interesting behaviour is
 * not in any one call but in what the poll does next - which is only reachable
 * by running the real component against a printer that can be told how to fail.
 */
const printer = vi.hoisted(() => ({
	connect: vi.fn(),
	disconnect: vi.fn(),
	getInformation: vi.fn(),
	sendImage: vi.fn(),
	printImage: vi.fn(),
	setColor: vi.fn()
}))

vi.mock('../api/instax', () => ({ InstaxPrinter: vi.fn(() => printer) }))
vi.mock('konva', async () => ({ default: (await import('../components/__tests__/polaroid/konva.mock')).konvaMock }))

const { downloadDataUrl } = vi.hoisted(() => ({ downloadDataUrl: vi.fn() }))
vi.mock('../cropper/cropper.download', async (importOriginal) => ({
	...(await importOriginal<typeof import('../cropper/cropper.download')>()),
	downloadDataUrl
}))

import App from '../App.vue'

// the editor and the panels are exercised by their own specs; here they are only
// the surfaces the app is driven through
const EditorStub = { props: ['config', 'queueLength'], emits: ['image'], template: '<div class="editor-stub" />' }
const PanelStub = { props: ['queue', 'config'], template: '<div class="panel-stub" />' }
const PlainStub = { template: '<div />' }

describe('App print queue', () => {
	let wrapper: VueWrapper

	const mountApp = () => {
		wrapper = mount(App, {
			attachTo: document.body,
			global: {
				stubs: {
					teleport: true,
					PolaroidEditor: EditorStub,
					PrinterConnection: PanelStub,
					MobileOverlay: PanelStub,
					ThemeColorSelector: PlainStub,
					PolaroidSizeSelector: PlainStub
				}
			}
		})
		return wrapper
	}

	/** The live queue, read off the panel the app hands it to. */
	const queue = (): QueueImage[] => wrapper.findComponent(PanelStub).props('queue') as QueueImage[]
	const appConfig = (): PrinterStateConfig => wrapper.findComponent(PanelStub).props('config') as PrinterStateConfig

	/** Run the clock on, letting each timer's promises settle before the next. */
	const settle = async (ms = 6000) => {
		for (let step = 0; step < 24; step++) {
			await vi.advanceTimersByTimeAsync(ms / 24)
			await flushPromises()
		}
	}

	const connect = async () => {
		// connect waits on timers of its own, so the clock has to run while it does
		const pending = appConfig().connect()
		await settle(3000)
		await pending
	}

	const queueImage = async () => {
		wrapper.findComponent(EditorStub).vm.$emit('image', {
			src: 'data:image/jpeg;base64,photo',
			download: false,
			caption: 'holiday',
			type: InstaxFilmVariant.SQUARE
		})
		await flushPromises()
	}

	beforeEach(() => {
		vi.useFakeTimers()
		for (const call of Object.values(printer)) call.mockReset()

		printer.connect.mockResolvedValue({ addEventListener: vi.fn() })
		printer.getInformation.mockResolvedValue({
			battery: { charging: false, level: 80 },
			polaroidCount: 7,
			type: InstaxFilmVariant.SQUARE,
			filmState: '0,0,12,0,0,0,0'
		})
		printer.sendImage.mockResolvedValue(undefined)
		printer.printImage.mockResolvedValue(undefined)
		printer.disconnect.mockResolvedValue(undefined)
		downloadDataUrl.mockClear()
	})

	afterEach(() => {
		wrapper?.unmount()
		vi.useRealTimers()
	})

	it('prints a queued photo once the poll comes round', async () => {
		mountApp()
		await connect()
		await queueImage()

		expect(queue()).toHaveLength(1)

		await settle()

		expect(printer.sendImage).toHaveBeenCalledTimes(1)
		expect(printer.printImage).toHaveBeenCalledTimes(1)
		expect(queue()).toHaveLength(0)
	})

	const failWith = (reason = 'not-printed' as const) =>
		printer.printImage.mockRejectedValue(
			new InstaxPrintError(reason, 'the printer used no film', 0x09, [0x01])
		)

	describe('when the print fails', () => {

		const failedRun = async () => {
			failWith()
			mountApp()
			await connect()
			await queueImage()
			await settle()
		}

		it('keeps the photo on the queue', async () => {
			await failedRun()

			expect(queue()).toHaveLength(1)
		})

		it('marks it failed rather than queued, so the poll leaves it alone', async () => {
			await failedRun()

			expect(queue()[0].state).toBe(QUEUE_STATE.FAILED)
		})

		it('does not quietly print it again and again behind the dialog', async () => {
			// the photo used to go back to QUEUED, and the two second poll picked it
			// straight back up: it reprinted on a loop and was eventually dropped
			await failedRun()

			expect(printer.sendImage).toHaveBeenCalledTimes(1)

			await settle(20_000)

			expect(printer.sendImage).toHaveBeenCalledTimes(1)
			expect(printer.printImage).toHaveBeenCalledTimes(1)
			expect(queue()).toHaveLength(1)
		})

		it('tells the user, with what the printer said', async () => {
			await failedRun()

			const dialog = wrapper.find('[data-testid="print-error-dialog"]')
			expect(dialog.exists()).toBe(true)
			expect(dialog.text()).toContain('status 0x09')
		})

		it('keeps the photo when the dialog is merely dismissed', async () => {
			await failedRun()

			await wrapper.find('[data-testid="print-error-dialog-close"]').trigger('click')
			await settle()

			expect(wrapper.find('[data-testid="print-error-dialog"]').exists()).toBe(false)
			expect(queue()).toHaveLength(1)
			expect(queue()[0].state).toBe(QUEUE_STATE.FAILED)
		})

		it('takes it off the queue only when that is asked for', async () => {
			await failedRun()

			await wrapper.find('[data-testid="print-error-discard"]').trigger('click')
			await flushPromises()

			expect(queue()).toHaveLength(0)
			expect(wrapper.find('[data-testid="print-error-dialog"]').exists()).toBe(false)
		})

		it('shows the dialog again when the retry fails too', async () => {
			// the reported case: retry, it fails, and the photo vanished with nothing
			// said, because the transfer threw a plain Error the app did not know
			await failedRun()

			await wrapper.find('[data-testid="print-error-retry"]').trigger('click')
			await settle()

			expect(wrapper.find('[data-testid="print-error-dialog"]').exists()).toBe(true)
			expect(queue()).toHaveLength(1)
			expect(queue()[0].state).toBe(QUEUE_STATE.FAILED)
		})

		it('keeps the photo when the failure comes from the transfer rather than the print', async () => {
			// an empty pack turns the transfer down before printing is reached
			printer.sendImage.mockRejectedValue(
				new InstaxPrintError('refused', 'the printer would not accept it', 0xb4)
			)
			mountApp()
			await connect()
			await queueImage()
			await settle()

			const dialog = wrapper.find('[data-testid="print-error-dialog"]')
			expect(dialog.exists()).toBe(true)
			expect(dialog.text()).toContain('status 0xb4')
			expect(queue()).toHaveLength(1)
			expect(queue()[0].state).toBe(QUEUE_STATE.FAILED)
		})

		it('says so rather than quietly doing nothing when there is no film to retry with', async () => {
			await failedRun()

			printer.getInformation.mockResolvedValue({
				battery: { charging: false, level: 80 }, polaroidCount: 0,
				type: InstaxFilmVariant.SQUARE, filmState: '0,0,12,0,0,0,0'
			})
			await wrapper.find('[data-testid="print-error-retry"]').trigger('click')
			await settle()

			expect(wrapper.find('[data-testid="print-error-dialog"]').exists()).toBe(true)
			expect(queue()).toHaveLength(1)
		})

		describe('and the film is then dealt with', () => {
			const newPack = () => printer.getInformation.mockResolvedValue({
				battery: { charging: false, level: 80 }, polaroidCount: 10,
				type: InstaxFilmVariant.SQUARE, filmState: '244,240,12,0,0,0,16'
			})

			it('picks the photo back up on its own', async () => {
				await failedRun()
				printer.printImage.mockResolvedValue(undefined)

				newPack()
				await settle(8000)

				expect(printer.printImage).toHaveBeenCalledTimes(2)
				expect(queue()).toHaveLength(0)
			})

			it('puts the dialog away when it does', async () => {
				await failedRun()
				printer.printImage.mockResolvedValue(undefined)

				newPack()
				await settle(8000)

				expect(wrapper.find('[data-testid="print-error-dialog"]').exists()).toBe(false)
			})

			it('waits while nothing about the film has changed', async () => {
				// the reading is the whole signal: without a change this must stay put
				// rather than drift back into reprinting on a loop
				await failedRun()

				await settle(20_000)

				expect(printer.printImage).toHaveBeenCalledTimes(1)
				expect(queue()[0].state).toBe(QUEUE_STATE.FAILED)
			})

			it('does not resume into a printer that is still reporting no film', async () => {
				await failedRun()

				printer.getInformation.mockResolvedValue({
					battery: { charging: false, level: 80 }, polaroidCount: 0,
					type: InstaxFilmVariant.SQUARE, filmState: '1,2,12,0,0,0,0'
				})
				await settle(8000)

				expect(queue()[0].state).toBe(QUEUE_STATE.FAILED)
			})

			it('does not loop when the fresh pack fails too', async () => {
				await failedRun()

				newPack()
				await settle(20_000)

				// one more attempt against the new reading, and then it waits again
				expect(printer.printImage).toHaveBeenCalledTimes(2)
				expect(queue()).toHaveLength(1)
			})
		})

		it('prints it after all when the film is sorted and it is retried', async () => {
			await failedRun()

			printer.printImage.mockResolvedValue(undefined)
			await wrapper.find('[data-testid="print-error-retry"]').trigger('click')
			await settle()

			expect(printer.printImage).toHaveBeenCalledTimes(2)
			expect(queue()).toHaveLength(0)
		})

		it('does not strand a second photo behind the failed one', async () => {
			await failedRun()
			await queueImage()
			await settle(20_000)

			// the failed photo holds the head of the queue on purpose, so nothing
			// behind it may be printed out of order either
			expect(queue()).toHaveLength(2)
			expect(printer.sendImage).toHaveBeenCalledTimes(1)
		})
	})

	describe('the dialog can be asked for while developing', () => {
		type Show = (reason?: string | null, status?: number) => void
		const show = () => (window as unknown as { printError: Show }).printError

		it('shows the failure dialog on request, without a printer at all', async () => {
			mountApp()

			show()('reported', 0x2a)
			await flushPromises()

			const dialog = wrapper.find('[data-testid="print-error-dialog"]')
			expect(dialog.exists()).toBe(true)
			expect(dialog.text()).toContain('status 0x2a')
		})

		it('shows each way a print can fail', async () => {
			mountApp()

			for (const reason of ['not-printed', 'reported', 'refused', 'silent']) {
				show()(reason)
				await flushPromises()
				expect(wrapper.find('[data-testid="print-error-dialog"]').exists()).toBe(true)
			}
		})

		it('puts it away again', async () => {
			mountApp()

			show()()
			await flushPromises()
			show()(null)
			await flushPromises()

			expect(wrapper.find('[data-testid="print-error-dialog"]').exists()).toBe(false)
		})

		it('leaves the queue alone when its buttons are used with nothing queued', async () => {
			mountApp()

			show()()
			await flushPromises()
			await wrapper.find('[data-testid="print-error-discard"]').trigger('click')
			await settle()

			expect(queue()).toHaveLength(0)
		})
	})

	describe('taking a photo off the queue', () => {
		const cancel = (id: number) => wrapper.findComponent(PanelStub).vm.$emit('cancel', id)

		it('removes a queued photo the user gives up on', async () => {
			// the handler only ever called abort() on the head, and never removed
			// anything, so the x button did nothing at all
			mountApp()
			await connect()
			printer.sendImage.mockImplementation(() => new Promise(() => { }))
			await queueImage()
			await queueImage()

			cancel(queue()[1].id)
			await flushPromises()

			expect(queue()).toHaveLength(1)
		})

		it('removes one that is not at the head', async () => {
			mountApp()
			await connect()
			printer.sendImage.mockImplementation(() => new Promise(() => { }))
			await queueImage()
			await queueImage()
			await queueImage()

			const middle = queue()[1].id
			cancel(middle)
			await flushPromises()

			expect(queue().map((photo) => photo.id)).not.toContain(middle)
			expect(queue()).toHaveLength(2)
		})

		it('removes a failed photo, so it cannot jam the queue', async () => {
			// the queue is worked from the head, so a failed photo nothing can remove
			// blocks every photo behind it for the life of the page
			failWith()
			mountApp()
			await connect()
			await queueImage()
			await settle()

			cancel(queue()[0].id)
			await flushPromises()

			expect(queue()).toHaveLength(0)
		})

		it('stops a transfer that is running rather than orphaning the printer', async () => {
			let abortSeen = false
			printer.sendImage.mockImplementation((...args: unknown[]) => new Promise((resolve) => {
				const signal = args[4] as AbortSignal
				signal.addEventListener('abort', () => { abortSeen = true; resolve(undefined) })
			}))

			mountApp()
			await connect()
			await queueImage()
			await settle()

			cancel(queue()[0].id)
			await settle()

			expect(abortSeen).toBe(true)
		})

		it('takes the photo that printed, not whichever has moved up since', async () => {
			// finishUpPrinting used to shift() position 0 after a 500ms wait, so a
			// removal during that wait deleted the next, unprinted photo instead
			mountApp()
			await connect()
			await queueImage()
			await queueImage()
			// each photo costs a poll tick plus its own sleeps, so two need room
			await settle(16_000)

			// both are gone only if each run removed its own photo
			expect(queue()).toHaveLength(0)
			expect(printer.printImage).toHaveBeenCalledTimes(2)
		})
	})

	describe('copies', () => {
		it('never prints zero copies and loses the photo', async () => {
			// a quantity of 0 transferred the image, printed nothing, said nothing,
			// and then dropped the photo off the queue as though it had printed
			mountApp()
			await connect()
			printer.sendImage.mockImplementation(() => new Promise(() => { }))
			await queueImage()

			wrapper.findComponent(PanelStub).vm.$emit('quantity-change', queue()[0].id, 0)
			await flushPromises()

			expect(queue()[0].quantity).toBe(1)
		})

		it('holds the copies to what the printer accepts', async () => {
			mountApp()
			await connect()
			printer.sendImage.mockImplementation(() => new Promise(() => { }))
			await queueImage()

			const id = queue()[0].id
			for (const [asked, expected] of [[0, 1], [-3, 1], [99, 10], [4, 4]]) {
				wrapper.findComponent(PanelStub).vm.$emit('quantity-change', id, asked)
				await flushPromises()
				expect(queue()[0].quantity).toBe(expected)
			}
		})

		it('prints at least one copy even if the field was left empty', async () => {
			mountApp()
			await connect()
			await queueImage()

			wrapper.findComponent(PanelStub).vm.$emit('quantity-change', queue()[0].id, Number(''))
			await settle()

			expect(printer.printImage).toHaveBeenCalledWith(1, expect.any(Function), expect.any(Object))
		})
	})

	it('keeps the photo when the failure is not one it recognises', async () => {
		// a printer switched off mid-print throws a plain Error, and that used to
		// fall through to the queue being shifted with nothing said at all
		printer.printImage.mockRejectedValue(new Error('NetworkError: GATT operation failed'))
		mountApp()
		await connect()
		await queueImage()
		await settle()

		expect(queue()).toHaveLength(1)
		expect(queue()[0].state).toBe(QUEUE_STATE.FAILED)
		expect(wrapper.find('[data-testid="print-error-dialog"]').exists()).toBe(true)
	})

	it('takes no more photos than the queue is allowed to hold', async () => {
		mountApp()
		await connect()

		// nothing is printed while the poll is held off, so they pile up
		printer.sendImage.mockImplementation(() => new Promise(() => { }))
		for (let attempt = 0; attempt < MAX_QUEUE_LENGTH + 3; attempt++) await queueImage()

		expect(queue()).toHaveLength(MAX_QUEUE_LENGTH)
	})

	it('still downloads rather than queues when there is no printer', async () => {
		mountApp()

		wrapper.findComponent(EditorStub).vm.$emit('image', {
			src: 'data:image/png;base64,keepsake', download: true, caption: 'x', type: InstaxFilmVariant.SQUARE
		})
		await flushPromises()

		expect(downloadDataUrl).toHaveBeenCalled()
		expect(queue()).toHaveLength(0)
	})
})
