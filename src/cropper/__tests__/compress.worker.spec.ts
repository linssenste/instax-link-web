import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

/**
 * The worker that compresses every print in a modern browser.
 *
 * It was invisible to coverage because no spec imported it, which is also why
 * nothing verified the one thing that would be silently wrong in the output: the
 * opaque white fill. JPEG has no alpha, so anything left transparent encodes as
 * black, and the printer would put a black border on every photo.
 */
type Reply = { id: number, dataUrl?: string, error?: string, quality?: number, size?: number, attempts?: number }

function stubWorkerEnvironment(options: { sizeFor?: (quality: number) => number, noContext?: boolean } = {}) {
	const { sizeFor = (quality: number) => Math.round(200_000 * Math.pow(quality, 4)) } = options

	const calls: string[] = []
	const context = {
		fillStyle: '',
		fillRect: vi.fn(() => { calls.push('fillRect') }),
		drawImage: vi.fn(() => { calls.push('drawImage') })
	}

	const convertToBlob = vi.fn(async ({ quality }: { quality: number }) =>
		({ size: sizeFor(quality), type: 'image/jpeg' }) as Blob)

	vi.stubGlobal('OffscreenCanvas', class {
		constructor(public width: number, public height: number) { }
		getContext() { return options.noContext === true ? null : context }
		convertToBlob = convertToBlob
	})

	// the worker turns the blob into a data URL before replying
	vi.stubGlobal('FileReader', class {
		result: string | null = null
		onloadend: (() => void) | null = null
		onerror: (() => void) | null = null
		readAsDataURL() {
			this.result = 'data:image/jpeg;base64,encoded'
			queueMicrotask(() => this.onloadend?.())
		}
	})

	const replies: Reply[] = []
	const postMessage = vi.fn((reply: Reply) => { replies.push(reply) })
	vi.stubGlobal('postMessage', postMessage)

	return { calls, context, convertToBlob, replies }
}

const bitmap = () => ({ close: vi.fn() })

async function loadWorker() {
	vi.resetModules()
	await import('../compress.worker')

	// the module installs itself on self.onmessage
	const handler = (globalThis as unknown as { onmessage: (event: { data: unknown }) => Promise<void> }).onmessage
	expect(handler).toBeTypeOf('function')
	return handler
}

const request = (overrides: Record<string, unknown> = {}) => ({
	data: { id: 7, bitmap: bitmap(), width: 800, height: 800, maxSize: 1024 * 60, ...overrides }
})

describe('compress.worker', () => {
	beforeEach(() => vi.stubGlobal('self', globalThis))
	afterEach(() => vi.unstubAllGlobals())

	it('fills the canvas opaque white before drawing the photo', async () => {
		// JPEG has no alpha: without this, anything transparent in the stage encodes
		// as black and the printer puts a black border on the photo
		const { calls, context } = stubWorkerEnvironment()
		const handler = await loadWorker()

		await handler(request())

		expect(calls).toEqual(['fillRect', 'drawImage'])
		expect(context.fillStyle).toBe('#FFFFFF')
	})

	it('answers with the id it was asked under', async () => {
		const { replies } = stubWorkerEnvironment()
		const handler = await loadWorker()

		await handler(request({ id: 42 }))

		expect(replies[0].id).toBe(42)
	})

	it('reports the quality and size it settled on', async () => {
		const { replies } = stubWorkerEnvironment()
		const handler = await loadWorker()

		await handler(request())

		expect(replies[0].dataUrl).toBe('data:image/jpeg;base64,encoded')
		expect(replies[0].size).toBeLessThanOrEqual(1024 * 60)
		expect(replies[0].quality).toBeGreaterThan(0)
		expect(replies[0].attempts).toBeGreaterThanOrEqual(1)
	})

	it('releases the bitmap once it has been drawn', async () => {
		stubWorkerEnvironment()
		const handler = await loadWorker()
		const image = bitmap()

		await handler(request({ bitmap: image }))

		expect(image.close).toHaveBeenCalled()
	})

	it('releases the bitmap even when the compression fails', async () => {
		// a wide frame is ~4MB; leaking one per failed print adds up
		stubWorkerEnvironment({ sizeFor: () => 80_000_000 })
		const handler = await loadWorker()
		const image = bitmap()

		await handler(request({ bitmap: image }))

		expect(image.close).toHaveBeenCalled()
	})

	it('reports a failure rather than going quiet', async () => {
		// silence here leaves the editor showing its loading overlay for ever
		const { replies } = stubWorkerEnvironment({ sizeFor: () => 80_000_000 })
		const handler = await loadWorker()

		await handler(request())

		expect(replies).toHaveLength(1)
		expect(replies[0].error).toMatch(/compress/i)
		expect(replies[0].dataUrl).toBeUndefined()
	})

	it('reports a canvas it cannot draw on', async () => {
		const { replies } = stubWorkerEnvironment({ noContext: true })
		const handler = await loadWorker()

		await handler(request())

		expect(replies[0].error).toMatch(/context/i)
	})

	it('passes the hint through so an image like the last one costs one encode', async () => {
		const { convertToBlob, replies } = stubWorkerEnvironment({
			sizeFor: (quality) => Math.round(2_000_000 * Math.pow(quality, 4))
		})
		const handler = await loadWorker()

		await handler(request({ hint: 0.45 }))

		const asked = convertToBlob.mock.calls.map(([options]) => options.quality)
		expect(asked).toContain(0.45)
		expect(replies[0].error).toBeUndefined()
	})

	it('encodes at the canvas size it was given, not the size of the bitmap', async () => {
		const { context } = stubWorkerEnvironment()
		const handler = await loadWorker()

		await handler(request({ width: 1260, height: 840 }))

		expect(context.drawImage).toHaveBeenCalledWith(expect.anything(), 0, 0, 1260, 840)
	})
})
