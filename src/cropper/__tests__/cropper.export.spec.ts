import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest'

vi.mock('konva', () => ({
	default: { Filters: { Contrast: 'contrast', HSL: 'hsl', Brighten: 'brighten', Noise: 'noise' } }
}))

import { compressedImage } from '../cropper.print'
import { InstaxFilmVariant } from '../../interfaces/PrinterStateConfig'
import { POLAROID_EXPORT_WIDTH, PRINT_RESOLUTION } from '../../polaroid/frame.geometry'

// the crop window of a square frame rendered at its intrinsic width
const REFERENCE_STAGE = 331.2

const fakeNode = () => ({
	filters: vi.fn(), contrast: vi.fn(), saturation: vi.fn(), brightness: vi.fn(),
	noise: vi.fn(), cache: vi.fn(), clearCache: vi.fn()
})

const fakeStage = (width: number, height = width) => ({
	width: () => width,
	height: () => height,
	toCanvas: vi.fn(({ pixelRatio }: { pixelRatio: number }) => ({
		width: width * pixelRatio, height: height * pixelRatio
	})),
	toDataURL: vi.fn(() => 'data:image/png;base64,canvas')
})

// the frame artwork is fetched and decoded for real in the browser; jsdom never
// fires the load, so the decode is stood in for here
const loadedFrames: string[] = []

class StubImage {
	width = 836
	height = 1000
	onload: (() => void) | null = null
	onerror: (() => void) | null = null

	set src(value: string) {
		loadedFrames.push(value);
		queueMicrotask(() => this.onload?.());
	}
}

// jsdom has no 2d context, and the caption is drawn on a throwaway canvas
const stubCanvas = () => {
	const context = {
		clearRect: vi.fn(), fillRect: vi.fn(), save: vi.fn(), restore: vi.fn(),
		translate: vi.fn(), rotate: vi.fn(), fillText: vi.fn(), drawImage: vi.fn(),
		beginPath: vi.fn(), rect: vi.fn(), clip: vi.fn(),
		measureText: vi.fn(() => ({ width: 120 })),
		fillStyle: '', font: ''
	};
	vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(context as never);
	vi.spyOn(HTMLCanvasElement.prototype, 'toDataURL').mockReturnValue('data:image/png;base64,text');
	vi.spyOn(HTMLCanvasElement.prototype, 'toBlob').mockImplementation(
		(callback) => callback(new Blob(['x'], { type: 'image/jpeg' }))
	);
	return context;
};

