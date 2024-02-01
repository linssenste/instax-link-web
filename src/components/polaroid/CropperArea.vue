<template>
	<div id="cropper-area">
		<canvas hidden id="myCanvas" width="800" height="200" style="background: transparent;">
		</canvas>
		<div ref="container" class="container"></div>
		<div v-if="!loading" v-on:click="removeImage()" class="remove-button"><img draggable="false" alt="close icon" src="@/assets/icons/controls/xmark.svg" width="12" height="12"/></div>

		<div class="center-cross" v-if="!loading">
			<!-- :style="`background-color: var(--${config.theme}-color);`" -->
			<div class="cross-element">
			</div>
			<div class="cross-element">
			</div>
		</div>
	</div>
</template>
  
<script lang="ts" setup>
import Konva from 'konva';
import ImageCompressor from 'image-compressor.js';
import { onMounted, ref, watch } from 'vue';
import mergeImages from 'merge-images';



const emit = defineEmits(['save', 'remove-image']);

const props = defineProps<{
	image: string,
	loading: boolean;
	config: {
		width: number,
		height: number,
		theme: string
	},
	settings: {
		rotation: number,
		color: string,
		text?: string;
	}
}>();

let container: Konva.StageConfig | null = null;
let stage: Konva.Stage | null = null;
let layer: Konva.Layer | null = null;
let image: Konva.Image | null = null;
let backgroundRect: Konva.Rect | null = null;

const initStage = async () => {

	const containerDoc = document.getElementById('cropper-area')
	const containerRect = containerDoc?.getBoundingClientRect();

	if (containerRect == null) return;


	Konva.hitOnDragEnabled = true;

	// create stage
	stage = new Konva.Stage({
		container: container as any,
		width: containerRect.width,
		height: containerRect.height,
		draggable: true
	});

	layer = new Konva.Layer();
	stage.add(layer);

	// load polaroid
	loadCanvasImage();
	addCanvasListeners();



};



const loadCanvasImage = () => {
	const konvaImage = new window.Image();

	konvaImage.onload = () => {
		fitImage(konvaImage);
		if (layer && image) layer.add(image as Konva.Image);

	};
	konvaImage.src = props.image;


};

// Function to calculate the rotated bounding box dimensions

const getRotatedBoundingBox = (konvaImage) => {
	const radians = props.settings.rotation * Math.PI / 180;
	const cos = Math.abs(Math.cos(radians));
	const sin = Math.abs(Math.sin(radians));
	return {
		width: konvaImage.width * cos + konvaImage.height * sin,
		height: konvaImage.width * sin + konvaImage.height * cos
	};
};


// Function to fit the image within the stage
const fitImage = (konvaImage: Konva.Image): void => {
	if (!stage) return;

	const rotatedBoundingBox = getRotatedBoundingBox(konvaImage);

	const containerAspectRatio = stage.width() / stage.height();
	const imageAspectRatio = rotatedBoundingBox.width / rotatedBoundingBox.height;

	if (imageAspectRatio < containerAspectRatio) {
		fitImageHorizontally(konvaImage, rotatedBoundingBox);
	} else {
		fitImageVertically(konvaImage, rotatedBoundingBox);
	}
};

const fitImageHorizontally = (konvaImage: Konva.Image, boundingBox?: { width: number, height: number }): void => {
	if (!stage) return;

	const scale = stage.width() / (boundingBox?.width ?? konvaImage.width());
	updateStageImage(konvaImage, scale);
};

const fitImageVertically = (konvaImage: Konva.Image, boundingBox?: { width: number, height: number }): void => {
	if (!stage) return;

	const scale = stage.height() / (boundingBox?.height ?? konvaImage.height());
	updateStageImage(konvaImage, scale);
};


const updateStageImage = (konvaImage, scale) => {
	if (!stage || !layer) return;

	layer.removeChildren(); // Clear existing image


	stage.scale({ x: 1, y: 1 }); // Update stage scale
	stage.position({ x: 0, y: 0 }); // Reset stage position



	image = new Konva.Image({
		x: stage.width() / 2,
		y: stage.height() / 2,
		image: konvaImage,
		scaleX: scale,
		scaleY: scale,
		draggable: false,
		rotation: props.settings.rotation || 0,
	});


	image.offsetX(konvaImage.width / 2);
	image.offsetY(konvaImage.height / 2);

	backgroundRect = new Konva.Rect({
		x: 0,
		y: 0,
		width: stage.width(),
		height: stage.height(),
		fill: props.settings.color || '#FFFFFF',
		listening: false,
	});

	layer.add(backgroundRect);
	layer.add(image);

	// Redraw the layer to apply the filters
	layer.batchDraw();
};


const fitVertically = () => {
	const rotatedBoundingBox = getRotatedBoundingBox((image as Konva.Image).attrs.image);



	if (image && layer) {
		fitImageVertically(image.attrs.image, rotatedBoundingBox);
		layer.draw();
	}
};

