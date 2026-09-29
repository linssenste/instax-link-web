import { InstaxFilmVariant } from '../interfaces/PrinterStateConfig'

// CSS polaroid sizess
export const POLAROID_FRAME_HEIGHT = 440

export const POLAROID_FRAME_WIDTH: Record<InstaxFilmVariant, number> = {
	[InstaxFilmVariant.MINI]: 282,
	[InstaxFilmVariant.SQUARE]: 368,
	[InstaxFilmVariant.WIDE]: 522
}

/** Pixel dimensions the printer expects per film variant. */
export const PRINT_RESOLUTION: Record<InstaxFilmVariant, { width: number, height: number }> = {
	[InstaxFilmVariant.MINI]: { width: 600, height: 800 },
	[InstaxFilmVariant.SQUARE]: { width: 800, height: 800 },
	[InstaxFilmVariant.WIDE]: { width: 1260, height: 840 }
}
