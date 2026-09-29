import { describe, it, expect, beforeEach, vi } from 'vitest'

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
import { PRINT_RESOLUTION } from '../../polaroid/frame.geometry'

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
		const render = async (stageWidth: number, displayScale: number) => {
			const stage = fakeStage(stageWidth);
			await downloadPolaroid(
				InstaxFilmVariant.SQUARE, 'caption', fakeNode() as never, fakeNode() as never, stage as never, displayScale
			);
			return stage.toDataURL.mock.calls[0][0].pixelRatio;
		};

		it('renders at the tuned ratio when the frame is at full size', async () => {
			expect(await render(REFERENCE_STAGE, 1)).toBeCloseTo(2.4);
		});

		it('scales the ratio up by however much the frame is scaled down', async () => {
			// a frame at 0.75x has a 0.75x canvas, so it needs 1/0.75 the ratio
			expect(await render(REFERENCE_STAGE * 0.75, 0.75)).toBeCloseTo(3.2);
		});

		it('produces the same absolute pixel size at any display scale', async () => {
			for (const scale of [1, 0.75, 0.5, 0.31]) {
				const stageWidth = REFERENCE_STAGE * scale;
				const ratio = await render(stageWidth, scale);

				// this is the whole point: the exported bitmap never changes size
				expect(stageWidth * ratio).toBeCloseTo(REFERENCE_STAGE * 2.4, 4);
				mergeImages.mockClear();
			}
		});

		it('falls back to the tuned ratio for an unmeasured scale', async () => {
			expect(await render(REFERENCE_STAGE, 0)).toBeCloseTo(2.4);
			mergeImages.mockClear();
			expect(await render(REFERENCE_STAGE, NaN)).toBeCloseTo(2.4);
		});

		it('defaults to full size when no scale is given', async () => {
			const stage = fakeStage(REFERENCE_STAGE);
			await downloadPolaroid(
				InstaxFilmVariant.SQUARE, '', fakeNode() as never, fakeNode() as never, stage as never
			);

			expect(stage.toDataURL.mock.calls[0][0].pixelRatio).toBeCloseTo(2.4);
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
	});
});
