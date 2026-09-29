export interface CompressRequest {
	id: number
	bitmap: ImageBitmap
	width: number
	height: number
	maxSize: number
}

export interface CompressResponse {
	id: number
	dataUrl?: string
	error?: string
}

// Search for the highest JPEG quality that still fits the printer's size budget.
// Mirrors the main thread implementation, including keeping the last attempt even
// when it overshoots, so the caller applies the same tolerance either way.
async function compressToBudget(canvas: OffscreenCanvas, maxSize: number): Promise<Blob | null> {
	let minQuality = 0
	let maxQuality = 1
	let result: Blob | null = null

	while (minQuality <= maxQuality) {
		const quality = (minQuality + maxQuality) / 2
		result = await canvas.convertToBlob({ type: 'image/jpeg', quality })

		if (result.size > maxSize) {
			maxQuality = quality - 0.01
		} else {
			if (maxQuality - minQuality < 0.02) break
			minQuality = quality + 0.01
		}
	}

	return result
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
	const { id, bitmap, width, height, maxSize } = event.data

	try {
		const canvas = new OffscreenCanvas(width, height)
		const context = canvas.getContext('2d')
		if (context == null) throw new Error('No 2d context in the worker')

		context.drawImage(bitmap, 0, 0, width, height)
		bitmap.close()

		const result = await compressToBudget(canvas, maxSize)
		if (result == null || result.size > maxSize + 5000) {
			throw new Error('Unable to compress image below target size')
		}

		const response: CompressResponse = { id, dataUrl: await toDataUrl(result) }
		self.postMessage(response)
	} catch (error) {
		bitmap.close()
		const response: CompressResponse = { id, error: (error as Error).message }
		self.postMessage(response)
	}
}
