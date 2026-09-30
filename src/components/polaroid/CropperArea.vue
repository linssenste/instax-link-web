<template>
	<div id="cropper-area">
		<div ref="containerRef" class="container" />

		<!-- the same control the dialog closes with, in the plain tone that reads
			 over a photo rather than over a panel -->
		<CloseButton v-if="!loading" class="remove-button" tone="plain" :size="30" label="Remove image"
					 title="Remove image" testid="remove-image-button" v-on:click="removeImage()" />

		<!-- A faint crosshair that stretches in the theme colour while the image is on
			 that centre line. The borders snap too, but without a line: four of them
			 lighting around the frame was more noise than help. -->
		<div class="center-cross" v-if="!loading">
			<div class="cross-element cross-x" :class="{ snapped: guides.centreX }"
				 data-testid="cross-horizontal" />
			<div class="cross-element cross-y" :class="{ snapped: guides.centreY }"
				 data-testid="cross-vertical" />
		</div>
	</div>
</template>

<script lang="ts" setup>

import Konva from 'konva';
import CloseButton from '../controls/CloseButton.vue';
import type { Filter as KonvaFilter } from 'konva/lib/Node';
import { onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { type PrinterStateConfig } from '../../interfaces/PrinterStateConfig';

import { downloadPolaroid } from '../../cropper/cropper.download';
import { blurRadiusFor, filmFilter, hasPixelWork, isNeutral, type FilmAdjustments } from '../../polaroid/film';
import {
	POLAROID_EXPORT_WIDTH, PRINT_RESOLUTION, NOT_ALIGNED, type FrameAlignment
} from '../../polaroid/frame.geometry';
import { compressedImage } from '../../cropper/cropper.print'

const emit = defineEmits(['save', 'remove-image', 'alignment']);

const props = defineProps<{
	src: string,
	loading: boolean;
	config: PrinterStateConfig
	settings: {
		rotation: number,
		color: string,
		text?: string;
	}
	adjustments: FilmAdjustments
}>();

type Point = { x: number, y: number };

const MIN_ZOOM = 0.25;
const MAX_ZOOM = 5.0;

const containerRef = ref<HTMLDivElement | null>(null);

// whether the image currently sits on the horizontal / vertical centre line
type Guide = 'centreX' | 'centreY';

// Shown for a moment whenever the image lands on that line, whether it was put
// there by a button or dragged there by hand.
const guides = ref<Record<Guide, boolean>>({ centreX: false, centreY: false });

const guideTimers: Partial<Record<Guide, ReturnType<typeof setTimeout>>> = {};

// long enough to notice, short enough not to linger over a photo being moved
const GUIDE_LINGER = 350;

function showGuide(name: Guide, holds: boolean): void {
	clearTimeout(guideTimers[name]);

	if (!holds) {
		guides.value[name] = false;
		return;
	}

	guides.value[name] = true;
	guideTimers[name] = setTimeout(() => { guides.value[name] = false; }, GUIDE_LINGER);
}

// how close a line has to come before a drag is pulled onto it, in screen pixels
const SNAP_THRESHOLD = 5;

// keep wheel and pinch zoom within the same bounds
const clampZoom = (scale: number) => Math.max(MIN_ZOOM, Math.min(scale, MAX_ZOOM));

let stage: Konva.Stage | null = null;
let layer: Konva.Layer | null = null;
let image: Konva.Image | null = null;
let backgroundRect: Konva.Rect | null = null;
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
		measureAlignment(true);
		return;
	}

	// ignore sub-pixel jitter
	if (Math.abs(previous.width - width) < 0.5 && Math.abs(previous.height - height) < 0.5) return;

	// The zoom follows the height. For a given film type the container holds a
	// fixed aspect ratio, so a window resize moves both dimensions together and the
	// height alone describes it; and all three crop windows are the same height and
	// differ only in width, so a film type change is a change of shape rather than
	// of size and leaves the photo where it was.
	//
	// Taking the smaller of the two factors instead shrank the photo on the way to
	// a narrower frame and did not grow it back on the way out, so every trip
	// through the film types left it smaller than it found it.
	const zoomRatio = height / previous.height;

	const position = stage.position();

	stage.width(width);
	stage.height(height);
	stage.scale({ x: stage.scaleX() * zoomRatio, y: stage.scaleY() * zoomRatio });

	// keep whatever was in the middle of the window in the middle of it. For a
	// resize that scales both dimensions this is the old proportional shift; for a
	// change of shape alone it is a nudge that re-centres the new box.
	stage.position({
		x: width / 2 - zoomRatio * (previous.width / 2 - position.x),
		y: height / 2 - zoomRatio * (previous.height / 2 - position.y)
	});

	resizeBackgroundRect();
	layer.batchDraw();
	measureAlignment();
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
		measureAlignment(true);
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
	if (adjustmentFrame != null) cancelAnimationFrame(adjustmentFrame);
	clearTimeout(resizeTimer);
	clearTimeout(alignmentTimer);
	for (const timer of Object.values(guideTimers)) clearTimeout(timer);

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

	// nothing is framed until the new one has loaded and been placed
	measureAlignment(true);
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
	applyAdjustments();
};


