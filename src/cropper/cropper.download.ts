import Konva from "konva";
import { InstaxFilmVariant } from "../interfaces/PrinterStateConfig";
import mergeImages from 'merge-images';
import { POLAROID_EXPORT_WIDTH, PRINT_RESOLUTION } from "../polaroid/frame.geometry";

function createPolaroidText(polaroidType: InstaxFilmVariant, text: string): string {
	// Create a new canvas element
	const canvas = document.createElement('canvas');
	canvas.id = "polaroid-download-text";

	// Set canvas dimensions based on your configuration
	const width = (polaroidType == InstaxFilmVariant.MINI) ? 600 :
		(polaroidType == InstaxFilmVariant.SQUARE) ? 800 : 1150;
	const height = 200;
	canvas.width = width;
	canvas.height = height;

	// Get 2D context
	const ctx = canvas.getContext("2d");
	if (ctx == null) return '';

	// Draw content
	// Clear the canvas (optional, if you want to clear previous drawings)
	ctx.clearRect(0, 0, canvas.width, canvas.height);

	// Draw the transparent background
	ctx.fillStyle = "rgba(255, 150, 100, 0)"; // Transparent white background
	ctx.fillRect(0, 0, canvas.width, canvas.height);

	// Draw the text
	ctx.font = `${(Math.random() * 2) + 60}px biro_script_standardregular`;
	ctx.fillStyle = "rgba(0, 15, 85, .75)";

	// Calculate text width
	const textWidth = ctx.measureText(text).width;

	const x = (canvas.width - textWidth) / 2;
	const y = canvas.height / 2;
	const rotationAngle = (Math.random() * 2) - 1;

	ctx.save();
	ctx.translate(x + textWidth / 2, y);
	ctx.rotate((rotationAngle * Math.PI) / 180);

	ctx.fillText(text, -textWidth / 2, 0);
	ctx.restore();

	// Append canvas to the document
	document.body.appendChild(canvas);

	const textImage = (canvas as HTMLCanvasElement).toDataURL('image/png')


	document.body.removeChild(canvas);

	return textImage;

}

interface ImageFilter {
	contrast: number,
	saturation: number
	brightness: number,
	noise: number,
}

export function setPolaroidFilter(image: Konva.Image, background: Konva.Rect, filter: ImageFilter): void {
	const filterList = [
		Konva.Filters.Contrast,
		Konva.Filters.HSL,
		Konva.Filters.Brighten,
		Konva.Filters.Noise
	]


	// Apply filters
	image.filters(filterList);
	image.contrast(filter.contrast)
	image.saturation(filter.saturation)
	image.brightness(filter.brightness)
	image.noise(filter.noise)
	image.cache();


	if (background == null) return;
	background.filters(filterList)

	background.contrast(filter.contrast);
	background.saturation(filter.saturation)
	background.brightness(filter.brightness)
	background.noise(filter.noise)
	background.cache();
}

export function removePolaroidFilter(image: Konva.Image, background: Konva.Rect): void {
	image.clearCache();
	image.filters([]);

	if (background == null) return;
	background.filters([]);
	background.clearCache();
}


/**
 * Render the polaroid keepsake: the framed photo with its caption, filtered to
 * look like film.
 *
 * The stage may be any size - the editor scales it to fit the viewport, and the
 * queue rebuilds one at print resolution - so the pixel ratio is derived from the
 * export width the frame artwork is aligned to rather than from the stage.
 */
export async function downloadPolaroid(type: InstaxFilmVariant, text: string, image: Konva.Image, background: Konva.Rect, stage: Konva.Stage): Promise<string> {
	const filterConfig = {
		contrast: 0.75,
		saturation: 0.5,
		brightness: .05,
		noise: .15
	}

	setPolaroidFilter(image, background, filterConfig)

	const exportWidth = POLAROID_EXPORT_WIDTH[type] ?? POLAROID_EXPORT_WIDTH[InstaxFilmVariant.SQUARE];
	const pixelRatio = stage.width() > 0 ? (exportWidth / stage.width()) : 1;

	const canvasUrl = stage.toDataURL({ pixelRatio });

	removePolaroidFilter(image, background); // remove all Konva filters

	return mergeImages([
		{ src: canvasUrl, x: type == InstaxFilmVariant.SQUARE ? 28 : type == InstaxFilmVariant.MINI ? 22 : 22, y: 40 },
		{ src: `/polaroids/export/${type}_scale.png`, x: 0, y: 0 },
		{ src: createPolaroidText(type, text), x: 20, y: (Math.random() * 10) + 835 }
	])

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
