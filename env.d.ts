/// <reference types="vite/client" />
/// <reference types="web-bluetooth" />

declare module 'merge-images' {
	interface MergeImagesSource {
		src: string
		x?: number
		y?: number
		opacity?: number
	}

	interface MergeImagesOptions {
		format?: string
		quality?: number
		width?: number
		height?: number
		crossOrigin?: string
	}

	export default function mergeImages(
		sources: Array<string | MergeImagesSource>,
		options?: MergeImagesOptions
	): Promise<string>
}