/**
 * Caching rasterises the node and the filter then walks every pixel of it, so
 * the editor only ever caches at the size actually on screen. Without this the
 * pass runs over the source photo's full resolution on every slider step.
 */
function displayPixelRatio(): number {
	if (image == null || stage == null) return 1;
	return Math.min(1, Math.max(0.1, image.scaleX() * stage.scaleX()));
}

/** hand the browser a frame, so anything animating keeps moving */
const nextFrame = () => new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));

/** the adjustments are shown live, so the editor is what gets exported */
function applyAdjustments(pixelRatio?: number): void {
	if (image == null) return;

	if (isNeutral(props.adjustments)) {
		image.clearCache();
		image.filters([]);
		return;
	}

	const ratio = pixelRatio ?? displayPixelRatio();
	const filters: KonvaFilter[] = [];

	// Konva's blur reads the node's cache, whose pixels are neither the frame's nor
	// the photo's, so the radius is converted into that space before it is set
	if (props.adjustments.blur > 0 && stage != null) {
		const frameInCachePixels = ratio * stage.width() / (image.scaleX() || 1);
		image.blurRadius(blurRadiusFor(props.adjustments.blur, frameInCachePixels));
		filters.push(Konva.Filters.Blur);
	}

	if (hasPixelWork(props.adjustments)) filters.push(filmFilter(props.adjustments));

	image.filters(filters);
	image.cache({ pixelRatio: ratio });
}

// a slider fires far faster than the screen refreshes, so the work is collapsed
// to one pass per frame rather than one per event
let adjustmentFrame: number | null = null;

function scheduleAdjustments(): void {
	if (adjustmentFrame != null) return;

	adjustmentFrame = requestAnimationFrame(() => {
		adjustmentFrame = null;
		applyAdjustments();
		layer?.batchDraw();
	});
}


function fit(horizontal: boolean): void {
	if (!layer || !sourceImage) return
	fitImage(sourceImage, getRotatedBoundingBox(sourceImage), horizontal);
	layer.batchDraw();

	// a fit centres the photo as well, but it was asked to scale and not to centre,
	// so it leaves the crosshair alone
	showGuide('centreX', false);
	showGuide('centreY', false);

	measureAlignment(true);
};

/**
 * Shift the image by a few pixels, for the arrow keys.
 *
 * The position is not snapped: a one pixel step near a line would be swallowed and
 * there would be no way to step past it. The lines still light up as the image
 * reaches them, so the feedback is the same as a drag's without the pull.
 */
function nudge(x: number, y: number): void {
	if (stage == null || layer == null || image == null) return;

	stage.x(stage.x() + x);
	stage.y(stage.y() + y);

	showCentreGuides();
	resetBackgroundRect();
	layer.batchDraw();
	measureAlignment();
}

/** light whichever centre line the image is sitting on, without moving it */
function showCentreGuides(): void {
	if (stage == null || image == null) return;

	const threshold = SNAP_THRESHOLD / stage.scaleX();
	const frameCentreX = (stage.width() / 2 - stage.x()) / stage.scaleX();
	const frameCentreY = (stage.height() / 2 - stage.y()) / stage.scaleY();

	showGuide('centreX', Math.abs(frameCentreX - image.x()) <= threshold);
	showGuide('centreY', Math.abs(frameCentreY - image.y()) <= threshold);
}

/** Put the image back on the frame's centre line, on one axis at a time. */
function centre(horizontal: boolean): void {
	if (stage == null || image == null || layer == null) return;

	if (horizontal) stage.x(stage.width() / 2 - image.x() * stage.scaleX());
	else stage.y(stage.height() / 2 - image.y() * stage.scaleY());

	// the stage moved, so the backdrop has to be re-anchored, as a drag does
	resetBackgroundRect();
	layer.batchDraw();

	showGuide('centreX', horizontal);
	showGuide('centreY', !horizontal);
	measureAlignment(true);
}

// within half a pixel on screen, and within half a percent for a span
const isCentred = (a: number, b: number, scale: number) => Math.abs(a - b) <= 0.5 / scale;
const spans = (extent: number, frame: number) => Math.abs(extent - frame) <= frame * 0.005;

