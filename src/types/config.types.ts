export interface STATE_CONFIG {
	type: FilmSize,
	
	connection: boolean, 
	connect: () => Promise<void>,
	disconnect: () => Promise<void>;
}


export interface PRINTER_STATUS_BATTERY {
	
		charging: boolean, 
		level: null | number
	
}

export enum FilmSize {
    MINI = "mini",
    SQUARE = "square",
    LARGE = "large",
}
export interface PRINTER_STATUS  {

	type: FilmSize,
	
	battery: PRINTER_STATUS_BATTERY, 
	polaroidCount: number | null
}



export interface PRINTING_IMAGE_QUEUE {
	base64: string; 
	quantity: number, 
	state: number, 
	progress: number, 
	abortController: null | AbortController
}