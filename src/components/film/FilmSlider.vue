<template>
	<div class="slider">
		<span class="head">
			<span>{{ label }}</span>
			<span class="value">{{ display }}</span>
		</span>

		<div ref="railRef" class="rail">
			<input ref="inputRef" type="range" :data-testid="testid" :min="min" :max="max" :step="step"
				   :value="modelValue" :aria-label="label" v-on:input="inputEvent" />

			<!-- the resting value, marked on the bar: a drag passing close sticks to it
				 and a press returns to it -->
			<button v-if="anchor != null" type="button" class="anchor" :class="{ quiet: isCovered }"
					:style="{ left: anchorOffset }" :aria-label="`Reset ${label}`"
					:data-testid="`${testid}-anchor`" v-on:click="anchorEvent" />
		</div>
	</div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';

const props = defineProps<{
	label: string;
	testid: string;
	modelValue: number;
	min: number;
	max: number;
	step: number;
	display: string;
	/** the value the slider rests at, or null where it has no resting point */
	anchor?: number | null;
}>();

const emit = defineEmits<{ (e: 'update:modelValue', value: number): void }>();

// share of the travel the mark catches. Any wider and the settings either side of
// it become hard to reach at all.
const SNAP_REACH = 0.015;

// one band thick, per the stylesheet; the fallback is its share of a typical rail
const KNOB_SIZE = 15;
const KNOB_COVER_FALLBACK = 0.05;

const inputRef = ref<HTMLInputElement | null>(null);
const railRef = ref<HTMLDivElement | null>(null);
const railWidth = ref(0);

let railObserver: ResizeObserver | null = null;

function measureRail(): void {
	railWidth.value = railRef.value?.clientWidth ?? 0;
}

onMounted(() => {
	measureRail();
	if (railRef.value == null || typeof ResizeObserver === 'undefined') return;

	railObserver = new ResizeObserver(measureRail);
	railObserver.observe(railRef.value);
});

onBeforeUnmount(() => {
	railObserver?.disconnect();
	railObserver = null;
});

/** the knob covers the mark from half its own width away, not only on landing */
const isCovered = computed(() => {
	if (props.anchor == null) return false;

	const span = props.max - props.min;
	if (span === 0) return true;

	const travel = railWidth.value - KNOB_SIZE;
	const reach = travel > 0
		? (KNOB_SIZE / 2 / travel) * span
		: KNOB_COVER_FALLBACK * span;

	return Math.abs(props.modelValue - props.anchor) <= reach;
});

// the knob's centre travels inset by half its width at each end, so the mark is
// placed along that span; a hardcoded inset lands it off centre at the extremes
const anchorOffset = computed(() => {
	const span = props.max - props.min;
	const fraction = span === 0 ? 0 : ((props.anchor ?? 0) - props.min) / span;
	return `calc(var(--bar-height) / 2 + (100% - var(--bar-height)) * ${fraction})`;
});

function pull(value: number): number {
	if (props.anchor == null) return value;

	const reach = (props.max - props.min) * SNAP_REACH;
	return Math.abs(value - props.anchor) <= reach ? props.anchor : value;
}

function commit(value: number): void {
	emit('update:modelValue', value);

	// a snap can land on the bound value, which renders nothing and would leave the
	// knob where the pointer dropped it
	if (inputRef.value != null) inputRef.value.value = String(value);
}

function inputEvent(event: Event): void {
	commit(pull(Number((event.target as HTMLInputElement).value)));
}

function anchorEvent(): void {
	if (props.anchor != null) commit(props.anchor);
}
</script>

<style scoped>
/* the rotation dial laid out flat: same band, same dot, same knob */
.slider {
	--bar-height: 15px;
}

.head {
	display: flex;
	justify-content: space-between;
	font-size: 13px;
	letter-spacing: .5px;
	margin-bottom: 4px;
}

.value {
	color: #00000066;
	font-variant-numeric: tabular-nums;
}

.rail {
	position: relative;
	height: var(--bar-height);
}

input[type=range] {
	display: block;
	width: 100%;
	height: var(--bar-height);
	margin: 0;
	padding: 0;
	background: none;
	-webkit-appearance: none;
	appearance: none;
	cursor: grab;
}

input[type=range]:active {
	cursor: grabbing;
}

