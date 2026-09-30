/** The adjustments the user can dial in, and the single pixel pass applying them. */
export interface FilmAdjustments {
	/** -1 .. 1, where 0 leaves the exposure alone */
	brightness: number
	/** -100 .. 100, where 0 leaves the contrast alone */
	contrast: number
	/** -1 .. 1 of midtone gamma; bends the middle and leaves both ends where they are */
	midtones: number
	/** -1 .. 2, where 0 leaves the colour alone */
	saturation: number
	/** -100 (cold, blue cast) .. 100 (warm, pink and orange cast) */
	temperature: number
	/** -100 (green) .. 100 (magenta); the white balance axis temperature cannot reach */
	tint: number
	/** 0 .. 1 of how far the blacks are lifted off zero */
	lift: number
	/** 0 .. 1 of how far the whites are pulled in off paper white */
	wash: number
	/** 0 .. 1 of film grain */
	grain: number
	/** blur radius in pixels of the frame, for a shot that missed focus */
	blur: number
}

// Measured off scanned polaroids: shadows land at 54 to 66 rather than 0 and
// highlights around 200 rather than 255, and the green/magenta axis spans roughly
// 40 counts either side of neutral.
const FADE_BLACK = 62;
const FADE_WHITE = 52;
const TINT_GREEN = 26;
const MIDTONE_GAMMA = 2;

/** a shortened range, a warm cast in the shadows, and no grain: film is not grainy */
export const DEFAULT_ADJUSTMENTS: FilmAdjustments = {
	brightness: 0.02,
	contrast: 16,
	midtones: 0,
	saturation: 0.45,
	temperature: 28,
	tint: 0,
	lift: 0.85,
	wash: 0.85,
	grain: 0,
	blur: 0
}

export const NEUTRAL_ADJUSTMENTS: FilmAdjustments = {
	brightness: 0,
	contrast: 0,
	midtones: 0,
	saturation: 0,
	temperature: 0,
	tint: 0,
	lift: 0,
	wash: 0,
	grain: 0,
	blur: 0
}

export const ADJUSTMENT_RANGES = {
	brightness: { min: -0.5, max: 0.5, step: 0.01 },
	contrast: { min: -60, max: 60, step: 1 },
	midtones: { min: -1, max: 1, step: 0.01 },
	saturation: { min: -1, max: 2, step: 0.05 },
	temperature: { min: -100, max: 100, step: 1 },
	tint: { min: -100, max: 100, step: 1 },
	lift: { min: 0, max: 1, step: 0.01 },
	wash: { min: 0, max: 1, step: 0.01 },
	// close to grainless, so this is a seasoning rather than a look
	grain: { min: 0, max: 0.25, step: 0.01 },
	blur: { min: 0, max: 8, step: 0.5 }
} as const

const clampByte = (value: number) => value < 0 ? 0 : value > 255 ? 255 : value;

const clampIndex = (value: number) =>
	value < 0 ? 0 : value > 255 ? 255 : Math.round(value);

/** the gamma curve as its 256 answers, so no pixel pays for a Math.pow */
function buildMidtoneCurve(midtones: number): Uint8ClampedArray {
	const exponent = Math.pow(MIDTONE_GAMMA, -midtones);
	const curve = new Uint8ClampedArray(256);

	for (let value = 0; value < 256; value++) {
		curve[value] = Math.round(255 * Math.pow(value / 255, exponent));
	}

	return curve;
}

/**
 * How the cast is spread across the tones, taken from the scans: a warm frame
 * runs about 60 counts of red over blue in its shadows and half that by the
 * highlights, and carries the green with it, so it lands on orange rather than
 * on pure red.
 */
const WARM_RED_BASE = 40;
const WARM_RED_SHADOW = 30;
const WARM_GREEN_BASE = 9;
const WARM_GREEN_SHADOW = 7;
const WARM_BLUE_BASE = 36;
const WARM_BLUE_SHADOW = 28;

export function isNeutral(adjustments: FilmAdjustments): boolean {
	return adjustments.brightness === 0
		&& adjustments.contrast === 0
		&& adjustments.midtones === 0
		&& adjustments.saturation === 0
		&& adjustments.temperature === 0
		&& adjustments.tint === 0
		&& adjustments.lift === 0
		&& adjustments.wash === 0
		&& adjustments.grain === 0
		&& adjustments.blur === 0;
}

// blur is authored against a frame this wide, so a setting carries over from a
// 320px preview to a 1260px print
const BLUR_REFERENCE_WIDTH = 320;

