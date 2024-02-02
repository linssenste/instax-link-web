
export interface QueueImage {
	
	base64: string;
	quantity: number,
	state: number,
	progress: number,
	abortController?: AbortController | null; 

}