/**
 * Work out which of the four framing states hold. Each control lights up while its
 * own is true, so the answer has to be recomputed after anything that moves or
 * scales the image, not only after the buttons themselves.
 */
function measureAlignment(immediately = false): void {
	const box = sourceImage == null
		? { width: 0, height: 0 }
		: getRotatedBoundingBox(sourceImage);

	if (stage == null || image == null || stage.width() <= 0 || stage.height() <= 0
		|| box.width <= 0 || box.height <= 0) {
		report({ ...NOT_ALIGNED }, immediately);
		return;
	}

	const frameCentreX = (stage.width() / 2 - stage.x()) / stage.scaleX();
	const frameCentreY = (stage.height() / 2 - stage.y()) / stage.scaleY();

	const centredHorizontally = isCentred(frameCentreX, image.x(), stage.scaleX());
	const centredVertically = isCentred(frameCentreY, image.y(), stage.scaleY());

	// The photo's size on screen, which is its own scale carried through the stage's
	// zoom. Reading the image's scale alone would call a fit still fitted after a
	// pinch, since zooming moves the stage and never touches the node.
	const onScreenWidth = box.width * image.scaleX() * stage.scaleX();
	const onScreenHeight = box.height * image.scaleY() * stage.scaleY();

	report({
		// spanning the frame is only half of it: panned off the centre line the photo
		// still spans that much, but no longer from edge to edge
		fitsWidth: spans(onScreenWidth, stage.width()) && centredHorizontally,
		fitsHeight: spans(onScreenHeight, stage.height()) && centredVertically,
		centredHorizontally,
		centredVertically
	}, immediately);
}

let alignmentTimer: ReturnType<typeof setTimeout> | undefined;

// How long the controls wait before agreeing. Dragging a photo across a centre line
// flips these several times a second, and a button lighting and unlighting with it
// reads as a fault; a press settles the framing at once, so it does not wait.
const ALIGNMENT_SETTLE = 140;

function report(next: FrameAlignment, immediately: boolean): void {
	clearTimeout(alignmentTimer);

	if (immediately) {
		emit('alignment', next);
		return;
	}

	alignmentTimer = setTimeout(() => emit('alignment', next), ALIGNMENT_SETTLE);
}



async function saveCanvasImage(printable = true): Promise<string> {
	if (!stage || !image || !backgroundRect) return Promise.reject(null);

	// the filtered image renders from its cache, so that cache has to be rebuilt
	// at the size being exported or the photo comes out soft
	const exportRatio = exportPixelRatio(printable);

	if (exportRatio != null) {
		applyAdjustments(exportRatio);
		// rebuilding the cache walks every pixel of the photo. Handing the browser
		// a frame here lets the loading animation paint before the capture starts
		await nextFrame();
	}

	try {
		// TODO: error handling?
		return printable
			? await compressedImage(props.config.type, image, backgroundRect, stage) as string
			: await downloadPolaroid(props.config.type, props.settings.text ?? '', image, backgroundRect, stage);
	} finally {
		// and again before the editor's own cache is rebuilt, which is another
		// pass over the photo with nothing waiting on it
		await nextFrame();

		// whatever happened, the editor goes back to the size it is shown at
		if (exportRatio != null) applyAdjustments();
		layer?.batchDraw();
	}
}


/** how far past the on screen size the capture goes, if anything is cached */
function exportPixelRatio(printable: boolean): number | null {
	if (stage == null || image == null || image.filters().length === 0) return null;

	const target = printable
		? PRINT_RESOLUTION[props.config.type]?.width
		: POLAROID_EXPORT_WIDTH[props.config.type];

	if (target == null || stage.width() <= 0) return null;
	return Math.max(1, target / stage.width());
}


/**
 * A small copy of the photo itself for the dialog to preview from, taken from the
 * source rather than the stage: the film look is about the picture, so the crop,
 * the rotation and the frame around it are none of its business. Unfiltered, so
 * moving a slider never compounds on the last preview.
 */
function previewSource(maxWidth = 320): HTMLCanvasElement | null {
	if (sourceImage == null) return null;

	// naturalWidth is the decoded size, which is what the photo actually is
	const width = sourceImage.naturalWidth || sourceImage.width;
	const height = sourceImage.naturalHeight || sourceImage.height;
	if (width === 0 || height === 0) return null;

	const scale = Math.min(1, maxWidth / width);
	const canvas = document.createElement('canvas');
	canvas.width = Math.max(1, Math.round(width * scale));
	canvas.height = Math.max(1, Math.round(height * scale));

	const context = canvas.getContext('2d');
	if (context == null) return null;

	context.drawImage(sourceImage, 0, 0, canvas.width, canvas.height);
	return canvas;
}

