<template>
	<div id="cropper-area">
		<div ref="container" class="container"></div>

		<div class="center-cross">
			<!-- :style="`background-color: var(--${config.theme}-color);`" -->
			<div class="cross-element">
			</div>
			<div  class="cross-element">
			</div>
		</div>
	</div>
</template>
  
<script lang="ts" setup>
import Konva from 'konva';
import ImageCompressor from 'image-compressor.js';
import { onMounted, ref, watch } from 'vue';

const emit = defineEmits(['save'])
const props = defineProps<{
	image: string,
	config: {
		width: number,
		height: number,
		theme: string
	},
	settings: {
		rotation: number,
		color: string
	}
}>();

const backgroundRect: any = ref(null)
let container: any = null
let stage, layer: any = null;

let image: any = null;

const initStage = () => {
	const containerDoc = document.getElementById('cropper-area')
	const containerRect = containerDoc?.getBoundingClientRect();
	if (containerRect == null) return;

	Konva.hitOnDragEnabled = true;
	stage = new Konva.Stage({
		container: container,
		width: containerRect.width,
		height: containerRect.height,
		draggable: true
	});

	layer = new Konva.Layer();
	backgroundRect.value = new Konva.Rect({
		x: 0,
		y: 0,
		width: stage.width(),
		height: stage.height(),
		fill: props.settings.color,
		listening: false,
	});
	layer.add(backgroundRect.value);
	stage.add(layer);

	loadCanvasImage();
	addCanvasListeners();


	stage.getContainer().style.backgroundColor = props.settings.color ?? 'white';

	
};

const getRotatedBoundingBox = (konvaImage) => {
	const radians = props.settings.rotation * Math.PI / 180;
	const cos = Math.abs(Math.cos(radians));
	const sin = Math.abs(Math.sin(radians));
	return {
		width: konvaImage.width * cos + konvaImage.height * sin,
		height: konvaImage.width * sin + konvaImage.height * cos
	};
};

const loadCanvasImage = () => {
	const konvaImage = new window.Image();

	konvaImage.onload = () => {
		fitImage(konvaImage);
		layer.add(image);
	
	};
	konvaImage.src = props.image;


};





const fitImage = (konvaImage) => {

	const rotatedBoundingBox = getRotatedBoundingBox(konvaImage);

	const containerAspectRatio = stage.width() / stage.height();
	const imageAspectRatio = rotatedBoundingBox.width / rotatedBoundingBox.height;

	if ((imageAspectRatio < containerAspectRatio)) {
		fitImageHorizontally(konvaImage, rotatedBoundingBox);
	} else {
		fitImageVertically(konvaImage, rotatedBoundingBox);
	}
};

const fitImageHorizontally = (konvaImage, boundingBox) => {

	const scale = stage.width() / (boundingBox ?? konvaImage).width;
	updateStageAndImage(konvaImage, scale);
};

const fitImageVertically = (konvaImage, boundingBox) => {
	const scale = stage.height() / (boundingBox ?? konvaImage).height;
	updateStageAndImage(konvaImage, scale);
};



const updateStageAndImage = (konvaImage, scale) => {
	if (image) {
		layer.removeChildren(); // Clear existing image
	}

	stage.scale({ x: 1, y: 1 }); // Update stage scale
	stage.position({ x: 0, y: 0 }); // Reset stage position

	image = new Konva.Image({
		x: stage.width() / 2,
		y: stage.height() / 2,
		image: konvaImage,
		scaleX: scale,
		scaleY: scale,
		draggable: false,
		rotation: props.settings.rotation ?? 0
	});

	image.offsetX(konvaImage.width / 2);
	image.offsetY(konvaImage.height / 2);







	layer.add(image);
};


const fitVertically = () => {
	const rotatedBoundingBox = getRotatedBoundingBox(image.attrs.image);



	if (image) {
		fitImageVertically(image.attrs.image, rotatedBoundingBox);
		layer.draw();
	}
};

const fitHorizontally = () => {
	const rotatedBoundingBox = getRotatedBoundingBox(image.attrs.image);

	if (image) {
		fitImageHorizontally(image.attrs.image, rotatedBoundingBox);
		layer.draw();
	}
};

async function saveCanvasImage(): Promise<string> {
	return new Promise<string>((resolve, reject) => {
		const canvasUrl = stage.toDataURL();

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
	});
}



defineExpose({ fitVertically, saveCanvasImage, fitHorizontally });

const resetBackgroundRect = () => {
	if (backgroundRect.value == null) return;
	backgroundRect.value.absolutePosition({ x: 0, y: 0 });
	backgroundRect.value.scaleX(1 / stage.scaleX());
	backgroundRect.value.scaleY(1 / stage.scaleY());
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


watch(() => props.settings.color, () => {
	const color = props.settings.color ?? '#FFFFFF';
	stage.getContainer().style.backgroundColor = color;
	backgroundRect.value.fill(color)
});

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
</style>