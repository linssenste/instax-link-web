

export interface PRINTER_STATUS_BATTERY {
	
		charging: boolean, 
		level: null | number
	
}

export enum InstaxFilmType {
    MINI = "mini",
    SQUARE = "square",
    LARGE = "large",
}
export interface PRINTER_STATUS  {

	type: InstaxFilmType,
	
	battery: PRINTER_STATUS_BATTERY, 
	polaroidCount: number | null
}



export interface PRINTING_IMAGE_QUEUE {
	base64: string; 
	quantity: number, 
	state: number, 
	progress: number, 
	abortController?: null | AbortController
}


export interface STATE_CONFIG {
	type: InstaxFilmType,
	
	connection: boolean, 
	connect: () => Promise<void>,
	disconnect: () => Promise<void>;
	status?: PRINTER_STATUS | null
}
