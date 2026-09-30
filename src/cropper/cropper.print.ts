import type Konva from 'konva'
import { InstaxFilmVariant } from '../interfaces/PrinterStateConfig'
import { PRINT_RESOLUTION } from '../polaroid/frame.geometry'
import { encodeWithinBudget } from './compress.quality'
import type { CompressResponse } from './compress.worker'

/**
 * The transfer packs the payload length into a uint16, so 65535 is a hard ceiling
 * and this leaves room under it. The search below aims well under this on most
 * images rather than filling it, because every byte here is time on the wire.
 */
const MAX_PRINT_BYTES = 1024 * 60

/**
 * The quality the last image settled on, used to open the search on the next one.
 *
 * Images printed in a row come out of the same editor at the same size, so the
 * previous answer is usually close. It is only ever an opening guess for the
 * constrained path; an image that fits at full quality never sees it.
 */
let lastQuality: number | undefined

// Rasterising the stage has to happen here, on the canvas the browser owns, but
// the quality search that follows is pure pixel work and does not.
function canOffloadCompression(): boolean {
	return typeof Worker !== 'undefined'
		&& typeof OffscreenCanvas !== 'undefined'
		&& typeof createImageBitmap === 'function'
}

let compressionWorker: Worker | null = null
let requestId = 0

function getCompressionWorker(): Worker {
	if (compressionWorker == null) {
		compressionWorker = new Worker(new URL('./compress.worker.ts', import.meta.url), { type: 'module' })
	}
	return compressionWorker
}

/** how long the last rasterise took, so the log can say where the time went */
let rasteriseMs = 0

function report(size: number | undefined, quality: number | undefined, attempts: number | undefined, started = 0): void {
	if (!import.meta.env.DEV || size == null) return

	const total = started > 0 ? ` (${Math.round(performance.now() - started)}ms: ` +
		`${Math.round(rasteriseMs)}ms rasterise, ${Math.round(performance.now() - started - rasteriseMs)}ms encode)` : ''

	console.log(
		`> print image ${(size / 1024).toFixed(1)}kB at q${quality?.toFixed(2)} in ${attempts} encode(s)${total}`
	)
}

/**
 * Start the compression worker before there is anything to compress.
 *
 * The worker is a module of its own, so the first print otherwise waits on it
 * being fetched and compiled on top of the work it actually has to do. Starting
 * it when the editor opens moves that off the path entirely.
 */
export function warmCompression(): void {
	if (!canOffloadCompression()) return

	try {
		getCompressionWorker()
	} catch (error) {
		// it is only a head start; the real attempt makes one again if this failed
		console.warn('> could not start the compression worker early', error)
	}
}

function compressInWorker(
	worker: Worker, bitmap: ImageBitmap, width: number, height: number, startedAt: number
): Promise<string> {
	return new Promise<string>((resolve, reject) => {
		const id = ++requestId

		const stopListening = () => {
			worker.removeEventListener('message', onMessage)
			worker.removeEventListener('error', onFailure)
			worker.removeEventListener('messageerror', onFailure)
		}

		const onMessage = (event: MessageEvent<CompressResponse>) => {
			if (event.data.id !== id) return
			stopListening()

			if (event.data.dataUrl != null) {
				lastQuality = event.data.quality
				report(event.data.size, event.data.quality, event.data.attempts, startedAt)
				resolve(event.data.dataUrl)
			} else reject(new Error(event.data.error ?? 'Compression failed'))
		}

		// a worker that fails to start, or a reply that cannot be deserialised,
		// would otherwise leave this promise pending and the editor stuck loading
		const onFailure = () => {
			stopListening()
			compressionWorker = null
			reject(new Error('The compression worker stopped responding'))
		}

		worker.addEventListener('message', onMessage)
		worker.addEventListener('error', onFailure)
		worker.addEventListener('messageerror', onFailure)
		worker.postMessage({ id, bitmap, width, height, maxSize: MAX_PRINT_BYTES, hint: lastQuality }, [bitmap])
	})
}

export async function compressedImage(
	type: InstaxFilmVariant,
	image: Konva.Image,
	background: Konva.Rect,
	stage: Konva.Stage
): Promise<string> {
	const { width, height } = PRINT_RESOLUTION[type] ?? PRINT_RESOLUTION[InstaxFilmVariant.SQUARE]
	const pixelRatio = stage.width() > 0 ? (width / stage.width()) : 2
	const startedAt = performance.now()

	if (canOffloadCompression()) {
		// only the handover may fall back: once the worker has the job, whatever it
		// reports is the answer, successful or not
		let worker: Worker | null = null
		let bitmap: ImageBitmap | null = null

		try {
			worker = getCompressionWorker()
			bitmap = await createImageBitmap(stage.toCanvas({ pixelRatio }))
			rasteriseMs = performance.now() - startedAt
		} catch (error) {
			bitmap?.close()
			console.warn('> compression worker unavailable, falling back to the main thread', error)
		}

		if (worker != null && bitmap != null) return compressInWorker(worker, bitmap, width, height, startedAt)
	}

	return compressOnMainThread(stage, width, height, pixelRatio, startedAt)
}

function encodeCanvas(canvas: HTMLCanvasElement, quality: number): Promise<Blob> {
	return new Promise<Blob>((resolve, reject) => {
		canvas.toBlob(
			(blob) => blob != null ? resolve(blob) : reject(new Error('Could not encode the print image')),
			'image/jpeg',
			quality
		)
	})
}

function toDataUrl(blob: Blob): Promise<string> {
	return new Promise<string>((resolve, reject) => {
		const reader = new FileReader()
		reader.onloadend = () => resolve(reader.result as string)
		reader.onerror = () => reject(new Error('Could not read the compressed image'))
		reader.readAsDataURL(blob)
	})
}

/**
 * The same job, where there is no worker to hand it to.
 *
 * This used to hand a data URL to compressorjs, which decoded and resized the
 * image again on every step of the search - six decodes of a canvas that was
 * already in hand. The canvas encodes itself, so the pixels are prepared once and
 * only the encode repeats, exactly as in the worker.
 */
async function compressOnMainThread(
	stage: Konva.Stage,
	width: number,
	height: number,
	pixelRatio: number,
	startedAt = 0
): Promise<string> {
	const source = stage.toCanvas({ pixelRatio })

	const canvas = document.createElement('canvas')
	canvas.width = width
	canvas.height = height

	const context = canvas.getContext('2d', { alpha: false })
	if (context == null) throw new Error('Could not prepare the print image')

	context.fillStyle = '#FFFFFF'
	context.fillRect(0, 0, width, height)
	context.drawImage(source, 0, 0, width, height)
	rasteriseMs = startedAt > 0 ? performance.now() - startedAt : 0

	const result = await encodeWithinBudget((quality) => encodeCanvas(canvas, quality), MAX_PRINT_BYTES, lastQuality)
	if (result == null) throw new Error('Unable to compress image below target size')

	lastQuality = result.quality
	report(result.blob.size, result.quality, result.attempts, startedAt)

	return toDataUrl(result.blob)
}
