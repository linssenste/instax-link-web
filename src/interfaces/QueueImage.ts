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
 * Nothing here is persisted - the queue lives in memory for the life of the page,
 * and a reload loses it - so this is not a storage quota. What it bounds is
 * memory: each photo holds its print JPEG (at most 60kB, so ~80kB as the base64
 * the printer is handed) plus a ~8kB thumbnail for its card. Measured, that is
 * about 4MB at this limit, including the decoded thumbnails; the cards used to
 * display the print images themselves, which cost 2.4-4MB each and is what made
 * a long queue expensive.
 *
 * So the ceiling is about patience rather than resources. A sheet takes roughly
 * fifteen seconds, so a full queue of single copies is around five minutes of
 * printing - and since each photo may ask for up to ten copies, a full queue can
 * out-run two film packs several times over. Longer would be possible; it would
 * mostly buy a longer wait.
 */
export const MAX_QUEUE_LENGTH = 20

/** Gives each queued photo an identity that survives the queue moving under it. */
let nextQueueId = 0
export function queueId(): number {
	return ++nextQueueId
}

/**
 * Carry on numbering above a queue restored from the last session.
 *
 * Without this a new photo would be handed an id a restored one already has, and
 * the two would be indistinguishable to everything that works by identity.
 */
export function seedQueueIds(highest: number): void {
	if (Number.isFinite(highest) && highest > nextQueueId) nextQueueId = Math.floor(highest)
}

export const QUEUE_STATE = {
	QUEUED: 0,
	SENDING: 1,
	PRINTING: 2,
	FAILED: 3
} as const

/** The states a queued photo may be in, as a type rather than a bare number. */
export type QueueState = typeof QUEUE_STATE[keyof typeof QUEUE_STATE]

export interface QueueImage {
	/**
	 * Identifies this photo for as long as it is queued.
	 *
	 * The queue is mutated by `shift()`, so a position is not a photo: anything
	 * that looks a photo up again after an await has to do it by identity, or it
	 * acts on whichever photo has since slid into that slot.
	 */
	id: number,

	quantity: number,
	/** the print image itself, which is what goes to the printer */
	base64: string,

	/**
	 * A small copy for the card to display.
	 *
	 * Separate from `base64` because an `<img>` decodes at its source's size, and
	 * a queue of print images meant megabytes of decoded bitmap held for as long
	 * as they sat there.
	 */
	thumbnail: string,
	state: QueueState,
	progress: number,
	abortController?: null | AbortController,

	/**
	 * The phase the photo was in when it failed.
	 *
	 * Kept so the card can still show how far it got: sending and printing are
	 * separate bars, and which of them stopped short is the difference between
	 * "the printer never received it" and "the printer had it and would not print".
	 */
	failedAt?: QueueState | null,

	/**
	 * Whether the printer is still holding this image.
	 *
	 * Set once the transfer completes. A print that fails after that point does not
	 * need the image sent again - the printer has it, and only the print command
	 * failed - so a retry resumes at the printing stage. Cleared if a resumed print
	 * fails too, since by then the printer may no longer have it.
	 */
	heldByPrinter?: boolean,

	/**
	 * Copies the printer has confirmed came out.
	 *
	 * `progress` is where the bar is animating *to*, which is a copy ahead of
	 * reality on purpose - that is what gives the bar something to creep towards.
	 * This is the honest count, so a failure can show what actually printed rather
	 * than the copy it was hoping for.
	 */
	printedCopies?: number,

	/**
	 * When the copy now printing started, as a timestamp.
	 *
	 * The card draws its creep over a sheet's worth of time, and asking for more
	 * copies changes how far that creep has to go. Without knowing when the sheet
	 * started, the only thing the card could do was begin again - so changing the
	 * count and changing it back left the bar at the wrong place.
	 */
	copyStartedAt?: number,

	/** film variant the image was rendered for, needed to rebuild the keepsake */
	type: InstaxFilmVariant,

	/** caption typed on the polaroid; not printed, but kept as the queue title */
	caption?: string
}
