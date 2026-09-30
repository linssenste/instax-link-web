import type { InstaxFilmVariant } from './PrinterStateConfig'

/**
 * Where a queued photo has got to.
 *
 * FAILED is its own state rather than a return to QUEUED because the queue is
 * polled every couple of seconds: a photo put back to QUEUED would be picked
 * straight up and sent to a printer that has just refused it, over and over. It
 * stays on the queue and waits to be told what to do.
 */
/**
 * How many photos may wait to be printed at once.
 *
 * The queue is held in memory and every photo in it is a full print resolution
 * JPEG, so it is not somewhere to pile work up; this is the one place the limit
 * is written down, rather than a number sitting in whichever component happened
 * to need to check it.
 */
export const MAX_QUEUE_LENGTH = 5

export const QUEUE_STATE = {
	QUEUED: 0,
	SENDING: 1,
	PRINTING: 2,
	FAILED: 3
} as const

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
