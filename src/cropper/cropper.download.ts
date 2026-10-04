import Konva from "konva";
import { InstaxFilmVariant } from "../interfaces/PrinterStateConfig";
import { POLAROID_EXPORT_WIDTH, PRINT_RESOLUTION } from "../polaroid/frame.geometry";

/** the box the caption is written into, under the photo */
const CAPTION_WIDTH: Record<string, number> = { mini: 600, square: 800, wide: 1150 };
const CAPTION_HEIGHT = 200;
const CAPTION_LEFT = 20;

/**
 * Where the photo sits inside the frame artwork. Each is the artwork's own
 * transparent window less a small lip, measured off the artwork so the print lands
 * where the editor showed it: these used to be one shared top and a left that put
 * the photo well off centre, twice as far under the frame on one side as the other.
 */
const PHOTO_LEFT: Record<string, number> = { mini: 39, square: 52, wide: 40 };
const PHOTO_TOP: Record<string, number> = { mini: 76, square: 82, wide: 80 };

/**
 * Write the caption onto the keepsake.
 *
 * This used to be drawn on a canvas of its own, encoded to a PNG and merged back
 * in, which is two full image round trips on the main thread for one line of
 * handwriting. The box it was drawn in is kept, so a long caption still runs out
 * of room in the same place.
 */
function drawCaption(context: CanvasRenderingContext2D, type: InstaxFilmVariant, text: string): void {
	if (text.trim().length === 0) return;

	const width = CAPTION_WIDTH[type] ?? CAPTION_WIDTH.square;
	const top = (Math.random() * 10) + 835;

	context.save();

	context.beginPath();
	context.rect(CAPTION_LEFT, top, width, CAPTION_HEIGHT);
	context.clip();

	context.font = `${(Math.random() * 2) + 60}px biro_script_standardregular`;
	context.fillStyle = 'rgba(0, 15, 85, .75)';

	const textWidth = context.measureText(text).width;
	const centre = CAPTION_LEFT + width / 2;
	const rotation = (Math.random() * 2) - 1;

	context.translate(centre, top + CAPTION_HEIGHT / 2);
	context.rotate((rotation * Math.PI) / 180);
	context.fillText(text, -textWidth / 2, 0);

	context.restore();
}

// the frame artwork is the same few files over and over, and decoding one is far
// from free, so each is decoded once and kept
const frameArtwork = new Map<string, Promise<HTMLImageElement>>();

function frameImage(type: InstaxFilmVariant): Promise<HTMLImageElement> {
	const cached = frameArtwork.get(type);
	if (cached != null) return cached;

	const loading = loadImage(`/polaroids/export/${type}_scale.png`)
		.catch((error) => {
			// a failed load must not be remembered as the answer
			frameArtwork.delete(type);
			throw error;
		});

	frameArtwork.set(type, loading);
	return loading;
}

/**
 * Render the polaroid keepsake: the framed photo with its caption.
 *
 * The film look is whatever the stage is already showing. This used to reach in
 * and put its own fixed filter on the image, which overwrote the settings the
 * editor had applied and left the download looking nothing like the preview.
 *
 * The stage may be any size - the editor scales it to fit the viewport, and the
 * queue rebuilds one at print resolution - so the pixel ratio is derived from the
 * export width the frame artwork is aligned to rather than from the stage.
 */
export async function downloadPolaroid(type: InstaxFilmVariant, text: string, image: Konva.Image, background: Konva.Rect, stage: Konva.Stage): Promise<string> {
	const exportWidth = POLAROID_EXPORT_WIDTH[type] ?? POLAROID_EXPORT_WIDTH[InstaxFilmVariant.SQUARE];
	const pixelRatio = stage.width() > 0 ? (exportWidth / stage.width()) : 1;

	// straight to a canvas: asking the stage for a data URL would encode a PNG on
	// the main thread only for the compositor below to decode it again
	const photo = stage.toCanvas({ pixelRatio });
	const frame = await frameImage(type);

	const canvas = document.createElement('canvas');
	canvas.width = Math.max(photo.width, frame.width);
	canvas.height = Math.max(photo.height, frame.height);

	const context = canvas.getContext('2d');
	if (context == null) throw new Error('Could not compose the polaroid');

	context.drawImage(photo, PHOTO_LEFT[type] ?? PHOTO_LEFT.square, PHOTO_TOP[type] ?? PHOTO_TOP.square);
	context.drawImage(frame, 0, 0);
	drawCaption(context, type, text);

	// one encode, at the end, rather than one per layer
	return canvas.toDataURL('image/png');
}