export function blurRadiusFor(blur: number, frameWidth: number): number {
	if (blur <= 0 || frameWidth <= 0) return 0;
	return blur * (frameWidth / BLUR_REFERENCE_WIDTH);
}

/** true when only the per pixel pass is needed, with no blur to apply */
export function hasPixelWork(adjustments: FilmAdjustments): boolean {
	return adjustments.brightness !== 0
		|| adjustments.contrast !== 0
		|| adjustments.midtones !== 0
		|| adjustments.saturation !== 0
		|| adjustments.temperature !== 0
		|| adjustments.tint !== 0
		|| adjustments.lift !== 0
		|| adjustments.wash !== 0
		|| adjustments.grain !== 0;
}

/**
 * Every adjustment in one pass. Konva ships a filter per effect and each walks the
 * whole bitmap, so folding them together is the same arithmetic over a fraction of
 * the reads and writes, which counts when this runs again at export resolution.
 */
export function applyFilm(imageData: ImageData, adjustments: FilmAdjustments): void {
	if (isNeutral(adjustments)) return;

	const data = imageData.data;

	// contrast as the usual (x - 128) * k + 128 around mid grey
	const contrastScale = (259 * (adjustments.contrast + 255)) / (255 * (259 - adjustments.contrast));
	const brightnessOffset = adjustments.brightness * 255;
	const saturation = 1 + adjustments.saturation;
	const warmth = adjustments.temperature / 100;
	const grain = adjustments.grain * 255;

	// squeezed into the film's range at the very end, so the contrast and the cast
	// are not themselves flattened along with it
	const black = adjustments.lift * FADE_BLACK;
	const white = 255 - adjustments.wash * FADE_WHITE;
	const span = (white - black) / 255;
	const compress = adjustments.lift !== 0 || adjustments.wash !== 0;

	const midtoneCurve = adjustments.midtones === 0 ? null : buildMidtoneCurve(adjustments.midtones);

	const tint = adjustments.tint / 100;
	const tintGreen = tint * TINT_GREEN;
	const tintEdges = tintGreen / 2;

	for (let index = 0; index < data.length; index += 4) {
		let red = data[index];
		let green = data[index + 1];
		let blue = data[index + 2];

		if (brightnessOffset !== 0) {
			red += brightnessOffset;
			green += brightnessOffset;
			blue += brightnessOffset;
		}

		if (adjustments.contrast !== 0) {
			red = (red - 128) * contrastScale + 128;
			green = (green - 128) * contrastScale + 128;
			blue = (blue - 128) * contrastScale + 128;
		}

		if (midtoneCurve != null) {
			red = midtoneCurve[clampIndex(red)];
			green = midtoneCurve[clampIndex(green)];
			blue = midtoneCurve[clampIndex(blue)];
		}

		if (saturation !== 1) {
			// Rec. 709 luma: a flat average would shift the hue as saturation changes
			const luma = 0.2126 * red + 0.7152 * green + 0.0722 * blue;
			red = luma + (red - luma) * saturation;
			green = luma + (green - luma) * saturation;
			blue = luma + (blue - luma) * saturation;
		}

		if (warmth !== 0) {
			// The dyes are least neutral where least light fell: a cold frame is 90
			// counts of red down in the shadows but 15 in the highlights. Applied
			// after the saturation, since it belongs to the film and not the scene,
			// which is what gives a monochrome frame its tone.
			const level = (0.2126 * red + 0.7152 * green + 0.0722 * blue) / 255;
			const shadow = level < 0 ? 1 : level > 1 ? 0 : 1 - level;

			red += warmth * (WARM_RED_BASE + WARM_RED_SHADOW * shadow);
			green += warmth * (WARM_GREEN_BASE + WARM_GREEN_SHADOW * shadow);
			blue -= warmth * (WARM_BLUE_BASE + WARM_BLUE_SHADOW * shadow);
		}

		if (tint !== 0) {
			// green against the mean of red and blue, evenly across the tones: the
			// warmth carries the film's character, this corrects or places a cast
			green -= tintGreen;
			red += tintEdges;
			blue += tintEdges;
		}

		if (grain > 0) {
			const noise = (Math.random() - 0.5) * grain;
			red += noise;
			green += noise;
			blue += noise;
		}

		if (compress) {
			red = black + red * span;
			green = black + green * span;
			blue = black + blue * span;
		}

		data[index] = clampByte(red);
		data[index + 1] = clampByte(green);
		data[index + 2] = clampByte(blue);
	}
}

/** A Konva filter bound to a particular set of adjustments. */
export function filmFilter(adjustments: FilmAdjustments) {
	return (imageData: ImageData) => applyFilm(imageData, adjustments);
}
