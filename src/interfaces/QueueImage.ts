export interface QueueImage {
	quantity: number,
	base64: string,
	state: 0 | 1 | 2,
	progress: number,
	abortController?: null | AbortController
}