const fitHorizontally = () => {
	const rotatedBoundingBox = getRotatedBoundingBox((image as Konva.Image).attrs.image);

	if (image && layer) {
		fitImageHorizontally(image.attrs.image, rotatedBoundingBox);
		layer.draw();
	}
};

async function saveCanvasImage(printable = true): Promise<string> {
	return new Promise<string>((resolve, reject) => {
		if (!stage || !image || !backgroundRect) reject(null)
		else {
	if (!printable) {
			const filterList = [
				Konva.Filters.Contrast,
				Konva.Filters.HSL,
				Konva.Filters.Brighten,
				Konva.Filters.Noise
			]
			// Apply filters
			image.filters(filterList);
			image.contrast(-1)
			image.saturation(-0.2)
			image.brightness(.05)
			image.noise(.1)
			image.cache();


			backgroundRect.filters(filterList)

			backgroundRect.contrast(-1)
			backgroundRect.saturation(-0.2)
			backgroundRect.brightness(.05)
			backgroundRect.noise(.1)
			backgroundRect.cache();
	}

			const canvasUrl = stage.toDataURL({ pixelRatio: !printable ? 2.4:  1 });

			console.log(canvasUrl)
			image.clearCache();
			image.filters([]);

			backgroundRect.filters([]);
			backgroundRect.clearCache();

	
			if (!printable) {

				function drawHelloWorld(canvas) {

					const ctx = canvas.getContext("2d");

					// Clear the canvas (optional, if you want to clear previous drawings)
					ctx.clearRect(0, 0, canvas.width, canvas.height);

					// Draw the transparent background
					ctx.fillStyle = "rgba(255, 150, 100, 0)"; // Transparent white background
					ctx.fillRect(0, 0, canvas.width, canvas.height);

					// Draw the text
					const text = props.settings.text ?? '';
					ctx.font = `${(Math.random() * 2) + 60}px biro_script_standardregular`;
					ctx.fillStyle = "rgba(0, 15, 85, .8)";

					// Calculate text width
					const textWidth = ctx.measureText(text).width;


					const x = (canvas.width - textWidth) / 2;
					const y = canvas.height / 2;
					const rotationAngle = (Math.random() * 2) - 1;

					ctx.save();
					ctx.translate(x + textWidth / 2, y);
					ctx.rotate((rotationAngle * Math.PI) / 180);


					ctx.fillText(text, -textWidth / 2, 0);
					ctx.restore();
				}

				const canvas = document.getElementById('myCanvas');
				if (!canvas) reject(null)
				drawHelloWorld(canvas);

				mergeImages([
					{ src: canvasUrl, x: props.config.width == 800 ? 28 : props.config.width == 600 ? 22 : 22, y: 40 },
					{ src: `/polaroids/export/${props.config.width == 800 ? 'square' : props.config.width == 600 ? 'mini' : 'large'}_scale.png`, x: 0, y: 0 },
					{ src: (canvas as HTMLCanvasElement).toDataURL('image/png'), x: 20, y: (Math.random() * 10) + 835 }
				])
					.then(b64 => resolve(b64));

			} else {

				fetch(canvasUrl)
					.then((res) => res.blob())
					.then((blob) => {
						const file = new File([blob], "compressed-image.jpeg", { type: "image/jpeg" });
						const compressor = new ImageCompressor();

						let isCompressed = false;
						let minQuality = 0;
						let maxQuality = 1;
						let compressedFile: Blob | null = null;
						let redoCounter = 0;

						const compressNext = async () => {
							const midQuality = (minQuality + maxQuality) / 2;

							const options = {
								maxWidth: props.config.width || 800,
								maxHeight: props.config.height || 800,
								minWidth: props.config.width || 800,
								minHeight: props.config.height || 800,
								quality: midQuality,
							};

							compressedFile = await compressor.compress(file, options);

							redoCounter += 1;

							if (compressedFile.size > 60 * 1024) {
								maxQuality = midQuality;
							} else {
								minQuality = midQuality;
							}

							if (maxQuality - minQuality < 0.01) {
								isCompressed = true;
							}

							if (!isCompressed && redoCounter < 50) {
								compressNext();
							} else {
								if (compressedFile === null) {
									reject(new Error("Compression failed"));
								} else {
									const reader = new FileReader();
									reader.onloadend = () => {
										const base64 = reader.result as string;
										resolve(base64);
									};
									reader.readAsDataURL(compressedFile);
								}
							}
						};

						compressNext();
					})
					.catch((error) => {
						reject(error);
					});
			}
		}
	});

}



defineExpose({ fitVertically, saveCanvasImage, fitHorizontally });

const resetBackgroundRect = () => {
	if (backgroundRect == null) return;
	backgroundRect.absolutePosition({ x: 0, y: 0 });
	backgroundRect.scaleX(1 / stage.scaleX());
	backgroundRect.scaleY(1 / stage.scaleY());
}

