/**
 * How fast the image is pushed over the link.
 *
 * The transfer is the slow part of printing by a wide margin: the payload is
 * around 60kB and it used to go out in 182 byte writes with a fixed pause after
 * every one of them, which is several hundred round trips and several seconds of
 * waiting before the printer has even started.
 *
 * Neither the write size nor the pause is dictated by the printer - the chunk
 * sizes in `imageToChunks` are, but how those chunks reach the characteristic is
 * ours to choose. Both are tuned here, and both only ever move in the safe
 * direction on their own: the transfer starts optimistic and backs off when the
 * printer stops keeping up, rather than guessing at a link it cannot measure.
 */

/**
 * Write sizes to try, largest first.
 *
 * Web Bluetooth exposes no MTU, so this has to be found by trying. Measured
 * against a real Link printer: writes of 512 and 244 bytes are both dropped -
 * the packet simply goes unacknowledged - and 182 goes through, which puts the
 * printer's ATT MTU at 185. So 182 is where this starts rather than where it
 * ends up: probing above it cost two failed transfers on every connection and
 * never once succeeded.
 *
 * The rungs below it fall gently on purpose. 20 is the payload behind the 23 byte
 * MTU every BLE link must support and is the floor rather than the first step:
 * dropping straight to it turns a 60kB image into ~3000 writes, so a single
 * transient fault used to cost minutes a photo for the rest of the session.
 */
export const WRITE_SIZES = [182, 128, 20] as const

/** Where the pause between writes starts, and how far it may move. */
export const INITIAL_WRITE_DELAY = 15
export const MIN_WRITE_DELAY = 4
export const MAX_WRITE_DELAY = 200

/** How much of the pause a clean transfer earns back. */
const DECAY = 0.8

/** How much a failed transfer adds once there is no smaller write left to try. */
const BACK_OFF = 25

/**
 * Clean transfers needed before a smaller write is given up again.
 *
 * Not every failure that lands here is the link's fault, and the ones that are
 * may have passed. Without this the first fault of a session decided the write
 * size for every print after it.
 */
const RECOVER_AFTER = 3

/**
 * Split a packet into equal writes rather than a fixed stride with a remainder.
 *
 * A 911 byte packet cut at 182 ends in a write of a single byte - a whole round
 * trip, and its pause, for one byte. The same six writes spread evenly are 152
 * bytes each and cost the same, so nothing is gained by the ragged tail.
 */
export function writeStride(total: number, maxWrite: number): number {
	if (total <= 0 || maxWrite <= 0) return Math.max(total, 1)
	const writes = Math.ceil(total / maxWrite)
	return Math.ceil(total / writes)
}

/**
 * The write size and pause to use, carried across transfers on one connection.
 *
 * A printer that took 512 byte writes for the first image will take them for the
 * second, and one that needed a longer pause still needs it, so what was learned
 * the hard way is not thrown away between prints.
 */
export class TransferTuning {
	private sizeIndex = 0
	private delay: number = INITIAL_WRITE_DELAY
	private cleanRuns = 0

	get writeSize(): number {
		return WRITE_SIZES[this.sizeIndex]
	}

	get writeDelay(): number {
		return this.delay
	}

	/**
	 * A transfer went through without a retry, so ease off the pause a little, and
	 * after a run of them try the larger write once more.
	 */
	succeeded(): void {
		this.delay = Math.max(MIN_WRITE_DELAY, Math.round(this.delay * DECAY))

		if (this.sizeIndex === 0) return

		// enough has gone right to be worth trying the larger write again
		if (++this.cleanRuns >= RECOVER_AFTER) {
			this.cleanRuns = 0
			this.sizeIndex--
		}
	}

	/**
	 * A transfer failed. Try a smaller write first, since an oversized write is
	 * the one thing here that fails outright rather than merely too fast, and only
	 * lengthen the pause once there is no smaller write left.
	 *
	 * Returns false when there is nothing further to try.
	 */
	backOff(): boolean {
		this.cleanRuns = 0

		if (this.sizeIndex < WRITE_SIZES.length - 1) {
			this.sizeIndex++
			return true
		}

		this.delay += BACK_OFF
		return this.delay <= MAX_WRITE_DELAY
	}
}