defineExpose({ fit, centre, nudge, saveCanvasImage, previewSource, measureAlignment });


// the background rect is a child of the (zoomed/panned) stage, so it has to be
// counter-transformed to keep covering exactly the visible area
const resetBackgroundRect = () => {
	if (stage == null) return;


	if (backgroundRect == null) return;
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

/**
 * Pull a drag onto whichever line it comes close to, and light that line.
 *
 * The centre is tried first: on a photo that exactly fills the frame the centre and
 * both borders are the same place, and the centre is the one worth reporting.
 */
function checkAndSnap() {
	if (!stage || !layer || !image || !sourceImage) return;

	const box = getRotatedBoundingBox(sourceImage);

	// Snap threshold adjusted for stage scale
	const threshold = SNAP_THRESHOLD / stage.scaleX();

	const stageCenterX = (stage.width() / 2 - stage.x()) / stage.scaleX();
	const stageCenterY = (stage.height() / 2 - stage.y()) / stage.scaleY();

	const onCentreX = Math.abs(stageCenterX - image.x()) <= threshold;
	const onCentreY = Math.abs(stageCenterY - image.y()) <= threshold;

	if (onCentreX) stage.x(stage.width() / 2 - image.x() * stage.scaleX());
	if (onCentreY) stage.y(stage.height() / 2 - image.y() * stage.scaleY());

	showGuide('centreX', onCentreX);
	showGuide('centreY', onCentreY);

	// then the borders, on whichever axis the centre has not already taken. These
	// catch without drawing anything: the pull is the whole point of them.
	if (!onCentreX) snapToBorders(true, box);
	if (!onCentreY) snapToBorders(false, box);

	layer.batchDraw();
	measureAlignment();
}

/**
 * Bring the photo's near or far edge onto the frame's own, on one axis. This is the
 * edge of how far it can be moved before the background starts to show, so it is
 * worth catching on the way past.
 */
function snapToBorders(horizontal: boolean, box: { width: number, height: number }): void {
	if (stage == null || image == null) return;

	const zoom = horizontal ? stage.scaleX() : stage.scaleY();
	const extent = (horizontal ? box.width * image.scaleX() : box.height * image.scaleY()) * zoom;
	const frame = horizontal ? stage.width() : stage.height();

	const centre = horizontal
		? stage.x() + image.x() * stage.scaleX()
		: stage.y() + image.y() * stage.scaleY();

	// both in screen pixels, measured from the frame's top left
	const near = centre - extent / 2;
	const far = centre + extent / 2;

	const shift = Math.abs(near) <= SNAP_THRESHOLD ? -near
		: Math.abs(far - frame) <= SNAP_THRESHOLD ? frame - far
			: null;

	if (shift == null) return;

	if (horizontal) stage.x(stage.x() + shift);
	else stage.y(stage.y() + shift);
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
		measureAlignment()
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
			measureAlignment()
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
	measureAlignment();
})

watch([() => props.settings.color, () => props.src], setBackgroundColor);

watch(() => props.adjustments, scheduleAdjustments, { deep: true });

</script>

<style scoped>
#cropper-area {
	position: relative;
	width: 100%;
	height: 100%;

}

/* the photo is dragged to frame it, so the pointer says so; :active rather than a
   drag event, which is how the sliders and the dial say the same thing */
.container {
	width: 100%;
	height: 100%;
	cursor: grab;
}

.container:active {
	cursor: grabbing;
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

/* Every guide runs past both ends rather than stopping short. A line that stops at
   the visible edge reads as broken; one that carries on under the lip reads as
   whole, and the overflow is hidden anyway. */
.cross-x.snapped {
	height: calc(100% + 2 * var(--guide-overflow));
}

.cross-y.snapped {
	width: calc(100% + 2 * var(--guide-overflow));
}

/* The frame artwork lies over the crop area, so a line that stops at the boundary
   reads as broken: each one runs past both ends by this much and the overflow hides
   under the lip. It follows the frame's own scale, since the lip shrinks with it.

   Positioned and stretched over the crop area so the guides measure against that
   box and nothing else, and transparent to the pointer so it cannot take a drag
   meant for the photo. */
.center-cross {
	--guide-overflow: calc(6px * var(--polaroid-scale, 1));

	position: absolute;
	inset: 0;
	opacity: .75;
	z-index: 10;
	pointer-events: none;
}

.remove-button {
	position: absolute;
	top: 10px;
	right: 10px;
	z-index: 3;
}
</style>