/* rounded at both ends, like the ring has no ends at all */
input[type=range]::-webkit-slider-runnable-track {
	height: var(--bar-height);
	border-radius: calc(var(--bar-height) / 2);
	background-color: rgba(var(--dynamic-bg-color), .3);
}

input[type=range]::-moz-range-track {
	height: var(--bar-height);
	border-radius: calc(var(--bar-height) / 2);
	background-color: rgba(var(--dynamic-bg-color), .3);
}

/* the knob fills the band rather than sitting on top of it */
input[type=range]::-webkit-slider-thumb {
	-webkit-appearance: none;
	appearance: none;
	width: var(--bar-height);
	height: var(--bar-height);
	margin-top: 0;
	border: none;
	border-radius: 50%;
	background-color: rgb(var(--dynamic-bg-color));
	cursor: grab;
	transition: transform 150ms ease-out, box-shadow 150ms ease-out;
}

input[type=range]::-moz-range-thumb {
	width: var(--bar-height);
	height: var(--bar-height);
	border: none;
	border-radius: 50%;
	background-color: rgb(var(--dynamic-bg-color));
	cursor: grab;
	transition: transform 150ms ease-out, box-shadow 150ms ease-out;
}

/* scaled from the middle of the band, so it spreads past both edges at once */
input[type=range]:active::-webkit-slider-thumb {
	transform: scale(1.45);
	cursor: grabbing;
}

input[type=range]:active::-moz-range-thumb {
	transform: scale(1.45);
	cursor: grabbing;
}

@media (hover: hover) and (pointer: fine) {

	input[type=range]:hover::-webkit-slider-thumb {
		transform: scale(1.45);
	}

	input[type=range]:hover::-moz-range-thumb {
		transform: scale(1.45);
	}
}

input[type=range]:focus-visible::-webkit-slider-thumb {
	box-shadow: 0 0 0 3px rgba(var(--dynamic-bg-color), .35);
}

input[type=range]:focus-visible::-moz-range-thumb {
	box-shadow: 0 0 0 3px rgba(var(--dynamic-bg-color), .35);
}

input[type=range]:focus {
	outline: none;
}

/* above the input so it can be pressed; a drag is already captured by then, so
   passing over the mark never interrupts it */
.anchor {
	position: absolute;
	top: 0;
	width: 22px;
	height: var(--bar-height);
	margin-left: -11px;
	padding: 0;
	border: none;
	border-radius: 0;
	opacity: 1;
	background-color: transparent !important;
	box-shadow: none !important;
	cursor: pointer;
	z-index: 1;
}

/* hidden under the knob, and out of the way of presses meant for it */
.anchor.quiet {
	pointer-events: none;
}

.anchor.quiet::before {
	opacity: 0;
}

/* absolute rather than margin-centred: a button folds a top margin into its own
   centring */
.anchor::before {
	content: '';
	position: absolute;
	top: 50%;
	left: 50%;
	width: 6px;
	height: 6px;
	margin: -3px 0 0 -3px;
	border-radius: 3px;
	opacity: .75;
	background-color: #ffffffcc;
	transition: opacity 150ms ease-in-out, height 180ms ease-out, margin-top 180ms ease-out,
		border-radius 180ms ease-out;
}

/* the dot draws out into a line across the band, crossing both edges */
.anchor:focus-visible::before {
	opacity: 1;
	height: 21px;
	margin-top: -10.5px;
	border-radius: 4px;
	background-color: #ffffff;
}

.anchor:focus-visible {
	outline: none;
}

@media (hover: hover) and (pointer: fine) {
	.anchor:hover:not(.quiet)::before {
		opacity: 1;
		height: 21px;
		margin-top: -10.5px;
		border-radius: 4px;
		background-color: #ffffff;
	}
}

@media (prefers-reduced-motion: reduce) {

	.anchor::before,
	input[type=range]::-webkit-slider-thumb,
	input[type=range]::-moz-range-thumb {
		transition: none;
	}

	input[type=range]:hover::-webkit-slider-thumb,
	input[type=range]:active::-webkit-slider-thumb,
	input[type=range]:hover::-moz-range-thumb,
	input[type=range]:active::-moz-range-thumb {
		transform: none;
	}
}
</style>
