<template>
	<ModalDialog :open="open" title="Film look" testid="film-dialog" v-on:close="close">

		<div class="body">

			<!-- first in the markup so they are reached first, and the only part that
				 scrolls: the photo stays where it is -->
			<div ref="controlsRef" class="controls" data-testid="film-controls"
				 :class="{ 'more-above': moreAbove, 'more-below': moreBelow }"
				 v-on:scroll.passive="measureOverflow">

				<div v-for="(group, index) in CONTROL_GROUPS" :key="index" class="group">
					<FilmSlider v-for="control in group" :key="control.key" :label="control.label"
								:testid="`film-${control.key}`" :min="control.min" :max="control.max"
								:step="control.step" :anchor="control.anchor"
								:display="control.format(adjustments[control.key])"
								:model-value="adjustments[control.key]"
								v-on:update:model-value="adjustEvent(control.key, $event)" />
				</div>
			</div>

			<div class="preview">
				<canvas ref="canvasRef" class="preview-canvas" data-testid="film-preview"
						aria-label="Preview of the film look" role="img" />
			</div>
		</div>

		<template #footer>
			<!-- there is nothing to put back until something has been moved -->
			<button v-if="isChanged" type="button" class="reset" data-testid="film-reset"
					v-on:click="resetEvent">
				Reset
			</button>
			<LoadingButton label="Done" class="done" data-testid="film-done" v-on:click="close" />
		</template>
	</ModalDialog>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue';
import LoadingButton from '../controls/LoadingButton.vue';
import ModalDialog from '../controls/ModalDialog.vue';
import FilmSlider from './FilmSlider.vue';
import {
	applyFilm, blurRadiusFor, hasPixelWork, ADJUSTMENT_RANGES, DEFAULT_ADJUSTMENTS,
	type FilmAdjustments
} from '../../polaroid/film';

const props = defineProps<{
	open: boolean;
	adjustments: FilmAdjustments;
	/** an unfiltered snapshot of the crop, so the preview shows the real photo */
	source: HTMLCanvasElement | null;
}>();

const emit = defineEmits<{
	(e: 'update:adjustments', adjustments: FilmAdjustments): void;
	(e: 'close'): void;
}>();

/**
 * Every slider marks its own zero, as the rotation dial marks its quarter turns.
 * Grouped by spacing alone: the light, the colour, the film's limits, its texture.
 */
const CONTROL_GROUPS = [
	[
		{ key: 'brightness', label: 'Brightness', anchor: 0, ...ADJUSTMENT_RANGES.brightness, format: (v: number) => `${Math.round(v * 200)}` },
		{ key: 'contrast', label: 'Contrast', anchor: 0, ...ADJUSTMENT_RANGES.contrast, format: (v: number) => `${Math.round(v)}` },
		{ key: 'midtones', label: 'Midtones', anchor: 0, ...ADJUSTMENT_RANGES.midtones, format: (v: number) => `${Math.round(v * 100)}` }
	],
	[
		{ key: 'saturation', label: 'Saturation', anchor: 0, ...ADJUSTMENT_RANGES.saturation, format: (v: number) => `${Math.round(v * 100)}` },
		{ key: 'temperature', label: 'Warmth', anchor: 0, ...ADJUSTMENT_RANGES.temperature, format: (v: number) => `${Math.round(v)}` },
		{ key: 'tint', label: 'Tint', anchor: 0, ...ADJUSTMENT_RANGES.tint, format: (v: number) => `${Math.round(v)}` }
	],
	[
		{ key: 'lift', label: 'Lift', anchor: 0, ...ADJUSTMENT_RANGES.lift, format: (v: number) => `${Math.round(v * 100)}` },
		{ key: 'wash', label: 'Wash', anchor: 0, ...ADJUSTMENT_RANGES.wash, format: (v: number) => `${Math.round(v * 100)}` }
	],
	[
		{ key: 'grain', label: 'Grain', anchor: 0, ...ADJUSTMENT_RANGES.grain, format: (v: number) => v === 0 ? 'None' : `${Math.round(v * 100)}` },
		{ key: 'blur', label: 'Focus', anchor: 0, ...ADJUSTMENT_RANGES.blur, format: (v: number) => v === 0 ? 'Sharp' : `-${v.toFixed(1)}` }
	]
] as const;

const canvasRef = ref<HTMLCanvasElement | null>(null);
const controlsRef = ref<HTMLDivElement | null>(null);

// a line is drawn at an edge only where something runs past it
const moreAbove = ref(false);
const moreBelow = ref(false);

function measureOverflow(): void {
	const element = controlsRef.value;
	if (element == null) return;

	// a pixel of slack: a scroll position is fractional on a zoomed display, and an
	// exact comparison leaves a line showing at the end of the travel
	moreAbove.value = element.scrollTop > 1;
	moreBelow.value = element.scrollTop + element.clientHeight < element.scrollHeight - 1;
}

let overflowObserver: ResizeObserver | null = null;

/** there is nothing to put back until something has been moved off the standard look */
const isChanged = computed(() => {
	const keys = Object.keys(DEFAULT_ADJUSTMENTS) as (keyof FilmAdjustments)[];
	return keys.some((key) => props.adjustments[key] !== DEFAULT_ADJUSTMENTS[key]);
});