describe('Export resolution', () => {
	let downloadPolaroid: typeof import('../cropper.download').downloadPolaroid

	beforeEach(async () => {
		loadedFrames.length = 0;
		stubCanvas();
		vi.stubGlobal('Image', StubImage);
		window.Image = StubImage as never;

		// the module keeps the artwork it has decoded, so it is reloaded per test
		vi.resetModules();
		({ downloadPolaroid } = await import('../cropper.download'));
	});

	afterEach(() => vi.unstubAllGlobals());

	describe('downloadPolaroid', () => {
		const ratioFor = async (type: InstaxFilmVariant, stageWidth: number) => {
			const stage = fakeStage(stageWidth);
			await downloadPolaroid(type, 'caption', fakeNode() as never, fakeNode() as never, stage as never);
			return stage.toCanvas.mock.calls[0][0].pixelRatio;
		};

		it('leaves the film look alone, rendering whatever the stage is showing', async () => {
			// it used to put its own fixed filter on the image and clear the node's
			// filters afterwards, so the download came out ignoring every setting
			// the dialog had applied
			const image = fakeNode();
			const background = fakeNode();

			await downloadPolaroid(
				InstaxFilmVariant.SQUARE, 'caption', image as never, background as never,
				fakeStage(REFERENCE_STAGE) as never
			);

			for (const node of [image, background]) {
				expect(node.filters).not.toHaveBeenCalled();
				expect(node.cache).not.toHaveBeenCalled();
				expect(node.clearCache).not.toHaveBeenCalled();
			}
		});

		it('renders at the export width the frame artwork is aligned to', async () => {
			const stageWidth = REFERENCE_STAGE;
			const ratio = await ratioFor(InstaxFilmVariant.SQUARE, stageWidth);

			expect(stageWidth * ratio).toBeCloseTo(POLAROID_EXPORT_WIDTH.square);
		});

		it('produces the same absolute pixel size however the frame is scaled', async () => {
			// this is the whole point: the exported bitmap never changes size
			for (const scale of [1, 0.75, 0.5, 0.31]) {
				const stageWidth = REFERENCE_STAGE * scale;
				const ratio = await ratioFor(InstaxFilmVariant.SQUARE, stageWidth);

				expect(stageWidth * ratio).toBeCloseTo(POLAROID_EXPORT_WIDTH.square);
			}
		});

		it('renders a queue rebuild at that same size, from a print resolution stage', async () => {
			// the queue rebuilds its stage at print resolution rather than on screen
			const ratio = await ratioFor(InstaxFilmVariant.SQUARE, PRINT_RESOLUTION.square.width);

			expect(PRINT_RESOLUTION.square.width * ratio).toBeCloseTo(POLAROID_EXPORT_WIDTH.square);
		});

		it("uses each variant's own export width", async () => {
			for (const type of [InstaxFilmVariant.MINI, InstaxFilmVariant.SQUARE, InstaxFilmVariant.WIDE]) {
				const stageWidth = 240;
				const ratio = await ratioFor(type, stageWidth);

				expect(stageWidth * ratio).toBeCloseTo(POLAROID_EXPORT_WIDTH[type]);
			}
		});

		it('does not divide by a collapsed stage', async () => {
			expect(await ratioFor(InstaxFilmVariant.SQUARE, 0)).toBe(1);
		});

		it('composites onto the frame artwork of the requested variant', async () => {
			await downloadPolaroid(
				InstaxFilmVariant.WIDE, '', fakeNode() as never, fakeNode() as never,
				fakeStage(REFERENCE_STAGE) as never
			);

			expect(loadedFrames).toContain('/polaroids/export/wide_scale.png');
		});

		it('encodes once, at the end, rather than once per layer', async () => {
			// the photo, the frame and the caption each used to make the round trip
			// through a PNG on the main thread, which is what stalled the loader
			const context = stubCanvas();
			const encode = vi.mocked(HTMLCanvasElement.prototype.toDataURL);
			encode.mockClear();

			await downloadPolaroid(
				InstaxFilmVariant.MINI, 'holiday 98', fakeNode() as never, fakeNode() as never,
				fakeStage(REFERENCE_STAGE) as never
			);

			expect(encode).toHaveBeenCalledTimes(1);

			// and the layers go down in order: photo, frame, then the caption
			expect(context.drawImage).toHaveBeenCalledTimes(2);
			expect(context.fillText).toHaveBeenCalledWith('holiday 98', expect.any(Number), 0);
		});

		it('keeps the caption inside its own box, as a merged layer was', async () => {
			const context = stubCanvas();

			await downloadPolaroid(
				InstaxFilmVariant.SQUARE, 'a caption', fakeNode() as never, fakeNode() as never,
				fakeStage(REFERENCE_STAGE) as never
			);

			expect(context.clip).toHaveBeenCalled();
			const [left, , width, height] = context.rect.mock.calls[0];
			expect([left, width, height]).toEqual([20, 800, 200]);
		});

		it('writes nothing at all when there is no caption', async () => {
			const context = stubCanvas();

			await downloadPolaroid(
				InstaxFilmVariant.SQUARE, '   ', fakeNode() as never, fakeNode() as never,
				fakeStage(REFERENCE_STAGE) as never
			);

			expect(context.fillText).not.toHaveBeenCalled();
		});

		it('keeps the artwork it has already decoded', async () => {
			for (let attempt = 0; attempt < 3; attempt++) {
				await downloadPolaroid(
					InstaxFilmVariant.MINI, '', fakeNode() as never, fakeNode() as never,
					fakeStage(REFERENCE_STAGE) as never
				);
			}

			expect(loadedFrames.filter((src) => src.includes('mini')).length).toBeLessThanOrEqual(1);
		});

	});

	describe('compressedImage', () => {
		// the encode itself is not under test here, only the resolution it is given
		const ratioFor = (type: InstaxFilmVariant, stageWidth: number) => {
			const stage = fakeStage(stageWidth, stageWidth);
			// the rasterise is synchronous, so the ratio is set before this returns
			compressedImage(type, fakeNode(), fakeNode(), stage).catch(() => { /* expected */ });
			return stage.toCanvas.mock.calls[0][0].pixelRatio;
		};

		it('renders exactly at the printer resolution at full size', () => {
			const ratio = ratioFor(InstaxFilmVariant.SQUARE, REFERENCE_STAGE);

			expect(REFERENCE_STAGE * ratio).toBeCloseTo(PRINT_RESOLUTION.square.width);
		});

		it('still renders at the printer resolution from a scaled down canvas', () => {
			for (const scale of [1, 0.75, 0.5, 0.25]) {
				const stageWidth = REFERENCE_STAGE * scale;
				const ratio = ratioFor(InstaxFilmVariant.SQUARE, stageWidth);

				expect(stageWidth * ratio).toBeCloseTo(PRINT_RESOLUTION.square.width);
			}
		});

		it('uses each variant\'s own printer resolution', () => {
			for (const type of [InstaxFilmVariant.MINI, InstaxFilmVariant.SQUARE, InstaxFilmVariant.WIDE]) {
				const stageWidth = 240;
				const ratio = ratioFor(type, stageWidth);

				expect(stageWidth * ratio).toBeCloseTo(PRINT_RESOLUTION[type].width);
			}
		});

		it('does not divide by a collapsed stage', () => {
			expect(ratioFor(InstaxFilmVariant.SQUARE, 0)).toBe(2);
		});

		describe('Offloading to a worker', () => {
			const fakeStage = (width: number) => ({
				width: () => width,
				height: () => width,
				toDataURL: vi.fn(() => 'data:image/png;base64,canvas'),
				toCanvas: vi.fn(({ pixelRatio }: { pixelRatio: number }) => ({
					width: width * pixelRatio, height: width * pixelRatio
				}))
			});

			// the worker is created once and reused, so the stub delegates to these
			// rather than capturing per instance
			let workerPost: ReturnType<typeof vi.fn>
			let workerHandlers: Record<string, ((event: unknown) => void)[]>

			const dispatch = (type: string, event: unknown) =>
				(workerHandlers[type] ?? []).slice().forEach((handler) => handler(event));

			const reply = (data: unknown) => dispatch('message', { data });

			let workerTerminate: ReturnType<typeof vi.fn>
			let bitmapClose: ReturnType<typeof vi.fn>

			const enableWorker = () => {
				workerPost = vi.fn();
				workerTerminate = vi.fn();
				bitmapClose = vi.fn();
				workerHandlers = {};

				vi.stubGlobal('OffscreenCanvas', class { });
				vi.stubGlobal('createImageBitmap', vi.fn(async () => ({ close: bitmapClose })));
				vi.stubGlobal('Worker', class {
					postMessage(...args: unknown[]) { return workerPost(...args) }
					// a real Worker has this, and a dead one left running keeps its
					// canvas and blobs alive beside the replacement
					terminate() { return workerTerminate() }
					addEventListener(type: string, handler: (event: unknown) => void) {
						(workerHandlers[type] ??= []).push(handler);
					}
					removeEventListener(type: string, handler: (event: unknown) => void) {
						workerHandlers[type] = (workerHandlers[type] ?? []).filter((existing) => existing !== handler);
					}
				});
			};

			afterEach(() => vi.unstubAllGlobals());

			it('rasterises without a data URL round trip when a worker is available', async () => {
				enableWorker();

				const stage = fakeStage(REFERENCE_STAGE);
				const pending = compressedImage(InstaxFilmVariant.SQUARE, fakeNode(), fakeNode(), stage);

				await vi.waitFor(() => expect(workerPost).toHaveBeenCalled());

				// the canvas goes over as a bitmap, so no base64 is built on the main thread
				expect(stage.toCanvas).toHaveBeenCalledWith({ pixelRatio: PRINT_RESOLUTION.square.width / REFERENCE_STAGE });
				expect(stage.toDataURL).not.toHaveBeenCalled();

				const [message, transfer] = workerPost.mock.calls[0];
				expect(message).toMatchObject({ width: 800, height: 800, maxSize: 1024 * 60 });
				expect(transfer).toHaveLength(1);

				reply({ id: message.id, dataUrl: 'data:image/jpeg;base64,done' });
				await expect(pending).resolves.toBe('data:image/jpeg;base64,done');
			});

			it('surfaces a failure reported by the worker', async () => {
				enableWorker();

				const pending = compressedImage(InstaxFilmVariant.SQUARE, fakeNode(), fakeNode(), fakeStage(REFERENCE_STAGE));
				await vi.waitFor(() => expect(workerPost).toHaveBeenCalled());

				reply({ id: workerPost.mock.calls[0][0].id, error: 'too big' });

				await expect(pending).rejects.toThrow('too big');
			});

			it('ignores a reply meant for an earlier request', async () => {
				enableWorker();

				const pending = compressedImage(InstaxFilmVariant.SQUARE, fakeNode(), fakeNode(), fakeStage(REFERENCE_STAGE));
				await vi.waitFor(() => expect(workerPost).toHaveBeenCalled());

				const { id } = workerPost.mock.calls[0][0];
				reply({ id: id - 1, dataUrl: 'data:image/jpeg;base64,stale' });
				reply({ id, dataUrl: 'data:image/jpeg;base64,current' });

				await expect(pending).resolves.toBe('data:image/jpeg;base64,current');
			});

			it('rejects rather than hanging when the worker fails to start', async () => {
				enableWorker();

				const pending = compressedImage(InstaxFilmVariant.SQUARE, fakeNode(), fakeNode(), fakeStage(REFERENCE_STAGE));
				await vi.waitFor(() => expect(workerPost).toHaveBeenCalled());

				// an unstarted worker never answers, which would leave the editor
				// stuck showing its loading overlay
				dispatch('error', new Event('error'));

				await expect(pending).rejects.toThrow('stopped responding');
				expect(workerTerminate).toHaveBeenCalled();
			});

			it('closes the bitmap when the handover itself fails', async () => {
				// the bitmap is only detached once postMessage has taken it; if that
				// throws it is still ours, and a wide frame is ~4MB left behind
				enableWorker();
				workerPost.mockImplementation(() => { throw new Error('DataCloneError') });

				const pending = compressedImage(
					InstaxFilmVariant.SQUARE, fakeNode(), fakeNode(), fakeStage(REFERENCE_STAGE)
				);

				await expect(pending).rejects.toThrow('DataCloneError');
				expect(bitmapClose).toHaveBeenCalled();
			});

			it('gives up on a worker that simply goes quiet', async () => {
				// no error event, no reply: without a watchdog the editor shows its
				// loading overlay for ever and only a reload clears it
				vi.useFakeTimers();
				enableWorker();

				try {
					const pending = compressedImage(
						InstaxFilmVariant.SQUARE, fakeNode(), fakeNode(), fakeStage(REFERENCE_STAGE)
					);
					const settled = expect(pending).rejects.toThrow('stopped responding');

					await vi.advanceTimersByTimeAsync(25_000);
					await settled;
				} finally {
					vi.useRealTimers();
				}
			});

			it('rejects when a reply cannot be deserialised', async () => {
				enableWorker();

				const pending = compressedImage(InstaxFilmVariant.SQUARE, fakeNode(), fakeNode(), fakeStage(REFERENCE_STAGE));
				await vi.waitFor(() => expect(workerPost).toHaveBeenCalled());

				dispatch('messageerror', new Event('messageerror'));

				await expect(pending).rejects.toThrow('stopped responding');
			});

			it('falls back to the main thread where OffscreenCanvas is missing', () => {
				// this is the path jsdom takes, and the one older browsers take
				const stage = fakeStage(REFERENCE_STAGE);
				compressedImage(InstaxFilmVariant.SQUARE, fakeNode(), fakeNode(), stage).catch(() => { /* expected */ });

				// it rasterises straight to a canvas and encodes that, rather than
				// going out through a PNG data URL and decoding it again per attempt
				expect(stage.toCanvas).toHaveBeenCalled();
				expect(stage.toDataURL).not.toHaveBeenCalled();
			});
		});
	});
});
