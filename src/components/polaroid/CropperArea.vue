<template>
	<div id="cropper-area">

		<div id="container" class="container" />

		<div v-if="!loading" v-on:click="removeImage()" class="remove-button"><img draggable="false" alt="close icon"
				 src="@/assets/icons/controls/xmark.svg" width="16" height="16" /></div>

		<div class="center-cross" v-if="!loading">
			<div class="cross-element" id="cross-element-horizontal" />
			<div class="cross-element" id="cross-element-vertical" />
		</div>
	</div>
</template>
  
<script lang="ts" setup>

import Konva from 'konva';
import { onMounted, watch } from 'vue';
import { type PrinterStateConfig } from '../../interfaces/PrinterStateConfig';

import { downloadPolaroid } from '../../cropper/cropper.download';
import { compressedImage } from '../../cropper/cropper.print'

const emit = defineEmits(['save', 'remove-image']);

const props = defineProps<{
	src: string,
	loading: boolean;
	config: PrinterStateConfig
	settings: {
		rotation: number,
		color: string,
		text?: string;
	}
}>();


let stage: Konva.Stage | null = null;
let layer: Konva.Layer | null = null;
let image: Konva.Image | null = null;
let backgroundRect: Konva.Rect | null = null;


onMounted(() => {
	const containerDoc = document.getElementById('container') as HTMLDivElement;
	const containerRect = containerDoc?.getBoundingClientRect();

	if (containerRect == null) return;

	Konva.hitOnDragEnabled = true;

	// create stage
	stage = new Konva.Stage({
		container: containerDoc,
		width: containerRect.width,
		height: containerRect.height,
		draggable: true
	});

	layer = new Konva.Layer();
	stage.add(layer);


	// load image & add to stage
	const konvaImage = new window.Image();

	konvaImage.onload = () => {

		// fit image into stage
		const { width, height } = getRotatedBoundingBox(konvaImage);
		const containerRatio = stage.width() / stage.height();

		fitImage(konvaImage, { width, height }, ((width / height) < containerRatio));

		// add image into stage
		if (layer && image) {
			layer.add(image);
			addCanvasListeners(); // initialize image/stage event listeners
		}

	};

	konvaImage.src = props.src;
});



// calculate the rotated bounding box dimensions
const getRotatedBoundingBox = (img: HTMLImageElement) => {
	const radians = props.settings.rotation * Math.PI / 180;

	const cos = Math.abs(Math.cos(radians));
	const sin = Math.abs(Math.sin(radians));

	return {
		width: img.width * cos + img.height * sin,
		height: img.width * sin + img.height * cos
	};
};


const fitImage = (img: HTMLImageElement, boundingBox: { width: number, height: number }, horizontally: boolean): void => {
	if (!stage || !layer) return;

	// remove existing image
	layer.removeChildren();

	stage.scale({ x: 1, y: 1 }); // Update stage scale
	stage.position({ x: 0, y: 0 }); // Reset stage position

	// calculate scaling
	const scale = (horizontally ? (stage.width() / boundingBox.width) : (stage.height() / boundingBox.height)) ?? 1;

	// create new image object and scale
	image = new Konva.Image({
		x: stage.width() / 2,
		y: stage.height() / 2,
		image: img,
		scaleX: scale,
		scaleY: scale,
		draggable: false,
		rotation: props.settings.rotation || 0,
	});

	image.offsetX(img.width / 2);
	image.offsetY(img.height / 2);

	backgroundRect = new Konva.Rect({
		x: 0,
		y: 0,
		width: stage.width(),
		height: stage.height(),
		fill: props.settings.color ?? '#FFFFFF',
	});




	layer.add(backgroundRect);
	layer.add(image);


};


function fit(horizontal: boolean): void {
	if (!image || !layer) return
	const boundingBox = getRotatedBoundingBox(image.attrs.image)
	fitImage(image.attrs.image, boundingBox, horizontal);
};


async function saveCanvasImage(printable = true): Promise<string> {
	return new Promise<string>(async (resolve, reject) => {
		if (!stage || !image || !backgroundRect) reject(null)
		else {

			if (!printable) {
				// TODO: error handling?
				const polaroidImage = await downloadPolaroid(props.config.type, props.settings.text, image, backgroundRect, stage);
				resolve(polaroidImage);

			}

			else {

				const compressedCanvasImage = await compressedImage(props.config.type, image, backgroundRect, stage);
				console.log(compressedCanvasImage)
				// TODO: error handling?
				resolve(compressedCanvasImage as string)
			}
		}
	});

}


defineExpose({ fit, saveCanvasImage });


const resetBackgroundRect = () => {
	if (backgroundRect == null) return;
	backgroundRect.absolutePosition({ x: 0, y: 0 });
	backgroundRect.scaleX(1 / stage.scaleX());
	backgroundRect.scaleY(1 / stage.scaleY());

}