function close(): void {
	emit('close');
}

function adjustEvent(key: keyof FilmAdjustments, value: number): void {
	emit('update:adjustments', { ...props.adjustments, [key]: value });
}

function resetEvent(): void {
	emit('update:adjustments', { ...DEFAULT_ADJUSTMENTS });
}

/** Redraw the preview from the untouched snapshot every time something moves. */
function renderPreview(): void {
	const canvas = canvasRef.value;
	const source = props.source;
	if (!canvas || !source || source.width === 0) return;

	canvas.width = source.width;
	canvas.height = source.height;

	const context = canvas.getContext('2d');
	if (!context) return;

	context.clearRect(0, 0, canvas.width, canvas.height);

	// a neighbourhood operation, so the canvas does it rather than the pixel pass
	const radius = blurRadiusFor(props.adjustments.blur, canvas.width);
	if (radius > 0) context.filter = `blur(${radius}px)`;

	context.drawImage(source, 0, 0);
	context.filter = 'none';

	if (hasPixelWork(props.adjustments)) {
		const pixels = context.getImageData(0, 0, canvas.width, canvas.height);
		applyFilm(pixels, props.adjustments);
		context.putImageData(pixels, 0, 0);
	}
}

let frame: number | null = null;

function scheduleRender(): void {
	if (frame != null) return;
	frame = requestAnimationFrame(() => {
		frame = null;
		renderPreview();
	});
}

watch(() => [props.adjustments, props.source], scheduleRender, { deep: true });

// the canvas and the scrolling box only exist once the dialog is in the document
watch(() => props.open, async (open) => {
	if (!open) {
		overflowObserver?.disconnect();
		overflowObserver = null;
		return;
	}

	await nextTick();
	renderPreview();
	measureOverflow();

	// turning a phone can take the overflow away without any scrolling
	if (controlsRef.value == null || typeof ResizeObserver === 'undefined') return;

	overflowObserver = new ResizeObserver(measureOverflow);
	overflowObserver.observe(controlsRef.value);
}, { immediate: true });

onBeforeUnmount(() => {
	if (frame != null) cancelAnimationFrame(frame);
	overflowObserver?.disconnect();
});

// read by the spec: jsdom lays nothing out, so the overflow has to be driven by hand
defineExpose({ measureOverflow, moreAbove, moreBelow });
</script>

<style scoped>
/* sliders on the left, the photo they are shaping on the right */
.body {
	flex: 1 1 auto;
	min-height: 0;
	display: flex;
	gap: 22px;
	padding: 10px 20px 4px;
}

/* The only part that moves: min-height 0 lets it shrink below its content and take
   the scrolling off the panel. The borders are always present and start invisible,
   so a line appearing shifts nothing and cannot set the measurement off again. */
.controls {
	flex: 1 1 260px;
	min-width: 0;
	min-height: 0;
	overflow-y: auto;
	-webkit-overflow-scrolling: touch;
	scrollbar-width: thin;
	display: flex;
	flex-direction: column;
	/* the gap between groups; within a group the sliders sit closer together */
	gap: 30px;
	/* clear of the scrollbar, which a slider would otherwise run underneath */
	padding-right: 14px;
	/* room for the last slider's mark to clear the line under it */
	padding-bottom: 8px;
	padding-top: 2px;
	padding-left: 4px;
	border-top: 2px solid transparent;
	border-bottom: 2px solid transparent;
	transition: border-color 150ms ease-in-out;
}

.controls.more-above {
	border-top-color: rgba(var(--dynamic-bg-color), .35);
}

.controls.more-below {
	border-bottom-color: rgba(var(--dynamic-bg-color), .35);
}

.group {
	display: flex;
	flex-direction: column;
	gap: 10px;
}

.preview {
	flex: none;
	width: 280px;
	min-width: 0;
	align-self: flex-start;
}

.preview-canvas {
	display: block;
	width: 100%;
	height: auto;
	border-radius: 6px;
	background-color: #f2f2f2;
}

/* the same size as Done; the tint is what makes it the second choice */
.reset {
	min-width: 120px;
	background-color: rgba(var(--dynamic-bg-color), .12) !important;
	color: rgb(var(--dynamic-bg-color));
	box-shadow: none !important;
}

@media (hover: hover) and (pointer: fine) {
	.reset:hover {
		background-color: rgba(var(--dynamic-bg-color), .2) !important;
	}
}

/* at the far end whether or not Reset is beside it, so it never moves */
.done {
	min-width: 120px;
	margin-left: auto;
	color: #ffffff;
}

@media (max-width: 620px) {

	/* the photo on top and the sliders under it */
	.body {
		flex-direction: column-reverse;
		gap: 14px;
		/* given up so the scrolling box reaches the edge and puts its bar there */
		padding-left: 0;
		padding-right: 0;
	}

	.controls {
		padding-left: 20px;
		padding-right: 16px;
	}

	.preview {
		align-self: center;
		width: 62%;
		max-width: 220px;
	}
}
</style>