/** How long a thumbnail decode may take before the card keeps the print image. */
const THUMBNAIL_TIMEOUT = 4000

/**
 * A small copy of a print image, for the queue card to show.
 *
 * A card renders its photo 90px tall, but an `<img>` decodes at the source's own
 * size - so showing the print image directly kept a full 800x800 (or 1260x840)
 * bitmap decoded for as long as the photo sat in the queue: 2.4-4MB each. The
 * decode still happens once, here, and then only the small copy is held.
 */
export async function queueThumbnail(source: string, maxEdge = 180): Promise<string> {
	try {
		// an image that neither loads nor errors would otherwise leave this pending
		// for the life of the page
		const image = await Promise.race([
			loadImage(source),
			new Promise<never>((_, reject) => setTimeout(
				() => reject(new Error('Timed out decoding the queue thumbnail')), THUMBNAIL_TIMEOUT
			))
		])

		const scale = Math.min(1, maxEdge / Math.max(image.width, image.height))
		const canvas = document.createElement('canvas')
		canvas.width = Math.max(1, Math.round(image.width * scale))
		canvas.height = Math.max(1, Math.round(image.height * scale))

		const context = canvas.getContext('2d')
		if (context == null) return source

		context.drawImage(image, 0, 0, canvas.width, canvas.height)
		return canvas.toDataURL('image/jpeg', 0.8)
	} catch {
		// the card showing the print image is wasteful, not broken
		return source
	}
}

/** Name the downloaded file after the caption when there is one. */
export function polaroidFilename(caption?: string): string {
	const trimmed = caption?.trim();
	if (!trimmed) return 'Polaroid.png';

	// keep it to characters every file system accepts
	const safe = trimmed.replace(/[^\p{L}\p{N} _-]/gu, '').replace(/\s+/g, '-').slice(0, 60);
	return safe.length > 0 ? `${safe}.png` : 'Polaroid.png';
}

/** Hand a rendered image to the browser as a file. */
export function downloadDataUrl(dataUrl: string, filename: string): void {
	const link = document.createElement('a');
	link.href = dataUrl;
	link.download = filename;
	link.click();
}

function loadImage(src: string): Promise<HTMLImageElement> {
	return new Promise<HTMLImageElement>((resolve, reject) => {
		const image = new window.Image();
		image.onload = () => resolve(image);
		image.onerror = () => reject(new Error('Could not load the queued image'));
		image.src = src;
	});
}

/**
 * Rebuild the keepsake for an image that is already on the print queue.
 *
 * Only the photo that went to the printer is kept, so the frame, caption and film
 * filter are applied here rather than rendering a second copy up front. It runs
 * the same code as the editor's download, so the two match.
 */
export async function polaroidFromPrintImage(
	type: InstaxFilmVariant,
	caption: string,
	printImageSource: string
): Promise<string> {
	const photo = await loadImage(printImageSource);
	const { width, height } = PRINT_RESOLUTION[type] ?? PRINT_RESOLUTION[InstaxFilmVariant.SQUARE];

	// an offscreen stage, never added to the document
	const container = document.createElement('div');
	const stage = new Konva.Stage({ container, width, height });
	const layer = new Konva.Layer();
	stage.add(layer);

	const background = new Konva.Rect({ x: 0, y: 0, width, height, fill: '#FFFFFF' });
	const image = new Konva.Image({ image: photo, x: 0, y: 0, width, height });

	layer.add(background);
	layer.add(image);

	try {
		return await downloadPolaroid(type, caption, image, background, stage);
	} finally {
		stage.destroy();
	}
}
