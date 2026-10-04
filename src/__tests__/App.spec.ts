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

vi.mock('../api/instax', () => ({ InstaxPrinter: vi.fn(() => printer), PRINT_DURATION: 15000 }))

const { loadQueue, saveQueue } = vi.hoisted(() => ({
	loadQueue: vi.fn(async () => [] as unknown[]),
	saveQueue: vi.fn(async () => { })
}))
vi.mock('../queue/queue.storage', () => ({ loadQueue, saveQueue }))
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

	/**
	 * A distinct photo each time, as a changed editor produces.
	 *
	 * The print image is a deterministic render, so an identical one means nothing
	 * was changed and the app counts it as another copy rather than another card -
	 * which is what `queueSameImage` below exercises.
	 */
	let rendered = 0
	const queueImage = async () => {
		wrapper.findComponent(EditorStub).vm.$emit('image', {
			src: `data:image/jpeg;base64,photo${++rendered}`,
			download: false,
			caption: 'holiday',
			type: InstaxFilmVariant.SQUARE
		})
		await flushPromises()
	}

	const queueSameImage = async () => {
		wrapper.findComponent(EditorStub).vm.$emit('image', {
			src: 'data:image/jpeg;base64,unchanged',
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
		rendered = 0
		loadQueue.mockClear()
		loadQueue.mockResolvedValue([])
		saveQueue.mockClear()
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

	/** Queue one photo and let it fail at the print command. */
	const failedRun = async () => {
		failWith()
		mountApp()
		await connect()
		await queueImage()
		await settle()
	}

	describe('a printer that takes different film', () => {
		/** Three square photos waiting, then a mini printer turns up. */
		const squareQueueOnMiniPrinter = async () => {
			loadQueue.mockResolvedValue([1, 2, 3].map((id) => ({
				id,
				base64: `data:image/jpeg;base64,saved${id}`,
				thumbnail: 'data:image/jpeg;base64,thumb',
				quantity: 1,
				state: QUEUE_STATE.QUEUED,
				progress: 0,
				type: InstaxFilmVariant.SQUARE
			})))
			printer.getInformation.mockResolvedValue({
				battery: { charging: false, level: 80 },
				polaroidCount: 10,
				type: InstaxFilmVariant.MINI,
				filmState: '0,0,12,0,0,0,0'
			})

			mountApp()
			await flushPromises()
			await connect()
			await settle()
		}

		it('says so rather than printing them', async () => {
			await squareQueueOnMiniPrinter()

			expect(wrapper.find('[data-testid="film-mismatch-dialog"]').exists()).toBe(true)
		})

		it('sends nothing at all to the printer', async () => {
			// a photo made for one film size does not fit another, and this is the
			// moment to stop rather than to find out
			await squareQueueOnMiniPrinter()
			await settle(20_000)

			expect(printer.sendImage).not.toHaveBeenCalled()
			expect(printer.printImage).not.toHaveBeenCalled()
		})

		it('keeps the photos until it is told what to do with them', async () => {
			await squareQueueOnMiniPrinter()

			expect(queue()).toHaveLength(3)
		})

		it('gives no way out but the two it offers', async () => {
			await squareQueueOnMiniPrinter()

			expect(wrapper.find('[data-testid="film-mismatch-dialog-close"]').exists()).toBe(false)
		})

		it('prints again once the queue is given up', async () => {
			await squareQueueOnMiniPrinter()

			await wrapper.find('[data-testid="film-mismatch-clear"]').trigger('click')
			await flushPromises()

			expect(queue()).toHaveLength(0)
			expect(wrapper.find('[data-testid="film-mismatch-dialog"]').exists()).toBe(false)

			// and a photo made for *this* printer goes through as normal. The editor
			// follows the connected printer, so a new photo is mini now
			wrapper.findComponent(EditorStub).vm.$emit('image', {
				src: 'data:image/jpeg;base64,mini-photo',
				download: false,
				caption: 'holiday',
				type: InstaxFilmVariant.MINI
			})
			await flushPromises()
			await settle(12_000)

			expect(printer.sendImage).toHaveBeenCalled()
		})

		it('lets the printer be put down instead', async () => {
			await squareQueueOnMiniPrinter()

			await wrapper.find('[data-testid="film-mismatch-disconnect"]').trigger('click')
			await flushPromises()

			expect(printer.disconnect).toHaveBeenCalled()
			// the photos survive the printer being put down
			expect(queue()).toHaveLength(3)
		})

		it('says nothing when the film sizes agree', async () => {
			loadQueue.mockResolvedValue([{
				id: 1, base64: 'data:image/jpeg;base64,saved', thumbnail: 'x', quantity: 1,
				state: QUEUE_STATE.QUEUED, progress: 0, type: InstaxFilmVariant.SQUARE
			}])

			mountApp()
			await flushPromises()
			await connect()
			await settle()

			expect(wrapper.find('[data-testid="film-mismatch-dialog"]').exists()).toBe(false)
			expect(printer.sendImage).toHaveBeenCalled()
		})
	})

	describe('a printer still getting a pack ready', () => {
		const notReady = () => printer.sendImage.mockRejectedValue(
			new InstaxPrintError('busy', 'The printer is not ready yet', 0x01)
		)

		it('says nothing alarming about it', async () => {
			// a fresh pack reports its full count before the printer has finished
			// setting it up, so the first attempt after inserting one lands here -
			// and a failure dialog for something that clears itself is alarming
			notReady()
			mountApp()
			await connect()
			await queueImage()
			await settle()

			expect(wrapper.find('[data-testid="print-error-dialog"]').exists()).toBe(false)
			expect(appConfig().fault).toBe(false)
		})

		it('shows it as a state the printer is in', async () => {
			notReady()
			mountApp()
			await connect()
			await queueImage()
			await settle()

			expect(appConfig().preparing).toBe(true)
		})

		it('leaves the photo waiting rather than marking it failed', async () => {
			notReady()
			mountApp()
			await connect()
			await queueImage()
			await settle()

			expect(queue()).toHaveLength(1)
			expect(queue()[0].state).toBe(QUEUE_STATE.QUEUED)
		})

		it('keeps trying, and prints as soon as it is ready', async () => {
			notReady()
			mountApp()
			await connect()
			await queueImage()
			await settle()
			expect(printer.printImage).not.toHaveBeenCalled()

			printer.sendImage.mockResolvedValue(undefined)
			await settle(12_000)

			expect(printer.printImage).toHaveBeenCalled()
			expect(appConfig().preparing).toBe(false)
		})

		it('gives up waiting eventually rather than retrying for ever', async () => {
			// setting a pack up takes seconds; if it never finishes, something else
			// is wrong and saying nothing would hide it
			notReady()
			mountApp()
			await connect()
			await queueImage()
			await settle(45_000)

			expect(wrapper.find('[data-testid="print-error-dialog"]').exists()).toBe(true)
			expect(queue()[0].state).toBe(QUEUE_STATE.FAILED)
		})
	})

	describe('when the print fails', () => {

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

		it('remembers it got as far as printing, so the bars can say so', async () => {
			// the image was sent and the printer took it; the failure was the print
			// command. Zeroing the phase threw that distinction away
			await failedRun()

			expect(queue()[0].failedAt).toBe(QUEUE_STATE.PRINTING)
			expect(queue()[0].heldByPrinter).toBe(true)
		})

		it('shows no copies printed when the first one failed', async () => {
			// progress is aimed one copy ahead so the bar has somewhere to creep; on
			// a failure it has to drop back to what actually came out, or a print that
			// produced nothing reads as finished
			await failedRun()

			expect(queue()[0].printedCopies).toBe(0)
			expect(queue()[0].progress).toBe(0)
		})

		it('shows the copies that did come out before it failed', async () => {
			printer.printImage.mockImplementation(async (quantity: number, callback: (n: number) => void) => {
				callback(1)
				callback(2)
				throw new InstaxPrintError('not-printed', 'it stopped after two', 0x09)
			})
			mountApp()
			await connect()
			await queueImage()
			wrapper.findComponent(PanelStub).vm.$emit('quantity-change', queue()[0].id, 4)
			await settle()

			expect(queue()[0].printedCopies).toBe(2)
			expect(queue()[0].progress).toBe(50)
		})

		it('remembers a failure during the transfer as a transfer failure', async () => {
			printer.sendImage.mockRejectedValue(
				new InstaxPrintError('refused', 'the printer would not accept it', 0xb4)
			)
			mountApp()
			await connect()
			await queueImage()
			await settle()

			expect(queue()[0].failedAt).toBe(QUEUE_STATE.SENDING)
		})

		it('does not send the image again when only the print failed', async () => {
			// the printer still has the image: it took the transfer and refused the
			// print, so a retry is a print, not a whole transfer over again
			await failedRun()
			expect(queue()[0].heldByPrinter).toBe(true)

			printer.sendImage.mockClear()
			printer.printImage.mockResolvedValue(undefined)

			await wrapper.find('[data-testid="print-error-retry"]').trigger('click')
			await settle()

			expect(printer.sendImage).not.toHaveBeenCalled()
			expect(printer.printImage).toHaveBeenCalled()
		})

		it('shows the middle stage while a resumed print runs', async () => {
			await failedRun()
			printer.printImage.mockImplementation(() => new Promise(() => { }))

			await wrapper.find('[data-testid="print-error-retry"]').trigger('click')
			await settle()

			// straight back to printing, not back to sending
			expect(queue()[0].state).toBe(QUEUE_STATE.PRINTING)
		})

		it('starts over if the resumed print fails as well', async () => {
			// by then the printer may no longer be holding it, so the attempt after
			// that one sends the image again rather than asking a third time
			await failedRun()

			await wrapper.find('[data-testid="print-error-retry"]').trigger('click')
			await settle()

			expect(queue()[0].heldByPrinter).toBe(false)
		})

		it('raises only one dialog however many failures follow', async () => {
			// a failure brings another along behind it, and two stacked dialogs about
			// the same print are worse than one
			await failedRun()
			const first = wrapper.find('[data-testid="print-error-dialog"]').text()

			await settle(20_000)

			expect(wrapper.findAll('[data-testid="print-error-dialog"]')).toHaveLength(1)
			expect(wrapper.find('[data-testid="print-error-dialog"]').text()).toBe(first)
		})

		it('tells the user, with what the printer said', async () => {
			await failedRun()

			const dialog = wrapper.find('[data-testid="print-error-dialog"]')
			expect(dialog.exists()).toBe(true)
			expect(dialog.text()).toContain('status 0x09')
		})

		it('does not retry itself when the dialog is simply closed', async () => {
			// the printer's state bytes change when it faults, and the baseline was
			// taken from the reading before the print - so the next poll always looked
			// like a pack change and closing the dialog reprinted and failed again
			mountApp()
			await connect()

			// the printer reports its fault bytes from the moment it fails, which is
			// exactly the change resumeOnNewFilm watches for
			let faulted = false
			printer.printImage.mockImplementation(async () => {
				faulted = true
				throw new InstaxPrintError('not-printed', 'the printer used no film', 0x09)
			})
			printer.getInformation.mockImplementation(async () => ({
				battery: { charging: false, level: 80 },
				polaroidCount: 7,
				type: InstaxFilmVariant.SQUARE,
				filmState: faulted ? '244,240,12,0,0,0,16' : '0,0,12,0,0,0,0'
			}))

			await queueImage()
			await settle()
			expect(printer.printImage).toHaveBeenCalledTimes(1)

			await wrapper.find('[data-testid="print-error-dialog-close"]').trigger('click')
			await settle(20_000)

			expect(printer.printImage).toHaveBeenCalledTimes(1)
			expect(wrapper.find('[data-testid="print-error-dialog"]').exists()).toBe(false)
		})

		it('holds the phase it failed in across a closed dialog', async () => {
			await failedRun()
			await wrapper.find('[data-testid="print-error-dialog-close"]').trigger('click')
			await settle(20_000)

			// still stage two: the printer has the image, only the print failed
			expect(queue()[0].failedAt).toBe(QUEUE_STATE.PRINTING)
			expect(queue()[0].heldByPrinter).toBe(true)
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

			/** The user has seen the failure and closed it. */
			const dismiss = async () => {
				await wrapper.find('[data-testid="print-error-dialog-close"]').trigger('click')
				await flushPromises()
			}

			it('picks the photo back up on its own', async () => {
				await failedRun()
				await dismiss()
				printer.printImage.mockResolvedValue(undefined)

				newPack()
				await settle(8000)

				expect(printer.printImage).toHaveBeenCalledTimes(2)
				expect(queue()).toHaveLength(0)
			})

			it('waits behind a dialog the user has not dealt with yet', async () => {
				// the printer's own state bytes change when it faults, so a fault looks
				// like a pack change - resuming on it put a second dialog on top of the
				// first. The dialog has a Retry button; that is the way through
				await failedRun()
				printer.printImage.mockResolvedValue(undefined)

				newPack()
				await settle(8000)

				expect(printer.printImage).toHaveBeenCalledTimes(1)
				expect(wrapper.find('[data-testid="print-error-dialog"]').exists()).toBe(true)
			})

			it('ignores the printer state bytes drifting on their own', async () => {
				// bytes 1 and 2 of them are a 16-bit reading, not a flag, so it differs
				// between polls - and keying the resume off that reprinted the photo the
				// instant the dialog was closed
				await failedRun()
				await dismiss()

				let drift = 0
				printer.getInformation.mockImplementation(async () => ({
					battery: { charging: false, level: 80 },
					polaroidCount: 7,
					type: InstaxFilmVariant.SQUARE,
					filmState: `${240 + (drift++ % 9)},240,12,0,0,0,16`
				}))
				await settle(20_000)

				expect(printer.printImage).toHaveBeenCalledTimes(1)
				expect(queue()[0].state).toBe(QUEUE_STATE.FAILED)
			})

			it('wants the count to have gone up, not merely to have moved', async () => {
				await failedRun()
				await dismiss()

				// fewer shots than before is not a new pack
				printer.getInformation.mockResolvedValue({
					battery: { charging: false, level: 80 }, polaroidCount: 3,
					type: InstaxFilmVariant.SQUARE, filmState: '0,0,12,0,0,0,0'
				})
				await settle(20_000)

				expect(printer.printImage).toHaveBeenCalledTimes(1)
			})

			it('waits while nothing about the film has changed', async () => {
				// the reading is the whole signal: without a change this must stay put
				// rather than drift back into reprinting on a loop
				await failedRun()
				await dismiss()

				await settle(20_000)

				expect(printer.printImage).toHaveBeenCalledTimes(1)
				expect(queue()[0].state).toBe(QUEUE_STATE.FAILED)
			})

			it('does not resume into a printer that is still reporting no film', async () => {
				await failedRun()
				await dismiss()

				printer.getInformation.mockResolvedValue({
					battery: { charging: false, level: 80 }, polaroidCount: 0,
					type: InstaxFilmVariant.SQUARE, filmState: '1,2,12,0,0,0,0'
				})
				await settle(8000)

				expect(queue()[0].state).toBe(QUEUE_STATE.FAILED)
			})

			it('does not loop when the fresh pack fails too', async () => {
				await failedRun()
				await dismiss()

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

	describe('handing over between photos', () => {
		/** Hold sendImage open so the queue can be inspected mid-transfer. */
		const holdSending = () => {
			let release = () => { }
			printer.sendImage.mockImplementation(() => new Promise<void>((resolve) => {
				release = () => resolve()
			}))
			return () => release()
		}

		it('starts the next photo the moment the finished one is cleared', async () => {
			// it used to fall back to the 2s poll, and the poll re-read the printer
			// before looking at the queue, so the next photo showed IN QUEUE for well
			// over two seconds after the previous card vanished
			mountApp()
			await connect()

			// the first photo goes through; the second is held mid-transfer so the
			// state it was handed can be read
			let through = 1
			printer.sendImage.mockImplementation(() =>
				through-- > 0 ? Promise.resolve(undefined) : new Promise(() => { }))

			await queueImage()
			await queueImage()
			await settle(12_000)

			expect(queue()).toHaveLength(1)
			expect(queue()[0].state).toBe(QUEUE_STATE.SENDING)
		})

		it('never leaves a photo queued while the printer is idle', async () => {
			mountApp()
			await connect()
			const release = holdSending()
			await queueImage()
			await queueImage()
			await settle(8000)

			// the head is in flight and the one behind it is waiting its turn, which
			// is the only moment QUEUED is the right answer
			expect(queue()[0].state).toBe(QUEUE_STATE.SENDING)
			expect(queue()[1].state).toBe(QUEUE_STATE.QUEUED)
			release()
		})

		it('works through a run of photos without stalling between them', async () => {
			// a fixed count rather than the whole limit: this is about the handover,
			// and the budget is derived from the count so raising the limit cannot
			// quietly leave the test under-timed
			const photos = 6
			mountApp()
			await connect()
			for (let photo = 0; photo < photos; photo++) await queueImage()

			// each photo costs ~1.75s of its own sleeps; a handover still waiting on
			// the 2s poll would need roughly twice this
			await settle(2000 + photos * 2000)

			expect(queue()).toHaveLength(0)
			expect(printer.printImage).toHaveBeenCalledTimes(photos)
		})

		it('does not poll the printer while an image is being sent', async () => {
			// status commands share the characteristic with the image, and a reply
			// landing between two slices of a packet corrupts it
			mountApp()
			await connect()
			const release = holdSending()
			await queueImage()
			await settle(4000)

			printer.getInformation.mockClear()
			await settle(10_000)

			expect(printer.getInformation).not.toHaveBeenCalled()
			release()
		})

		it('goes back to polling once the queue is empty', async () => {
			mountApp()
			await connect()
			await queueImage()
			await settle(10_000)

			printer.getInformation.mockClear()
			await settle(6000)

			expect(printer.getInformation).toHaveBeenCalled()
		})
	})

	describe('reading the printer status', () => {
		const partial = () => printer.getInformation.mockResolvedValue({
			// the shapes getInformation returns when a command goes unanswered
			battery: { charging: false, level: null },
			polaroidCount: null,
			type: null,
			filmState: null
		})

		it('keeps a good reading when the next one comes back blank', async () => {
			// a partial read used to be written straight over the top, and the card
			// falls back to "Connecting...." the moment the level or count is missing
			mountApp()
			await connect()
			expect(appConfig().status?.polaroidCount).toBe(7)

			partial()
			await settle(6000)

			expect(appConfig().status?.polaroidCount).toBe(7)
			expect(appConfig().status?.battery.level).toBe(80)
		})

		it('does not fall back to connecting when a retry re-reads the printer', async () => {
			// retry re-reads the printer to check there is film, and that read landing
			// short is what made the card say Connecting in the middle of a session
			await failedRun()

			partial()
			await wrapper.find('[data-testid="print-error-retry"]').trigger('click')
			await settle()

			expect(appConfig().status?.polaroidCount).toBe(7)
		})

		it('still takes a reading the printer does answer', async () => {
			mountApp()
			await connect()

			printer.getInformation.mockResolvedValue({
				battery: { charging: true, level: 42 },
				polaroidCount: 3,
				type: InstaxFilmVariant.SQUARE,
				filmState: '0,0,12,0,0,0,0'
			})
			await settle(6000)

			expect(appConfig().status?.polaroidCount).toBe(3)
			expect(appConfig().status?.battery.level).toBe(42)
			expect(appConfig().status?.battery.charging).toBe(true)
		})

		it('does not report charging from a reading that had no level', async () => {
			mountApp()
			await connect()

			partial()
			await settle(6000)

			expect(appConfig().status?.battery.charging).toBe(false)
		})
	})

	describe("the printer's own light", () => {
		it('turns to the fault colour when a print fails', async () => {
			// the only feedback there is when nobody is looking at the screen
			await failedRun()

			const colours = printer.setColor.mock.calls.map(([set]: [string[]]) => set[0])
			expect(colours.at(-1)).toBe('#ffb601')
		})

		it('holds the fault colour through a theme change', async () => {
			await failedRun()
			printer.setColor.mockClear()

			wrapper.findComponent(PanelStub).vm.$emit('color-change', 'blue')
			await flushPromises()

			expect(printer.setColor).not.toHaveBeenCalled()
		})

		it('goes back to the theme colour once a print goes through', async () => {
			await failedRun()
			printer.printImage.mockResolvedValue(undefined)
			printer.setColor.mockClear()

			await wrapper.find('[data-testid="print-error-retry"]').trigger('click')
			await settle()

			const colours = printer.setColor.mock.calls.map(([set]: [string[]]) => set[0])
			expect(colours.length).toBeGreaterThan(0)
			expect(colours.at(-1)).not.toBe('#ffb601')
		})
	})

	describe('when the printer goes away', () => {
		/** The listener App hands to the device for gattserverdisconnected. */
		const dropConnection = async () => {
			const device = await printer.connect.mock.results[0].value
			const [, listener] = device.addEventListener.mock.calls
				.find(([event]: [string]) => event === 'gattserverdisconnected')
			listener()
			await flushPromises()
		}

		it('takes the failure dialog down with it', async () => {
			// a fault belongs to the printer that reported it; once that printer is
			// gone the only thing on screen was a dialog about a printer that is not
			await failedRun()
			expect(wrapper.find('[data-testid="print-error-dialog"]').exists()).toBe(true)

			await dropConnection()

			expect(wrapper.find('[data-testid="print-error-dialog"]').exists()).toBe(false)
		})

		it('does not raise a dialog for a transfer that failed because it left', async () => {
			// the report arrives after the disconnect has been handled, so clearing
			// the error on disconnect is not enough by itself
			mountApp()
			await connect()

			printer.sendImage.mockImplementation(async () => {
				await dropConnection()
				throw new InstaxPrintError('silent', 'the printer stopped responding')
			})

			await queueImage()
			await settle()

			expect(wrapper.find('[data-testid="print-error-dialog"]').exists()).toBe(false)
		})

		it('leaves nothing in the queue marked failed', async () => {
			// a failed head blocks everything behind it, and the printer going away is
			// not the photo's fault - on reconnect the queue would just sit there
			await failedRun()
			await dropConnection()

			expect(queue()).toHaveLength(1)
			expect(queue()[0].state).toBe(QUEUE_STATE.QUEUED)
			expect(queue()[0].failedAt ?? null).toBeNull()
		})

		it('forgets that a printer was holding the image', async () => {
			// the next printer will not be, so it has to be sent afresh
			await failedRun()
			await dropConnection()

			expect(queue()[0].heldByPrinter).toBe(false)
		})

		it('starts printing as soon as a printer is back, without waiting to be polled', async () => {
			await failedRun()
			await dropConnection()

			printer.printImage.mockResolvedValue(undefined)
			printer.setColor.mockClear()
			await connect()

			// connect settles well inside a poll interval, so anything printed here
			// was started by the reconnect itself
			expect(printer.sendImage).toHaveBeenCalled()
		})

		it('can print again once a printer is back', async () => {
			// isPrinting used to outlive the connection, and loadMetaData refuses to
			// poll while it is set - so the next session never started its queue
			await failedRun()
			await dropConnection()

			printer.printImage.mockResolvedValue(undefined)
			await connect()
			await queueImage()
			await settle(12_000)

			expect(printer.printImage).toHaveBeenCalled()
		})

		it('still lets the dialog be opened deliberately while disconnected', async () => {
			// the DEV hook exists to look at the dialog without a printer to hand
			mountApp()

			;(window as unknown as { printError: (reason?: string) => void }).printError('reported')
			await flushPromises()

			expect(wrapper.find('[data-testid="print-error-dialog"]').exists()).toBe(true)
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

	describe('the same photo again', () => {
		it('counts as another copy rather than another card', async () => {
			// pressing print twice without touching the editor means two of the same
			// photo, not two queue entries each printing one
			mountApp()
			await connect()
			printer.sendImage.mockImplementation(() => new Promise(() => { }))

			await queueSameImage()
			await queueSameImage()
			await queueSameImage()

			expect(queue()).toHaveLength(1)
			expect(queue()[0].quantity).toBe(3)
		})

		it('does not re-render it into a second card', async () => {
			mountApp()
			await connect()
			printer.sendImage.mockImplementation(() => new Promise(() => { }))

			await queueSameImage()
			const id = queue()[0].id
			await queueSameImage()

			// the same card, kept as it was
			expect(queue()[0].id).toBe(id)
		})

		it('still makes a new card for a photo that has changed', async () => {
			mountApp()
			await connect()
			printer.sendImage.mockImplementation(() => new Promise(() => { }))

			await queueSameImage()
			await queueImage()

			expect(queue()).toHaveLength(2)
		})

		it('adds to the one already printing, rather than making a second card', async () => {
			// the print command is issued per copy, so a photo on its way can still
			// take another - and since the queue starts immediately, that is the
			// common case rather than the exception
			mountApp()
			await connect()
			printer.sendImage.mockImplementation(() => new Promise(() => { }))

			await queueSameImage()
			await settle(4000)
			expect(queue()[0].state).toBe(QUEUE_STATE.SENDING)

			await queueSameImage()

			expect(queue()).toHaveLength(1)
			expect(queue()[0].quantity).toBe(2)
		})

		it('prints the extra copy it was asked for mid-print', async () => {
			// the count used to be fixed when printing began, so asking for another
			// copy changed the card and nothing else
			mountApp()
			await connect()

			let asked = 0
			printer.printImage.mockImplementation(async (copies: () => number, callback: (n: number) => void) => {
				for (let sheet = 0; sheet < copies(); sheet++) {
					asked = copies()
					callback(sheet + 1)
					if (sheet === 0) queue()[0].quantity = 3
				}
			})

			await queueImage()
			await settle()

			expect(asked).toBe(3)
		})

		it('does not count past what the printer will accept', async () => {
			mountApp()
			await connect()
			printer.sendImage.mockImplementation(() => new Promise(() => { }))

			for (let press = 0; press < 14; press++) await queueSameImage()

			expect(queue()[0].quantity).toBe(10)
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

		it('cannot be asked for fewer copies than have already come out', async () => {
			// five asked for and on the second sheet: the two that exist cannot be
			// unmade, so that is the floor
			mountApp()
			await connect()
			printer.printImage.mockImplementation(() => new Promise(() => { }))
			await queueImage()
			wrapper.findComponent(PanelStub).vm.$emit('quantity-change', queue()[0].id, 5)
			await settle()

			const photo = queue()[0]
			expect(photo.state).toBe(QUEUE_STATE.PRINTING)
			photo.printedCopies = 1

			wrapper.findComponent(PanelStub).vm.$emit('quantity-change', photo.id, 1)
			await flushPromises()

			expect(queue()[0].quantity).toBe(2)
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

			// the count is now read per sheet, so it arrives as a function
			const [copies] = printer.printImage.mock.calls[0]
			expect(copies()).toBe(1)
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

	describe('keeping the queue across a reload', () => {
		const saved = (overrides = {}) => ({
			id: 7,
			base64: 'data:image/jpeg;base64,saved',
			thumbnail: 'data:image/jpeg;base64,thumb',
			quantity: 2,
			state: QUEUE_STATE.QUEUED,
			progress: 0,
			type: InstaxFilmVariant.SQUARE,
			caption: 'from before',
			...overrides
		})

		it('brings back what was waiting when the page was closed', async () => {
			loadQueue.mockResolvedValue([saved()])
			mountApp()
			await flushPromises()

			expect(queue()).toHaveLength(1)
			expect(queue()[0].caption).toBe('from before')
			expect(queue()[0].quantity).toBe(2)
		})

		it('numbers new photos above the restored ones', async () => {
			// a new photo handed an id a restored one already has would be
			// indistinguishable to everything that works by identity
			loadQueue.mockResolvedValue([saved({ id: 40 })])
			mountApp()
			await connect()
			printer.sendImage.mockImplementation(() => new Promise(() => { }))
			await queueImage()

			const ids = queue().map((photo) => photo.id)
			expect(new Set(ids).size).toBe(ids.length)
			expect(Math.max(...ids)).toBeGreaterThan(40)
		})

		it('prints it as soon as a printer is connected', async () => {
			loadQueue.mockResolvedValue([saved()])
			mountApp()
			await flushPromises()
			await connect()
			await settle(12_000)

			expect(printer.sendImage).toHaveBeenCalled()
		})

		it('writes the queue down when a photo is added', async () => {
			mountApp()
			await connect()
			printer.sendImage.mockImplementation(() => new Promise(() => { }))
			saveQueue.mockClear()

			await queueImage()

			expect(saveQueue).toHaveBeenCalled()
		})

		it('writes it down again when the copies change', async () => {
			mountApp()
			await connect()
			printer.sendImage.mockImplementation(() => new Promise(() => { }))
			await queueImage()
			saveQueue.mockClear()

			wrapper.findComponent(PanelStub).vm.$emit('quantity-change', queue()[0].id, 4)
			await flushPromises()

			expect(saveQueue).toHaveBeenCalled()
		})

		it('does not write on every tick of a transfer', async () => {
			// progress moves constantly while a photo prints and none of it is worth
			// keeping, so the signature deliberately leaves it out
			mountApp()
			await connect()
			await queueImage()
			await settle(4000)
			saveQueue.mockClear()

			const photo = queue()[0]
			if (photo != null) {
				photo.progress = 10
				photo.progress = 20
				photo.progress = 30
			}
			await flushPromises()

			expect(saveQueue).not.toHaveBeenCalled()
		})

		it('leaves a queue already in hand alone', async () => {
			// a slow read must not drop photos queued while it was in flight
			let release: (value: unknown[]) => void = () => { }
			loadQueue.mockImplementation(() => new Promise((resolve) => { release = resolve }))

			mountApp()
			await connect()
			printer.sendImage.mockImplementation(() => new Promise(() => { }))
			await queueImage()

			release([saved()])
			await flushPromises()

			expect(queue()).toHaveLength(1)
			expect(queue()[0].caption).toBe('holiday')
		})
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
