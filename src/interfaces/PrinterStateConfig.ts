
export enum InstaxFilmVariant {

	MINI = "mini",
	SQUARE = "square",
	WIDE = "wide",
}


export interface PrinterBatteryStatus {
	charging: boolean,
	level: null | number
}


export interface PrinterStatus {

	type: InstaxFilmVariant | null,

	battery: PrinterBatteryStatus,
	polaroidCount: number | null,

	/**
	 * The printer's own state bytes, kept for diagnosis only.
	 *
	 * Measured on a Link printer: `00 00 0c 00 00 00 00` while it is happy, and
	 * `f4 f0 0c 00 00 00 10` once it has failed to feed. Nothing decides anything
	 * on them, and nothing should without knowing what they mean - bytes 1 and 2
	 * are a 16-bit reading that drifts between polls, so treating the set as a
	 * fingerprint for "the film changed" fired on virtually every read. Byte 7
	 * looks like a fault flag but that rests on a single observation.
	 */
	filmState: string | null
}


export interface PrinterStateConfig {
	type: InstaxFilmVariant,

	connection: boolean,

	/**
	 * Something the printer reported has gone wrong and has not yet been put right.
	 *
	 * Lives here rather than being threaded down as a prop because the config is
	 * already handed to every part of the printer panel, on both layouts.
	 */
	fault: boolean,

	/**
	 * The printer is getting itself ready and cannot take an image yet.
	 *
	 * Its own doing rather than anything wrong, so it is shown as a state the
	 * printer is in rather than as a failure.
	 */
	preparing: boolean,
	connect: () => Promise<void>,
	disconnect: () => Promise<void>;
	status?: PrinterStatus | null
}
