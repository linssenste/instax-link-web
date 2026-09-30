
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
	 * The printer's own state bytes, as an opaque fingerprint.
	 *
	 * Only ever compared with a previous reading: a change here means something
	 * about the film has changed - a pack in or out, a fault cleared - which the
	 * shot count alone does not report, because an empty pack that has been
	 * reseated still counts a full one.
	 */
	filmState: string | null
}


export interface PrinterStateConfig {
	type: InstaxFilmVariant,

	connection: boolean,
	connect: () => Promise<void>,
	disconnect: () => Promise<void>;
	status?: PrinterStatus | null
}
