import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest'

const mergeImages = vi.hoisted(() => vi.fn(async () => 'merged-data-url'))
const Compressor = vi.hoisted(() => vi.fn())

vi.mock('merge-images', () => ({ default: mergeImages }))
vi.mock('compressorjs', () => ({ default: Compressor }))
vi.mock('konva', () => ({
	default: { Filters: { Contrast: 'contrast', HSL: 'hsl', Brighten: 'brighten', Noise: 'noise' } }
}))

import { downloadPolaroid } from '../cropper.download'
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
	toDataURL: vi.fn(() => 'data:image/png;base64,canvas')
})

// jsdom has no 2d context, and the caption is drawn on a throwaway canvas
const stubCanvas = () => {
	const context = {
		clearRect: vi.fn(), fillRect: vi.fn(), save: vi.fn(), restore: vi.fn(),
		translate: vi.fn(), rotate: vi.fn(), fillText: vi.fn(),
		measureText: vi.fn(() => ({ width: 120 })),
		fillStyle: '', font: ''
	};
	vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(context as never);
	vi.spyOn(HTMLCanvasElement.prototype, 'toDataURL').mockReturnValue('data:image/png;base64,text');
	return context;
};

describe('Export resolution', () => {
	beforeEach(() => {
		mergeImages.mockClear();
		Compressor.mockClear();
		stubCanvas();
	});

	describe('downloadPolaroid', () => {
		const ratioFor = async (type: InstaxFilmVariant, stageWidth: number) => {
			const stage = fakeStage(stageWidth);
			await downloadPolaroid(type, 'caption', fakeNode() as never, fakeNode() as never, stage as never);
			return stage.toDataURL.mock.calls[0][0].pixelRatio;
		};

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
				mergeImages.mockClear();
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
				mergeImages.mockClear();
			}
		});

		it('does not divide by a collapsed stage', async () => {
			expect(await ratioFor(InstaxFilmVariant.SQUARE, 0)).toBe(1);
		});

		it('composites onto the frame artwork of the requested variant', async () => {
			const stage = fakeStage(REFERENCE_STAGE);
			await downloadPolaroid(
				InstaxFilmVariant.WIDE, '', fakeNode() as never, fakeNode() as never, stage as never
			);

			const sources = mergeImages.mock.calls[0][0].map((layer: { src: string }) => layer.src);
			expect(sources).toContain('/polaroids/export/wide_scale.png');
		});

		it('clears the print filters again after rendering', async () => {
			const image = fakeNode();
			const background = fakeNode();

			await downloadPolaroid(
				InstaxFilmVariant.SQUARE, '', image as never, background as never, fakeStage(REFERENCE_STAGE) as never
			);

			expect(image.clearCache).toHaveBeenCalled();
			expect(image.filters).toHaveBeenLastCalledWith([]);
			expect(background.filters).toHaveBeenLastCalledWith([]);
		});
	});

	describe('compressedImage', () => {
		// the compressor and the fetch/FileReader round trip are not under test here,
		// only the resolution handed to it
		const ratioFor = (type: InstaxFilmVariant, stageWidth: number) => {
			const stage = fakeStage(stageWidth, stageWidth);
			// it rejects once it reaches the mocked compressor; the ratio is already set
			compressedImage(type, fakeNode(), fakeNode(), stage).catch(() => { /* expected */ });
			return stage.toDataURL.mock.calls[0][0].pixelRatio;
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
				toCanvas: vi.fn(() => ({}))
			});

			// the worker is created once and reused, so the stub delegates to these
			// rather than capturing per instance
			let workerPost: ReturnType<typeof vi.fn>
			let workerHandlers: Record<string, ((event: unknown) => void)[]>

			const dispatch = (type: string, event: unknown) =>
				(workerHandlers[type] ?? []).slice().forEach((handler) => handler(event));

			const reply = (data: unknown) => dispatch('message', { data });

			const enableWorker = () => {
				workerPost = vi.fn();
				workerHandlers = {};

				vi.stubGlobal('OffscreenCanvas', class { });
				vi.stubGlobal('createImageBitmap', vi.fn(async () => ({ close: vi.fn() })));
				vi.stubGlobal('Worker', class {
					postMessage(...args: unknown[]) { return workerPost(...args) }
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

				expect(stage.toDataURL).toHaveBeenCalled();
				expect(stage.toCanvas).not.toHaveBeenCalled();
			});
		});
	});
});