const addCanvasListeners = () => {


	stage.on('dragmove', resetBackgroundRect);


	// Wheel zoom functionality
	stage.on('wheel', (e) => {
		resetBackgroundRect()
		e.evt.preventDefault();
		const oldScale = stage.scaleX();
		const pointer = stage.getPointerPosition();

		const mousePointTo = {
			x: (pointer.x - stage.x()) / oldScale,
			y: (pointer.y - stage.y()) / oldScale,
		};

		const newScale = e.evt.deltaY > 0 ? oldScale * 0.95 : oldScale * 1.05;
		stage.scale({ x: newScale, y: newScale });

		const newPos = {
			x: pointer.x - mousePointTo.x * newScale,
			y: pointer.y - mousePointTo.y * newScale,
		};
		stage.position(newPos);
		stage.batchDraw();
	});

	let lastCenter: any = null;
	let lastDist = 0;
	let dragStopped = false;

	// Multi-touch zoom functionality
	stage.on('touchmove', (e) => {
		e.evt.preventDefault();
		var touch1 = e.evt.touches[0];
		var touch2 = e.evt.touches[1];

		if (touch1 && !touch2 && !stage.isDragging() && dragStopped) {
			stage.startDrag();
			dragStopped = false;
		}

		if (touch1 && touch2) {

			if (stage.isDragging()) {
				dragStopped = true;
				stage.stopDrag();
			}

			var p1 = {
				x: touch1.clientX,
				y: touch1.clientY,
			};
			var p2 = {
				x: touch2.clientX,
				y: touch2.clientY,
			};

			if (!lastCenter) {
				lastCenter = getCenter(p1, p2);
				return;
			}
			var newCenter = getCenter(p1, p2);

			var dist = getDistance(p1, p2);

			if (!lastDist) {
				lastDist = dist;
			}

			// local coordinates of center point
			var pointTo = {
				x: (newCenter.x - stage.x()) / stage.scaleX(),
				y: (newCenter.y - stage.y()) / stage.scaleX(),
			};

			var scale = stage.scaleX() * (dist / lastDist);

			stage.scaleX(scale);
			stage.scaleY(scale);

			// calculate new position of the stage
			var dx = newCenter.x - lastCenter.x;
			var dy = newCenter.y - lastCenter.y;

			var newPos = {
				x: newCenter.x - pointTo.x * scale + dx,
				y: newCenter.y - pointTo.y * scale + dy,
			};

			stage.position(newPos);

			lastDist = dist;
			lastCenter = newCenter;
		}
	});

	stage.on('touchend', () => {
		lastDist = 0;
		lastCenter = null;
	});
};


const getDistance = (p1, p2) => {
	return Math.sqrt(Math.pow(p2.x - p1.x, 2) + Math.pow(p2.y - p1.y, 2));
};

const getCenter = (p1, p2) => {
	return {
		x: (p1.x + p2.x) / 2,
		y: (p1.y + p2.y) / 2,
	};
};


function removeImage(): void {
	emit('remove-image')
}

watch(() => props.settings.color, () => {
	setBackgroundColor()
});


watch(() => props.image, () => {
	setBackgroundColor();
})
function setBackgroundColor(): void {
	const color = props.settings.color ?? '#FFFFFF';

	stage.getContainer().style.backgroundColor = color;
	backgroundRect.fill(color)


	let doc = document.getElementById("polaroid-frame");
	if (!doc) return;
	doc.style.backgroundColor = color;
}
watch(() => props.settings.rotation, (newVal, oldVal) => {
	image.rotate((newVal - oldVal))
})


onMounted(initStage);
</script>

<style scoped>
#cropper-area {
	position: relative;
	width: 100%;
	height: 100%;

}

.container {
	width: 100%;
	height: 100%;
}

.cross-element {
	position: absolute;
	top: 50%;
	left: 50%;
	background-color: white;
	transform: translate(-50%, -50%);
	z-index: 10;
}

.cross-element:first-of-type {
	width: 2px;
	border-radius: 2px;
	height: 20px;
}


.cross-element:last-of-type {
	width: 20px;
	border-radius: 2px;
	height: 2px;
}

.center-cross {
	opacity: .75;
	z-index: 10
}

.remove-button {
	position: absolute;
	top: 10px;
	right: 10px;
	background-color: #e0e0e0cc;
	width: 30px;
	height: 30px;
	border-radius: 50%;
	cursor: pointer;
	transition: background-color 150ms linear;
}

.remove-button:hover {
	background-color: #e0e0e0;

}

.remove-button:hover img {
	opacity: 1;
}

.remove-button img {
	opacity: .75;


	position: absolute;
	top: 50%;
	left: 50%;
	transform: translate(-50%, -50%);

	-moz-user-select: none;
	-webkit-user-select: none;
	user-select: none;
}</style>