<template>
	<div ref="frameRef" class="editor" :class="`polaroid-${type}`" :style="{ '--polaroid-scale': displayScale }">
		<div class="inner" id="polaroid-frame" :class="`inner-${type}`">
			<slot name="polaroid-area" />
		</div>

		<!-- polaroid image frame; intrinsic size is kept so the browser can
			 reserve the correct box before the image arrives (no layout shift),
			 while the actual rendering size is driven by CSS -->
		<img v-show="!loadError" v-on:load="frameReadyEvent(true)" v-on:error="frameReadyEvent(false)"
			 :src="polaroidImageSource" :alt="`${type} Polaroid-themed frame`" draggable="false"
			 :width="polaroidImageWidth" :height="POLAROID_FRAME_HEIGHT" fetchpriority="high" class="polaroid-frame"
			 :style="{ opacity: frameLoaded ? 1 : 0 }" />

		<div class="polaroid-text">
			<slot name="polaroid-text" />
		</div>
	</div>
</template>

<script lang="ts" setup>
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { InstaxFilmVariant } from '../../interfaces/PrinterStateConfig';
import { POLAROID_FRAME_HEIGHT, POLAROID_FRAME_WIDTH } from '../../polaroid/frame.geometry';

const emit = defineEmits<{
	/** the artwork has settled, either because it loaded or because it never will */
	(e: 'ready'): void;
}>();

const loadError = ref(false)
const frameLoaded = ref(false);

const props = defineProps<{
	type: InstaxFilmVariant
}>();

// the editor waits for this before it appears, so the frame, the caption and the
// crop area all arrive together rather than assembling themselves on screen
function frameReadyEvent(loaded: boolean): void {
	if (loaded) frameLoaded.value = true;
	else loadError.value = true;

	emit('ready');
}

const frameRef = ref<HTMLDivElement | null>(null);

// how much the frame is currently scaled down from its intrinsic size. Anything
// that has to keep its proportions - the caption, the exported pixel size - is
// derived from this instead of guessing from the viewport
const displayScale = ref(1);

const polaroidImageWidth = computed(() => POLAROID_FRAME_WIDTH[props.type]);

const polaroidImageSource = computed(() => {
	return `/polaroids/${props.type}.webp`
});

function measureDisplayScale(): void {
	if (!frameRef.value) return;

	const { width } = frameRef.value.getBoundingClientRect();
	if (width <= 0) return;

	displayScale.value = width / POLAROID_FRAME_WIDTH[props.type];
}

// the intrinsic width changes with the film variant, so the scale has to be
// recomputed even when the rendered box stays the same
watch(() => props.type, measureDisplayScale);

let resizeObserver: ResizeObserver | null = null;

onMounted(() => {
	measureDisplayScale();

	if (typeof ResizeObserver === 'undefined' || !frameRef.value) return;
	resizeObserver = new ResizeObserver(measureDisplayScale);
	resizeObserver.observe(frameRef.value);
});

onBeforeUnmount(() => {
	resizeObserver?.disconnect();
	resizeObserver = null;
});

defineExpose({ displayScale, measureDisplayScale, loadError, frameLoaded, frameReadyEvent });
</script>

<style scoped>
.editor {
	position: relative;
	margin: 0 auto;
	display: flex;
	flex-direction: column;
	align-items: center;
	justify-content: flex-start;

	/* never taller than the artwork, never wider than the viewport */
	max-height: 440px;
	width: 100%;
	border-radius: 10px;

	/* box-shadow on the (fully opaque) frame box instead of a filter:
	   drop-shadow, which would be re-rasterized on every resize step */
	/* box-shadow: 2px 2px 2px #00000022, -2px -2px 2px #00000022; */

	-webkit-user-drag: none;
	-moz-user-select: none;
	-webkit-user-select: none;
	user-select: none;
}

/* aspect ratios mirror the intrinsic artwork sizes, so the frame scales down
   proportionally and the inner crop window stays aligned with the artwork */
.polaroid-mini {
	max-width: 282px;
	aspect-ratio: 282 / 440;
}

.polaroid-square {
	max-width: 368px;
	aspect-ratio: 368 / 440;
}

.polaroid-wide {
	max-width: 522px;
	aspect-ratio: 522 / 440;
}

.inner {
	position: absolute;
	left: 50%;
	transform: translateX(-50%);
	overflow: hidden;
	top: 10px;
	background-color: white;
}

/* Percentages of the frame box, so the crop window keeps its place relative to the
   artwork at any size. Each is the artwork's own transparent window plus a 4px lip
   at the displayed size, measured off the artwork rather than guessed: the photo
   still tucks under the frame with no seam, but only just. */
.inner-mini {
	top: 7.614%;
	width: 88.121%;
	aspect-ratio: 600/790;
}

.inner-square {
	top: 8.182%;
	width: 88.043%;
	aspect-ratio: 800/800;
}

.inner-wide {
	top: 7.864%;
	width: 93.103%;
	aspect-ratio: 1260/850;
}

.polaroid-frame {
	pointer-events: none;
	width: 100%;
	height: 100%;
	z-index: 1000;
	transition: opacity 150ms ease-in-out;
}

.polaroid-text {
	position: absolute;
	/* 15px of the 440px artwork, kept proportional as the frame scales down, so
	   the caption sits centred in the frame's bottom border */
	bottom: 3.409%;
	line-height: 1;
	z-index: 10000;
	width: 100%;
	display: flex;
	flex-direction: row;
	align-items: center;
	text-align: center;
	justify-content: center;
}
</style>
