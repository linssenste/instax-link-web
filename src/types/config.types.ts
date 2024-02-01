export interface STATE_CONFIG {
	width: number;
	height: number;
	theme: string;

	connection: boolean, 
	connect: () => Promise<void>,
	disconnect: () => Promise<void>;
}


export interface PRINTER_STATUS_BATTERY {
	
		charging: boolean, 
		level: null | number
	
}
export interface PRINTER_STATUS  {
	battery: PRINTER_STATUS_BATTERY, 
	polaroids: {
		width: 600 | 800 | 1240;
		height: 800 | 840; 
		stack: number | null
	}, 
	serialNumber: string
}



export interface PRINTING_IMAGE_QUEUE {
	base64: string; 
	quantity: number, 
	state: number, 
	progress: number, 
	abortController: null | AbortController
}