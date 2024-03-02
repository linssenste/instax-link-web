import Konva from "konva";
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
}
export async function compressedImage(type: InstaxFilmVariant, stage: Konva.Stage) {
	return new Promise<string>(async (resolve, reject) => {

		try {

			const canvasUrl = stage.toDataURL({ pixelRatio: 2 });

			const canvasImageBlob = await fetch(canvasUrl).then((res) => res.blob());


			const file = new File([canvasImageBlob], "compressed-image.jpeg", { type: "image/jpeg" });
			const width = ((type == InstaxFilmVariant.MINI ? 600 : (type == InstaxFilmVariant.SQUARE ? 800 : 1260)) ?? 800)
			const height = ((type == InstaxFilmVariant.MINI ? 800 : (type == InstaxFilmVariant.SQUARE ? 800 : 840)) ?? 800)


			let result: Blob | null = null;
			let redoCounter = 1;
			while (redoCounter <= 20 && (result == null || result.size > (1024 * 120))) {
				result = await compressFile(file, width, height, (.95 - ((redoCounter) * 0.025)))

				if (result.size <= (1024 * 120)) break;
				else redoCounter += 1;

			}

			if (result == null) throw new Error()
			const reader = new FileReader();
			reader.onloadend = () => {
				const base64 = reader.result as string;
				resolve(base64)

			};
			reader.readAsDataURL(result);

		} catch (error) {
			reject(error)
		}
	});

}