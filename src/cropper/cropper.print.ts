
import { InstaxFilmVariant } from "../interfaces/PrinterStateConfig";
import Compressor from 'compressorjs';


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

			// The compression process is asynchronous,
			// which means you have to access the `result` in the `success` hook function.
			success(result: Blob) {
				resolve(result)
			},
			error(err) {
				reject(err.message)
			},
		});

	});
} export async function compressedImage(type, image, background, stage) {
	return new Promise(async (resolve, reject) => {
		try {

			const canvasUrl = stage.toDataURL({ pixelRatio: 2 });

			const canvasImageBlob = await fetch(canvasUrl).then(res => res.blob());

			const file = new File([canvasImageBlob], "compressed-image.jpeg", { type: "image/jpeg" });
			const width = ((type == InstaxFilmVariant.MINI ? 600 : (type == InstaxFilmVariant.SQUARE ? 800 : 1260)) ?? 800)
			const height = ((type == InstaxFilmVariant.MINI ? 800 : (type == InstaxFilmVariant.SQUARE ? 800 : 840)) ?? 800)
			const maxSize = 1024 * 60;

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

				const base64 = reader.result;
				resolve(base64);
			};
			reader.readAsDataURL(result);
		} catch (error) {
			reject(error);
		}
	});
}
