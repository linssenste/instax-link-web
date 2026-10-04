import { InstaxFilmVariant } from '../interfaces/PrinterStateConfig'
import { MAX_QUEUE_LENGTH, QUEUE_STATE, type QueueImage } from '../interfaces/QueueImage'

/**
 * The print queue, kept across a reload.
 *
 * IndexedDB rather than localStorage: a queued photo carries its print JPEG and a
 * thumbnail, so a full queue is a couple of megabytes of image data. localStorage
 * holds strings only, against a quota of about five megabytes shared with
 * everything else on the origin, and it writes on the main thread - the wrong
 * tool for this by some margin.
 *
 * Only what a photo *is* gets stored. Its progress, the phase it reached and its
 * abort controller all belong to a printer that is no longer connected, so a
 * restored photo comes back simply waiting its turn.
 */

const DB_NAME = 'instax-link-queue'
const STORE = 'photos'
const VERSION = 1

/** What is worth keeping: the photo, and how many copies are still wanted. */
interface StoredPhoto {
	id: number
	base64: string
	thumbnail: string
	quantity: number
	type: InstaxFilmVariant
	caption?: string
	/** so an abandoned queue is not restored for ever */
	storedAt: number
}

/** Past this a queue is stale rather than unfinished. */
const KEEP_FOR = 1000 * 60 * 60 * 24 * 7

function openDatabase(): Promise<IDBDatabase> {
	return new Promise<IDBDatabase>((resolve, reject) => {
		const request = indexedDB.open(DB_NAME, VERSION)

		request.onupgradeneeded = () => {
			const db = request.result
			if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE, { keyPath: 'id' })
		}

		request.onsuccess = () => resolve(request.result)
		request.onerror = () => reject(request.error ?? new Error('Could not open the queue store'))
		request.onblocked = () => reject(new Error('The queue store is held open elsewhere'))
	})
}

const FILM_VARIANTS = new Set<string>(Object.values(InstaxFilmVariant))

/** Nothing read back is trusted: an older version of this app wrote it. */
function asPhoto(row: unknown): StoredPhoto | null {
	if (row == null || typeof row !== 'object') return null

	const { id, base64, thumbnail, quantity, type, caption, storedAt } = row as Record<string, unknown>

	if (typeof id !== 'number' || !Number.isFinite(id)) return null
	if (typeof base64 !== 'string' || !base64.startsWith('data:')) return null
	if (typeof type !== 'string' || !FILM_VARIANTS.has(type)) return null
	if (typeof quantity !== 'number' || quantity < 1) return null
	if (typeof storedAt !== 'number' || Date.now() - storedAt > KEEP_FOR) return null

	return {
		id,
		base64,
		thumbnail: typeof thumbnail === 'string' && thumbnail.length > 0 ? thumbnail : base64,
		quantity: Math.min(Math.floor(quantity), 10),
		type: type as InstaxFilmVariant,
		caption: typeof caption === 'string' ? caption : undefined,
		storedAt
	}
}

/**
 * The photos from the last session, oldest first and ready to print.
 *
 * Never throws: a queue that cannot be read is an empty one, and that must not
 * stop the app from starting.
 */
export async function loadQueue(): Promise<QueueImage[]> {
	try {
		if (typeof indexedDB === 'undefined') return []

		const db = await openDatabase()
		const rows = await new Promise<unknown[]>((resolve, reject) => {
			const transaction = db.transaction(STORE, 'readonly')
			const request = transaction.objectStore(STORE).getAll()

			request.onsuccess = () => resolve(request.result as unknown[])
			request.onerror = () => reject(request.error ?? new Error('Could not read the queue'))
			transaction.oncomplete = () => db.close()
		})

		return rows
			.map(asPhoto)
			.filter((photo): photo is StoredPhoto => photo != null)
			.sort((a, b) => a.id - b.id)
			.slice(0, MAX_QUEUE_LENGTH)
			.map((photo) => ({
				id: photo.id,
				base64: photo.base64,
				thumbnail: photo.thumbnail,
				quantity: photo.quantity,
				state: QUEUE_STATE.QUEUED,
				progress: 0,
				type: photo.type,
				caption: photo.caption
			}))
	} catch (error) {
		console.warn('> could not read the saved queue', error)
		return []
	}
}

/**
 * Write the queue down as it now stands.
 *
 * The copies kept are the ones still wanted: a photo interrupted half way through
 * five comes back asking for what is left, so a reload cannot reprint what has
 * already come out.
 */
export async function saveQueue(photos: QueueImage[]): Promise<void> {
	try {
		if (typeof indexedDB === 'undefined') return

		const keeping: StoredPhoto[] = []

		for (const photo of photos) {
			const remaining = photo.quantity - (photo.printedCopies ?? 0)
			if (remaining < 1) continue

			keeping.push({
				id: photo.id,
				base64: photo.base64,
				thumbnail: photo.thumbnail,
				quantity: remaining,
				type: photo.type,
				caption: photo.caption,
				storedAt: Date.now()
			})
		}

		const db = await openDatabase()

		await new Promise<void>((resolve, reject) => {
			const transaction = db.transaction(STORE, 'readwrite')
			const store = transaction.objectStore(STORE)

			// replaced wholesale, so a photo taken off the queue leaves nothing behind
			store.clear()
			for (const photo of keeping) store.put(photo)

			transaction.oncomplete = () => { db.close(); resolve() }
			transaction.onerror = () => reject(transaction.error ?? new Error('The queue could not be saved'))
			transaction.onabort = () => reject(transaction.error ?? new Error('The queue write was aborted'))
		})
	} catch (error) {
		// losing the saved copy is a shame; failing a print over it would not be
		console.warn('> could not save the queue', error)
	}
}
