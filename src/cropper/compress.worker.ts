import { encodeWithinBudget } from './compress.quality'

export interface CompressRequest {
	id: number
	bitmap: ImageBitmap
	width: number
	height: number
	maxSize: number
	hint?: number
}

export interface CompressResponse {
	id: number
	dataUrl?: string
	/** the quality that was settled on, fed back as the next request's hint */
	quality?: number
	size?: number
	attempts?: number
	error?: string
}

function toDataUrl(blob: Blob): Promise<string> {
	return new Promise<string>((resolve, reject) => {
		const reader = new FileReader()
		reader.onloadend = () => resolve(reader.result as string)
		reader.onerror = () => reject(new Error('Could not read the compressed image'))
		reader.readAsDataURL(blob)
	})
}

self.onmessage = async (event: MessageEvent<CompressRequest>) => {
	const { id, bitmap, width, height, maxSize, hint } = event.data

	try {
		const canvas = new OffscreenCanvas(width, height)
		// JPEG has no alpha, and anything left transparent would encode as black,
		// so the canvas is opaque and starts on the polaroid's own white
		const context = canvas.getContext('2d', { alpha: false })
		if (context == null) throw new Error('No 2d context in the worker')

		context.fillStyle = '#FFFFFF'
		context.fillRect(0, 0, width, height)
		context.drawImage(bitmap, 0, 0, width, height)
		bitmap.close()

		const encode = (quality: number) => canvas.convertToBlob({ type: 'image/jpeg', quality })
		const result = await encodeWithinBudget(encode, maxSize, hint)

		if (result == null) throw new Error('Unable to compress image below target size')

		const response: CompressResponse = {
			id,
			dataUrl: await toDataUrl(result.blob),
			quality: result.quality,
			size: result.blob.size,
			attempts: result.attempts
		}
		self.postMessage(response)
	} catch (error) {
		bitmap.close()
		const response: CompressResponse = { id, error: (error as Error).message }
		self.postMessage(response)
	}
}
