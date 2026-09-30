import { InstaxFilmVariant } from '../interfaces/PrinterStateConfig'

// CSS polaroid sizess
export const POLAROID_FRAME_HEIGHT = 440

export const POLAROID_FRAME_WIDTH: Record<InstaxFilmVariant, number> = {
	[InstaxFilmVariant.MINI]: 282,
	[InstaxFilmVariant.SQUARE]: 368,
	[InstaxFilmVariant.WIDE]: 522
}

/**
 * Width in pixels that the exported polaroid is rendered at, per film variant.
 *
 * It has to stay constant no matter how far the frame is scaled down on screen,
 * because the frame artwork under `public/polaroids/export` and the caption
 * offsets are aligned to it. Each value slightly overshoots the window in that
 * artwork, and the frame is composited on top, so the overhang is covered.
 */
export const POLAROID_EXPORT_WIDTH: Record<InstaxFilmVariant, number> = {
	[InstaxFilmVariant.MINI]: 564,
	[InstaxFilmVariant.SQUARE]: 736,
	[InstaxFilmVariant.WIDE]: 1116
}

/** Pixel dimensions the printer expects per film variant. */
export const PRINT_RESOLUTION: Record<InstaxFilmVariant, { width: number, height: number }> = {
	[InstaxFilmVariant.MINI]: { width: 600, height: 800 },
	[InstaxFilmVariant.SQUARE]: { width: 800, height: 800 },
	[InstaxFilmVariant.WIDE]: { width: 1260, height: 840 }
}

/**
 * Which of the four framing states the image currently satisfies, so each control
 * can show whether it is already the case rather than only offering to make it so.
 */
export interface FrameAlignment {
	fitsWidth: boolean
	fitsHeight: boolean
	centredHorizontally: boolean
	centredVertically: boolean
}

export const NOT_ALIGNED: FrameAlignment = {
	fitsWidth: false,
	fitsHeight: false,
	centredHorizontally: false,
	centredVertically: false
}
