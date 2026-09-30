/**
 * Why a print did not happen.
 *
 * The printer answers the print command before it has tried to feed a sheet, so
 * "the command was accepted" and "a photo came out" are not the same thing. An
 * empty pack that the counter still believes in is exactly that gap: the command
 * is taken, the feed fails, and the printer blinks at you while the app carries
 * on as though it had printed.
 */
export type PrintFailure =
	/** the printer turned the print command down outright */
	| 'refused'
	/** the printer reported a fault of its own while printing */
	| 'reported'
	/** the print ran, but the printer is no further through the pack than before */
	| 'not-printed'
	/** the printer stopped answering */
	| 'silent'

export class InstaxPrintError extends Error {
	readonly reason: PrintFailure

	/** the printer's own status byte, where one came back */
	readonly status: number | null

	/** whatever else came with it, so an unrecognised fault is still reportable */
	readonly payload: number[]

	constructor(reason: PrintFailure, message: string, status: number | null = null, payload: number[] = []) {
		super(message)
		this.name = 'InstaxPrintError'
		this.reason = reason
		this.status = status
		this.payload = payload
	}

	/**
	 * What the printer actually said, in hex.
	 *
	 * Empty when it said nothing beyond refusing to print - a fault worked out
	 * from the film count has no bytes of its own - so the caller can leave the
	 * line out rather than show an empty one.
	 */
	get bytes(): string {
		const parts: string[] = []
		if (this.status != null) parts.push(`status 0x${this.status.toString(16).padStart(2, '0')}`)
		if (this.payload.length > 0) {
			parts.push(`payload ${this.payload.map((byte) => byte.toString(16).padStart(2, '0')).join(' ')}`)
		}
		return parts.join(' · ')
	}

	/** The same, named, for a log where there is nothing else to say which fault it was. */
	get detail(): string {
		const bytes = this.bytes
		return bytes.length > 0 ? `reason ${this.reason} · ${bytes}` : `reason ${this.reason}`
	}
}

export function isPrintError(error: unknown): error is InstaxPrintError {
	return error instanceof InstaxPrintError
}
