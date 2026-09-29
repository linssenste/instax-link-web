import type { InstaxFilmVariant } from './PrinterStateConfig'

export interface QueueImage {
	quantity: number,
	base64: string,
	state: number,
	progress: number,
	abortController?: null | AbortController,

	/** film variant the image was rendered for, needed to rebuild the keepsake */
	type: InstaxFilmVariant,

	/** caption typed on the polaroid; not printed, but kept as the queue title */
	caption?: string
}
