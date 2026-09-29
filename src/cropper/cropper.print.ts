
import type Konva from "konva";
import { InstaxFilmVariant } from "../interfaces/PrinterStateConfig";
import { PRINT_RESOLUTION } from "../polaroid/frame.geometry";
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
 
			success(result: Blob) {
				resolve(result)
			},
			error(err) {
				reject(err.message)
			},
		});

	});
}

export async function compressedImage(
	type: InstaxFilmVariant,
	image: Konva.Image,
	background: Konva.Rect,
	stage: Konva.Stage
): Promise<string> {
	return new Promise<string>(async (resolve, reject) => {
		try {

			const { width, height } = PRINT_RESOLUTION[type] ?? PRINT_RESOLUTION[InstaxFilmVariant.SQUARE];
 
			const pixelRatio = stage.width() > 0 ? (width / stage.width()) : 2;

			const canvasUrl = stage.toDataURL({ pixelRatio });

			const canvasImageBlob = await fetch(canvasUrl).then(res => res.blob());

			const file = new File([canvasImageBlob], "compressed-image.jpeg", { type: "image/jpeg" });
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

				resolve(reader.result as string);
			};
			reader.readAsDataURL(result);
		} catch (error) {
			reject(error);
		}
	});
}
