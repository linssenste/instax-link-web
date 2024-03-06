export interface QueueImage {
	quantity: number,
	base64: string,
	state: number,
	progress: number,
	abortController?: null | AbortController
}