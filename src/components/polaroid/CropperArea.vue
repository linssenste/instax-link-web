<template>
	<div id="cropper-area">
		<div ref="containerRef" class="container" />

		<button v-if="!loading" type="button" v-on:click="removeImage()" class="remove-button"
				data-testid="remove-image-button" aria-label="Remove image" title="Remove image"><img draggable="false"
				alt="" src="@/assets/icons/controls/xmark.svg" width="16" height="16" /></button>

		<!-- centre guides; they stretch and take the theme colour while the image
			 snaps to the middle of the frame -->
		<div class="center-cross" v-if="!loading">
			<div class="cross-element cross-x" :class="{ snapped: snappedX }" data-testid="cross-horizontal" />
			<div class="cross-element cross-y" :class="{ snapped: snappedY }" data-testid="cross-vertical" />
		</div>
	</div>
</template>

<script lang="ts" setup>

import Konva from 'konva';
import { onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { type PrinterStateConfig } from '../../interfaces/PrinterStateConfig';

import { downloadPolaroid } from '../../cropper/cropper.download';
import { compressedImage } from '../../cropper/cropper.print'

const emit = defineEmits(['save', 'remove-image']);

const props = withDefaults(defineProps<{
	src: string,
	loading: boolean;
	config: PrinterStateConfig
	settings: {
		rotation: number,
		color: string,
		text?: string;
	}
	/**
	 * How far the surrounding frame is scaled down. The canvas follows the frame,
	 * so the export has to scale back up to full resolution.
	 */
	displayScale?: number;
}>(), { displayScale: 1 });

type Point = { x: number, y: number };

const MIN_ZOOM = 0.25;
const MAX_ZOOM = 5.0;

const containerRef = ref<HTMLDivElement | null>(null);

// whether the image currently sits on the horizontal / vertical centre line
const snappedX = ref(false);
const snappedY = ref(false);

// keep wheel and pinch zoom within the same bounds
const clampZoom = (scale: number) => Math.max(MIN_ZOOM, Math.min(scale, MAX_ZOOM));

let stage: Konva.Stage | null = null;
let layer: Konva.Layer | null = null;
let image: Konva.Image | null = null;
let backgroundRect: Konva.Rect | null = null;

// the decoded source, kept so the image can be re-fitted at any time
let sourceImage: HTMLImageElement | null = null;

// last known container box, used to rescale the framing when the box changes
let containerSize = { width: 0, height: 0 };
let resizeObserver: ResizeObserver | null = null;
let resizeTimer: ReturnType<typeof setTimeout> | undefined;


// the container is sized by CSS (aspect-ratio per film type + fluid width), so
// every layout change - window resize, film type switch, settings panel - is
// observed on the element itself rather than guessed from window events
function syncStageToContainer(): void {
	if (!stage || !layer || !containerRef.value) return;

	const { width, height } = containerRef.value.getBoundingClientRect();
	if (width <= 0 || height <= 0) return;

	const previous = containerSize;
	containerSize = { width, height };

	// first usable measurement: nothing to preserve, but an image that arrived
	// before the container had a box still needs its initial fit
	if (previous.width <= 0 || previous.height <= 0) {
		stage.width(width);
		stage.height(height);

		if (refitSourceImage()) addCanvasListeners();
		else resizeBackgroundRect();

		layer.batchDraw();
		return;
	}

	// ignore sub-pixel jitter
	if (Math.abs(previous.width - width) < 0.5 && Math.abs(previous.height - height) < 0.5) return;

	const ratioX = width / previous.width;
	const ratioY = height / previous.height;

	// zoom has to stay uniform, so take the smaller factor: the framing shrinks
	// with the container instead of overflowing it
	const zoomRatio = Math.min(ratioX, ratioY);

	const position = stage.position();

	stage.width(width);
	stage.height(height);
	stage.scale({ x: stage.scaleX() * zoomRatio, y: stage.scaleY() * zoomRatio });
	stage.position({ x: position.x * ratioX, y: position.y * ratioY });

	resizeBackgroundRect();
	layer.batchDraw();
}


// observe the container box; fall back to window resize where
// ResizeObserver is unavailable
function observeContainer(): void {
	if (!containerRef.value) return;

	if (typeof ResizeObserver !== 'undefined') {
		resizeObserver = new ResizeObserver(() => {
			clearTimeout(resizeTimer);
			resizeTimer = setTimeout(syncStageToContainer, 50); // debounce to minimize redraws
		});
		resizeObserver.observe(containerRef.value);
		return;
	}

	window.addEventListener('resize', onWindowResize);
}

function onWindowResize(): void {
	clearTimeout(resizeTimer);
	resizeTimer = setTimeout(syncStageToContainer, 50);
}


// cover the stage with the source image at its current rotation. Returns false
// while the stage has no box yet, in which case the sync retries once it has one
function refitSourceImage(): boolean {
	if (!stage || !sourceImage) return false;
	if (stage.width() <= 0 || stage.height() <= 0) return false;

	const { width, height } = getRotatedBoundingBox(sourceImage);
	const containerRatio = stage.width() / stage.height();

	fitImage(sourceImage, { width, height }, ((width / height) < containerRatio));
	return image != null;
}


// (re)load the source image into the stage
function loadImage(src: string): void {
	const konvaImage = new window.Image();

	konvaImage.onload = () => {
		sourceImage = konvaImage;
		if (!stage || !layer) return;

		// fitImage places the image and its background on the layer
		if (refitSourceImage()) addCanvasListeners(); // initialize event listeners
	};

	konvaImage.src = src;
}


onMounted(() => {
	const containerDoc = containerRef.value;
	if (containerDoc == null) return;

	const containerRect = containerDoc.getBoundingClientRect();

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

	containerSize = { width: containerRect.width, height: containerRect.height };

	loadImage(props.src);
	observeContainer();
});


onBeforeUnmount(() => {
	clearTimeout(resizeTimer);
	clearTimeout(timeoutSnapX);
	clearTimeout(timeoutSnapY);

	resizeObserver?.disconnect();
	resizeObserver = null;
	window.removeEventListener('resize', onWindowResize);

	stage?.destroy();
	stage = null;
	listenersAttached = false;
	layer = null;
	image = null;
	backgroundRect = null;
	sourceImage = null;
});


// reload whenever a different image is selected without the component
// being torn down in between
watch(() => props.src, (src) => {
	if (!stage || !layer) return;
	layer.removeChildren();
	image = null;
	backgroundRect = null;
	sourceImage = null;
	loadImage(src);
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
	if (boundingBox.width <= 0 || boundingBox.height <= 0) return;

	// remove existing image
	layer.removeChildren();

	stage.scale({ x: 1, y: 1 }); // Update stage scale
	stage.position({ x: 0, y: 0 }); // Reset stage position

	// calculate scaling
	const scale = horizontally ? (stage.width() / boundingBox.width) : (stage.height() / boundingBox.height);

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
	if (!layer || !sourceImage) return
	fitImage(sourceImage, getRotatedBoundingBox(sourceImage), horizontal);
	layer.batchDraw();
};


async function saveCanvasImage(printable = true): Promise<string> {
	return new Promise<string>(async (resolve, reject) => {
		if (!stage || !image || !backgroundRect) reject(null)
		else {

			if (!printable) {
				// TODO: error handling?
				const polaroidImage = await downloadPolaroid(props.config.type, props.settings.text ?? '', image, backgroundRect, stage, props.displayScale);
				resolve(polaroidImage);

			}

			else {

				const compressedCanvasImage = await compressedImage(props.config.type, image, backgroundRect, stage);
				// TODO: error handling?
				resolve(compressedCanvasImage as string)
			}
		}
	});

}


defineExpose({ fit, saveCanvasImage });


// the background rect is a child of the (zoomed/panned) stage, so it has to be
// counter-transformed to keep covering exactly the visible area
const resetBackgroundRect = () => {
	if (backgroundRect == null || stage == null) return;
	backgroundRect.absolutePosition({ x: 0, y: 0 });
	backgroundRect.scaleX(1 / stage.scaleX());
	backgroundRect.scaleY(1 / stage.scaleY());

}

// grow the background rect to the current stage size and re-anchor it
const resizeBackgroundRect = () => {
	if (backgroundRect == null || stage == null) return;
	backgroundRect.width(stage.width());
	backgroundRect.height(stage.height());
	resetBackgroundRect();
}

let timeoutSnapX: ReturnType<typeof setTimeout> | undefined;
let timeoutSnapY: ReturnType<typeof setTimeout> | undefined;
function checkAndSnap() {
	if (!stage || !layer || !image) return;

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


		snappedX.value = true;

		timeoutSnapX = setTimeout(() => {
			snappedX.value = false;
		}, 350);
	} else {
		snappedX.value = false;
	}
	if (deltaY <= threshold) {
		// Adjust stage.y() to snap image's center to the stage's center
		const snapYPosition = stage.height() / 2 - imageCenterY * stage.scaleY();
		stage.y(snapYPosition);

		snappedY.value = true;

		timeoutSnapY = setTimeout(() => {
			snappedY.value = false;
		}, 350);
	} else {
		snappedY.value = false;
	}


	layer.batchDraw();
}

let listenersAttached = false;
const addCanvasListeners = () => {
	if (!stage || listenersAttached) return;
	listenersAttached = true;

	const canvasStage = stage;

	canvasStage.on('dragmove', resetBackgroundRect);
	canvasStage.on('dragmove', () => {
		checkAndSnap();
	});


	// Wheel zoom functionality
	canvasStage.on('wheel', (e) => {

		e.evt.preventDefault();
		const oldScale = canvasStage.scaleX();
		const pointer = canvasStage.getPointerPosition();
		if (pointer == null) return;

		const mousePointTo = {
			x: (pointer.x - canvasStage.x()) / oldScale,
			y: (pointer.y - canvasStage.y()) / oldScale,
		};

		const newScale = clampZoom(e.evt.deltaY > 0 ? oldScale * 0.95 : oldScale * 1.05);

		canvasStage.scale({ x: newScale, y: newScale });

		const newPos = {
			x: pointer.x - mousePointTo.x * newScale,
			y: pointer.y - mousePointTo.y * newScale,
		};
		canvasStage.position(newPos);


		resetBackgroundRect()
	});

	let lastCenter: Point | null = null;
	let lastDist = 0;
	let dragStopped = false;

	// Multi-touch zoom functionality
	canvasStage.on('touchmove', (e) => {


		e.evt.preventDefault();
		const touch1 = e.evt.touches[0];
		const touch2 = e.evt.touches[1];

		if (touch1 && !touch2 && !canvasStage.isDragging() && dragStopped) {
			canvasStage.startDrag();
			dragStopped = false;
		}

		if (touch1 && touch2) {

			if (canvasStage.isDragging()) {
				dragStopped = true;
				canvasStage.stopDrag();
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
				x: (newCenter.x - canvasStage.x()) / canvasStage.scaleX(),
				y: (newCenter.y - canvasStage.y()) / canvasStage.scaleX(),
			};

			const scale = clampZoom(canvasStage.scaleX() * (dist / lastDist));

			canvasStage.scaleX(scale);
			canvasStage.scaleY(scale);

			// calculate new position of the stage
			const dx = newCenter.x - lastCenter.x;
			const dy = newCenter.y - lastCenter.y;

			const newPos = {
				x: newCenter.x - pointTo.x * scale + dx,
				y: newCenter.y - pointTo.y * scale + dy,
			};

			canvasStage.position(newPos);

			lastDist = dist;
			lastCenter = newCenter;

			resetBackgroundRect()
		}
	});

	canvasStage.on('touchend', () => {
		lastDist = 0;
		lastCenter = null;
	});
};


const getDistance = (p1: Point, p2: Point) => {
	return Math.sqrt(Math.pow(p2.x - p1.x, 2) + Math.pow(p2.y - p1.y, 2));
};

const getCenter = (p1: Point, p2: Point): Point => {
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

	backgroundRect?.fill(color)

	const doc = document.getElementById("polaroid-frame");
	if (doc) doc.style.backgroundColor = color;
}

watch(() => props.settings.rotation, (newVal, oldVal) => {
	if (!image) return;
	image.rotate(Number(newVal) - Number(oldVal))
	layer?.batchDraw();
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
	border-radius: 2px;
	background-color: rgb(var(--light-grey-color));
	transform: translate(-50%, -50%);
	z-index: 2;
}

/* guide for horizontal centring: a thin vertical line */
.cross-x {
	width: 2px;
	height: 20px;
}

/* guide for vertical centring: a thin horizontal line */
.cross-y {
	width: 20px;
	height: 2px;
}

.cross-element.snapped {
	background-color: rgb(var(--dynamic-bg-color));
	z-index: 5;
}

.cross-x.snapped {
	height: 100%;
}

.cross-y.snapped {
	width: 100%;
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
	padding: 0;
	border: none;
	opacity: 1;
	display: block;
	z-index: 3;
}

.remove-button:focus-visible {
	outline: 2px solid rgb(var(--dynamic-bg-color));
	outline-offset: 2px;
}

.remove-button:hover {
	background-color: #e0e0e0;

}

.remove-button:hover img {
	opacity: 1;
}

.remove-button img {
	margin-right: 0;
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
