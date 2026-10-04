import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'

import { loadQueue, saveQueue } from '../queue.storage'
import { InstaxFilmVariant } from '../../interfaces/PrinterStateConfig'
import { MAX_QUEUE_LENGTH, QUEUE_STATE, type QueueImage } from '../../interfaces/QueueImage'

/**
 * A stand-in for IndexedDB, since jsdom has none.
 *
 * It models the parts the store actually uses - a keyPath store, getAll, clear,
 * put, and the success/error callbacks - rather than pretending to be a database.
 */
function fakeIndexedDB(options: { failOpen?: boolean, failWrite?: boolean } = {}) {
	const rows = new Map<number, unknown>()

	const makeRequest = <T>(result: T, fails = false) => {
		const request: Record<string, unknown> = { result, error: fails ? new Error('refused') : null }
		queueMicrotask(() => {
			if (fails) (request.onerror as (() => void) | undefined)?.()
			else (request.onsuccess as (() => void) | undefined)?.()
		})
		return request
	}

	const store = {
		getAll: () => makeRequest([...rows.values()]),
		clear: () => { rows.clear(); return makeRequest(undefined) },
		put: (row: { id: number }) => {
			if (options.failWrite !== true) rows.set(row.id, row)
			return makeRequest(undefined)
		}
	}

	const transaction = () => {
		const handle: Record<string, unknown> = {
			objectStore: () => store,
			error: options.failWrite === true ? new Error('quota') : null
		}
		queueMicrotask(() => {
			if (options.failWrite === true) (handle.onerror as (() => void) | undefined)?.()
			else (handle.oncomplete as (() => void) | undefined)?.()
		})
		return handle
	}

	vi.stubGlobal('indexedDB', {
		open: () => {
			const request: Record<string, unknown> = {
				result: { objectStoreNames: { contains: () => true }, transaction, close: () => { } },
				error: options.failOpen === true ? new Error('blocked') : null
			}
			queueMicrotask(() => {
				if (options.failOpen === true) (request.onerror as (() => void) | undefined)?.()
				else (request.onsuccess as (() => void) | undefined)?.()
			})
			return request
		}
	})

	return { rows }
}

const photo = (overrides: Partial<QueueImage> = {}): QueueImage => ({
	id: 1,
	base64: 'data:image/jpeg;base64,print',
	thumbnail: 'data:image/jpeg;base64,thumb',
	quantity: 1,
	state: QUEUE_STATE.QUEUED,
	progress: 0,
	type: InstaxFilmVariant.SQUARE,
	caption: 'holiday',
	...overrides
})

describe('the saved print queue', () => {
	beforeEach(() => vi.spyOn(console, 'warn').mockImplementation(() => { }))
	afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks() })

	it('brings a photo back as it was', async () => {
		fakeIndexedDB()
		await saveQueue([photo({ id: 4, quantity: 3 })])

		const [restored] = await loadQueue()

		expect(restored.id).toBe(4)
		expect(restored.base64).toBe('data:image/jpeg;base64,print')
		expect(restored.thumbnail).toBe('data:image/jpeg;base64,thumb')
		expect(restored.quantity).toBe(3)
		expect(restored.caption).toBe('holiday')
		expect(restored.type).toBe(InstaxFilmVariant.SQUARE)
	})

	it('brings it back waiting, whatever it was doing', async () => {
		// its progress belonged to a printer that is no longer connected
		fakeIndexedDB()
		await saveQueue([photo({ state: QUEUE_STATE.PRINTING, progress: 60, failedAt: QUEUE_STATE.PRINTING })])

		const [restored] = await loadQueue()

		expect(restored.state).toBe(QUEUE_STATE.QUEUED)
		expect(restored.progress).toBe(0)
		expect(restored.failedAt ?? null).toBeNull()
		expect(restored.heldByPrinter ?? false).toBe(false)
	})

	it('asks only for the copies that had not printed yet', async () => {
		// reloading half way through five copies must not reprint the two that came
		// out before it
		fakeIndexedDB()
		await saveQueue([photo({ quantity: 5, printedCopies: 2 })])

		const [restored] = await loadQueue()

		expect(restored.quantity).toBe(3)
	})

	it('drops a photo that had finished printing', async () => {
		fakeIndexedDB()
		await saveQueue([photo({ quantity: 2, printedCopies: 2 })])

		expect(await loadQueue()).toHaveLength(0)
	})

	it('keeps the order they were queued in', async () => {
		fakeIndexedDB()
		await saveQueue([photo({ id: 9 }), photo({ id: 3 }), photo({ id: 6 })])

		expect((await loadQueue()).map((entry) => entry.id)).toEqual([3, 6, 9])
	})

	it('forgets a photo that has been taken off the queue', async () => {
		fakeIndexedDB()
		await saveQueue([photo({ id: 1 }), photo({ id: 2 })])
		await saveQueue([photo({ id: 2 })])

		expect((await loadQueue()).map((entry) => entry.id)).toEqual([2])
	})

	it('holds to the queue limit however much was saved', async () => {
		fakeIndexedDB()
		await saveQueue(Array.from({ length: MAX_QUEUE_LENGTH + 6 }, (_, index) => photo({ id: index + 1 })))

		expect(await loadQueue()).toHaveLength(MAX_QUEUE_LENGTH)
	})

	describe('what it refuses to trust', () => {
		const stored = (overrides: Record<string, unknown>) => {
			const { rows } = fakeIndexedDB()
			rows.set(1, {
				id: 1, base64: 'data:image/jpeg;base64,print', thumbnail: 'thumb',
				quantity: 1, type: InstaxFilmVariant.SQUARE, storedAt: Date.now(), ...overrides
			})
			return rows
		}

		it('skips a row that is not an image at all', async () => {
			stored({ base64: 'https://example.com/photo.jpg' })
			expect(await loadQueue()).toHaveLength(0)
		})

		it('skips a film type it does not recognise', async () => {
			stored({ type: 'polaroid' })
			expect(await loadQueue()).toHaveLength(0)
		})

		it('skips a row with no usable id', async () => {
			stored({ id: 'first' })
			expect(await loadQueue()).toHaveLength(0)
		})

		it('skips a queue left from a week ago', async () => {
			stored({ storedAt: Date.now() - 1000 * 60 * 60 * 24 * 8 })
			expect(await loadQueue()).toHaveLength(0)
		})

		it('holds the copies to what the printer accepts', async () => {
			stored({ quantity: 400 })
			expect((await loadQueue())[0].quantity).toBe(10)
		})

		it('falls back to the print image when the thumbnail is missing', async () => {
			stored({ thumbnail: '' })
			expect((await loadQueue())[0].thumbnail).toBe('data:image/jpeg;base64,print')
		})
	})

	describe('when the store will not cooperate', () => {
		it('starts with an empty queue rather than failing to start', async () => {
			fakeIndexedDB({ failOpen: true })

			await expect(loadQueue()).resolves.toEqual([])
		})

		it('does not throw when the write is refused', async () => {
			// a full disk is a shame; failing a print over it would not be
			fakeIndexedDB({ failWrite: true })

			await expect(saveQueue([photo()])).resolves.toBeUndefined()
		})

		it('does nothing at all where there is no IndexedDB', async () => {
			vi.stubGlobal('indexedDB', undefined)

			await expect(saveQueue([photo()])).resolves.toBeUndefined()
			await expect(loadQueue()).resolves.toEqual([])
		})
	})
})