function setCenterCross(id: string, idle = true, vertical) {
	const doc = document.getElementById(id);

	if (!idle) {
		doc.style[!vertical ? 'height' : 'width'] = '100%'
		doc.style.backgroundColor = 'var(--dynamic-bg-color)';
		doc.style.zIndex = '5';
	} else {
		doc.style[!vertical ? 'height' : 'width'] = '20px'
		doc.style.backgroundColor = 'white';
		doc.style.zIndex = '1';
	}

}
let timeoutSnapX, timeoutSnapY = null;
function checkAndSnap() {
	// The center of the stage in the stage's coordinate space
	const stageCenterX = (stage.width() / 2 - stage.x()) / stage.scaleX();
	const stageCenterY = (stage.height() / 2 - stage.y()) / stage.scaleY();

	// The center of the image in the stage's coordinate space
	const imageCenterX = image.x();
	const imageCenterY = image.y();

	// Snap threshold adjusted for stage scale
	const threshold = 5 / stage.scaleX();

	const deltaX = Math.abs(stageCenterX - imageCenterX);
	const deltaY = Math.abs(stageCenterY - imageCenterY);

	clearTimeout(timeoutSnapX)
	clearTimeout(timeoutSnapY)


	// Check if the image center is within the threshold distance of the stage center
	if (deltaX <= threshold) {
		// Adjust stage.x() to snap image's center to the stage's center
		const snapXPosition = stage.width() / 2 - imageCenterX * stage.scaleX();
		stage.x(snapXPosition);


		setCenterCross("cross-element-horizontal", false, false)

		timeoutSnapX = setTimeout(() => {
			setCenterCross("cross-element-horizontal", true, false)
		}, 350);
	} else {
		setCenterCross("cross-element-horizontal", true, false)
	}
	if (deltaY <= threshold) {
		// Adjust stage.y() to snap image's center to the stage's center
		const snapYPosition = stage.height() / 2 - imageCenterY * stage.scaleY();
		stage.y(snapYPosition);

		setCenterCross("cross-element-vertical", false, true)

		timeoutSnapY = setTimeout(() => {
			setCenterCross("cross-element-vertical", true, true)
		}, 350);
	} else {
		setCenterCross("cross-element-vertical", true, true)
	}



	layer.batchDraw();
}

const addCanvasListeners = () => {
	// stage.on('transformend', updateHelperLines); // Update lines on transformation end
	// window.addEventListener('resize', updateHelperLines); // Update lines on window resize

	stage.on('dragmove', resetBackgroundRect);
	stage.on('dragmove', () => {
		checkAndSnap();
	});




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
	});

	let lastCenter: any = null;
	let lastDist = 0;
	let dragStopped = false;

	// Multi-touch zoom functionality
	stage.on('touchmove', (e) => {


		e.evt.preventDefault();
		const touch1 = e.evt.touches[0];
		const touch2 = e.evt.touches[1];

		if (touch1 && !touch2 && !stage.isDragging() && dragStopped) {
			stage.startDrag();
			dragStopped = false;
		}

		if (touch1 && touch2) {

			if (stage.isDragging()) {
				dragStopped = true;
				stage.stopDrag();
			}

			const p1 = {
				x: touch1.clientX,
				y: touch1.clientY,
			};
			const p2 = {
				x: touch2.clientX,
				y: touch2.clientY,
			};

			if (!lastCenter) {
				lastCenter = getCenter(p1, p2);
				return;
			}
			const newCenter = getCenter(p1, p2);

			const dist = getDistance(p1, p2);

			if (!lastDist) {
				lastDist = dist;
			}

			// local coordinates of center point
			const pointTo = {
				x: (newCenter.x - stage.x()) / stage.scaleX(),
				y: (newCenter.y - stage.y()) / stage.scaleX(),
			};

			const scale = stage.scaleX() * (dist / lastDist);

			stage.scaleX(scale);
			stage.scaleY(scale);

			// calculate new position of the stage
			const dx = newCenter.x - lastCenter.x;
			const dy = newCenter.y - lastCenter.y;

			const newPos = {
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
	emit('remove-image');

}

function setBackgroundColor(): void {
	const color = props.settings.color ?? '#FFFFFF';

	backgroundRect.fill(color)

	const doc = document.getElementById("polaroid-frame");
	if (doc) doc.style.backgroundColor = color;
}

watch(() => props.settings.rotation, (newVal, oldVal) => {
	image.rotate((newVal - oldVal))
})

watch([() => props.settings.color, () => props.src], setBackgroundColor);


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
	background-color: var(--light-grey-color);
	transform: translate(-50%, -50%);
	z-index: 2;
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
}
</style>
