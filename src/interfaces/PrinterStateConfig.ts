
export enum InstaxFilmVariant {

	MINI = "mini",
	SQUARE = "square",
	LARGE = "large",
}


export interface PrinterBatteryStatus {
	charging: boolean,
	level: null | number
}


export interface PrinterStatus {

	type: InstaxFilmVariant,

	battery: PrinterBatteryStatus,
	polaroidCount: number | null
}


export interface PrinterStateConfig {
	type: InstaxFilmVariant,

	connection: boolean,
	connect: () => Promise<void>,
	disconnect: () => Promise<void>;
	status?: PrinterStatus | null
}
