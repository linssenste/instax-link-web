
import type Konva from "konva";
import { InstaxFilmVariant } from "../interfaces/PrinterStateConfig";
import { PRINT_RESOLUTION } from "../polaroid/frame.geometry";
import Compressor from 'compressorjs';
import type { CompressResponse } from './compress.worker';


async function compressFile(file: Blob, width: number, height: number, rate: number): Promise<Blob> {
	return new Promise<Blob>(async (resolve, reject) => {

		new Compressor(file, {
			quality: rate,
			width: width,
			minWidth: width,
			maxWidth: width,

			height: height,
			minHeight: height,
			maxHeight: height,
 
			success(result: Blob) {
				resolve(result)
			},
			error(err) {
				reject(err.message)
			},
		});

	});
}

const MAX_PRINT_BYTES = 1024 * 60;

// Rasterising the stage has to happen here, on the canvas the browser owns, but
// the quality search that follows is pure pixel work and does not.
function canOffloadCompression(): boolean {
	return typeof Worker !== 'undefined'
		&& typeof OffscreenCanvas !== 'undefined'
		&& typeof createImageBitmap === 'function';
}

let compressionWorker: Worker | null = null;
let requestId = 0;

function getCompressionWorker(): Worker {
	if (compressionWorker == null) {
		compressionWorker = new Worker(new URL('./compress.worker.ts', import.meta.url), { type: 'module' });
	}
	return compressionWorker;
}

function compressInWorker(worker: Worker, bitmap: ImageBitmap, width: number, height: number): Promise<string> {
	return new Promise<string>((resolve, reject) => {
		const id = ++requestId;

		const stopListening = () => {
			worker.removeEventListener('message', onMessage);
			worker.removeEventListener('error', onFailure);
			worker.removeEventListener('messageerror', onFailure);
		};

		const onMessage = (event: MessageEvent<CompressResponse>) => {
			if (event.data.id !== id) return;
			stopListening();

			if (event.data.dataUrl != null) resolve(event.data.dataUrl);
			else reject(new Error(event.data.error ?? 'Compression failed'));
		};

		// a worker that fails to start, or a reply that cannot be deserialised,
		// would otherwise leave this promise pending and the editor stuck loading
		const onFailure = () => {
			stopListening();
			compressionWorker = null;
			reject(new Error('The compression worker stopped responding'));
		};

		worker.addEventListener('message', onMessage);
		worker.addEventListener('error', onFailure);
		worker.addEventListener('messageerror', onFailure);
		worker.postMessage({ id, bitmap, width, height, maxSize: MAX_PRINT_BYTES }, [bitmap]);
	});
}

export async function compressedImage(
	type: InstaxFilmVariant,
	image: Konva.Image,
	background: Konva.Rect,
	stage: Konva.Stage
): Promise<string> {
	const { width, height } = PRINT_RESOLUTION[type] ?? PRINT_RESOLUTION[InstaxFilmVariant.SQUARE];
	const pixelRatio = stage.width() > 0 ? (width / stage.width()) : 2;

	if (canOffloadCompression()) {
		// only the handover may fall back: once the worker has the job, whatever it
		// reports is the answer, successful or not
		let worker: Worker | null = null;
		let bitmap: ImageBitmap | null = null;

		try {
			worker = getCompressionWorker();
			bitmap = await createImageBitmap(stage.toCanvas({ pixelRatio }));
		} catch (error) {
			bitmap?.close();
			console.warn('> compression worker unavailable, falling back to the main thread', error);
		}

		if (worker != null && bitmap != null) return compressInWorker(worker, bitmap, width, height);
	}

	return compressOnMainThread(stage, width, height, pixelRatio);
}

function compressOnMainThread(
	stage: Konva.Stage,
	width: number,
	height: number,
	pixelRatio: number
): Promise<string> {
	return new Promise<string>(async (resolve, reject) => {
		try {

			const canvasUrl = stage.toDataURL({ pixelRatio });

			const canvasImageBlob = await fetch(canvasUrl).then(res => res.blob());

			const file = new File([canvasImageBlob], "compressed-image.jpeg", { type: "image/jpeg" });
			const maxSize = MAX_PRINT_BYTES;

			let minQuality = 0, maxQuality = 1, quality = 0.5;
			let result = null;

			while (minQuality <= maxQuality) {
				quality = (minQuality + maxQuality) / 2;
				result = await compressFile(file, width, height, quality);

				if (result.size > maxSize) {
					maxQuality = quality - 0.01;
				} else {
					if (maxQuality - minQuality < 0.02) break
					minQuality = quality + 0.01;
				}
			}

			if (!result || result.size > (maxSize + 5000)) {
				reject('Unable to compress image below target size');
				return;
			}

			// console.log(result.width(), result.height())
			const reader = new FileReader();
			reader.onloadend = () => {

				resolve(reader.result as string);
			};
			reader.readAsDataURL(result);
		} catch (error) {
			reject(error);
		}
	});
}
