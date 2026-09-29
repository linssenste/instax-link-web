<template>
	<div ref="dialRef" class="dial" role="slider" tabindex="-1" aria-label="Image rotation in degrees"
		 :aria-valuenow="angle" aria-valuemin="0" aria-valuemax="359" :aria-valuetext="`${angle} degrees`"
		 :class="{ dragging: isDragging, 'knob-parked': knobParked }" data-testid="rotate-dial"
		 v-on:keydown="keyEvent" v-on:pointerleave="knobParked = false"
		 v-on:pointerdown="dragStartEvent" v-on:pointermove="dragMoveEvent" v-on:pointerup="dragEndEvent"
		 v-on:pointercancel="dragEndEvent">

		<div class="track" />

		<!-- quarter turns, the angles worth reaching in one click -->
		<button v-for="snap in SNAP_ANGLES" :key="snap" type="button" class="snap" tabindex="-1"
				:class="{ quiet: quietSnap === snap }" :style="{ '--angle': `${snap}deg` }"
				:aria-label="`Rotate to ${snap} degrees`" :data-testid="`rotate-snap-${snap}`"
				v-on:click="snapEvent(snap)" />

		<span class="knob" :style="{ '--angle': `${angle}deg` }">
			<span class="knob-dot" />
		</span>

		<input ref="inputRef" class="value degree-input" type="number" inputmode="numeric" :value="angle"
			   aria-label="Image rotation in degrees" data-testid="rotation-input" v-on:change="inputEvent"
			   v-on:keyup.enter="inputEvent" v-on:focus="selectAllEvent" />
	</div>
</template>

<script lang="ts" setup>
import { computed, ref, watch } from 'vue';

const SNAP_ANGLES = [0, 90, 180, 270];
// how close a drag has to come to a quarter turn before it sticks
const SNAP_THRESHOLD = 8;

const props = withDefaults(defineProps<{ modelValue?: number }>(), { modelValue: 0 });
const emit = defineEmits<{ (e: 'update:modelValue', angle: number): void }>();

const dialRef = ref<HTMLDivElement | null>(null);
const inputRef = ref<HTMLInputElement | null>(null);
const isDragging = ref(false);

/** wrap any value, including the string an input hands over, into [0, 360) */
function normalize(value: unknown): number {
	const degrees = Number(value);
	if (!Number.isFinite(degrees)) return 0;
	return ((Math.round(degrees) % 360) + 360) % 360;
}

const angle = ref(normalize(props.modelValue));

watch(() => props.modelValue, (value) => {
	const next = normalize(value);
	if (next !== angle.value) angle.value = next;
});

function commit(next: number | string): void {
	const normalized = normalize(next);
	if (normalized === angle.value) return;

	angle.value = normalized;
	emit('update:modelValue', normalized);
}

/** pull a drag towards a quarter turn once it is close enough */
function withSnapping(value: number): number {
	const closest = SNAP_ANGLES.reduce((nearest, snap) => {
		const distance = Math.min(Math.abs(value - snap), 360 - Math.abs(value - snap));
		return distance < nearest.distance ? { snap, distance } : nearest;
	}, { snap: value, distance: Infinity });

	return closest.distance <= SNAP_THRESHOLD ? closest.snap : value;
}

/** the angle the pointer sits at, measured clockwise from the top */
function angleFromPointer(event: PointerEvent): number | null {
	if (!dialRef.value) return null;

	const bounds = dialRef.value.getBoundingClientRect();
	const x = event.clientX - (bounds.left + bounds.width / 2);
	const y = event.clientY - (bounds.top + bounds.height / 2);

	if (x === 0 && y === 0) return null;
	return (Math.atan2(y, x) * 180 / Math.PI + 90 + 360) % 360;
}

function dragStartEvent(event: PointerEvent): void {
	// the readout in the middle stays a text field
	if ((event.target as HTMLElement).closest('.value, .snap') != null) return;
	if (event.pointerType === 'mouse' && event.button !== 0) return;

	const pointed = angleFromPointer(event);
	if (pointed == null) return;

	isDragging.value = true;
	dialRef.value?.setPointerCapture?.(event.pointerId);
	commit(withSnapping(pointed));
}

function dragMoveEvent(event: PointerEvent): void {
	if (!isDragging.value) return;

	const pointed = angleFromPointer(event);
	if (pointed == null) return;

	event.preventDefault();
	commit(withSnapping(pointed));
}

function dragEndEvent(event: PointerEvent): void {
	if (!isDragging.value) return;

	isDragging.value = false;
	dialRef.value?.releasePointerCapture?.(event.pointerId);
}

// the anchor the knob is covering, if any: it hands its area over to the knob
const quietSnap = computed(() => SNAP_ANGLES.includes(angle.value) ? angle.value : null);

// raised knob after it has been sent to an anchor, until the pointer leaves
const knobParked = ref(false);

function snapEvent(snap: number): void {
	commit(snap);
	knobParked.value = true;
}

function keyEvent(event: KeyboardEvent): void {
	const step = event.shiftKey ? 10 : 1;

	const moves: Record<string, number | undefined> = {
		ArrowUp: step,
		ArrowRight: step,
		ArrowDown: -step,
		ArrowLeft: -step,
		PageUp: 10,
		PageDown: -10
	};

	if (event.key === 'Home') {
		event.preventDefault();
		commit(0);
		return;
	}

	const move = moves[event.key];
	if (move == null) return;

	event.preventDefault();
	commit(angle.value + move);
}

function inputEvent(event: Event): void {
	const field = event.target as HTMLInputElement;
	commit(field.value);

	// the field keeps whatever was typed when normalising lands on the same angle
	field.value = String(angle.value);
	if (event.type === 'keyup') field.blur();
}

function selectAllEvent(): void {
	inputRef.value?.select();
}

defineExpose({ angle, commit });
</script>

<style scoped>
.degree-input {
    outline: none!important;
}
.dial {
	/* One place for the geometry. The ring radius is the centreline of the band,
	   and everything placed on the ring is pushed out by exactly that, so the
	   dots and the knob cannot drift off it. */
	--dial-size: 104px;
	--ring-inset: 15px;
	--ring-width: 15px;
	--ring-radius: calc(var(--dial-size) / 2 - var(--ring-inset) - var(--ring-width) / 2);

	position: relative;
	width: var(--dial-size);
	height: var(--dial-size);
	flex: none;
	border-radius: 50%;
	touch-action: none;
	cursor: grab;
}

.dial.dragging {
	cursor: grabbing;
}

.dial:focus {
	outline: none;
}

.track {
	position: absolute;
	inset: var(--ring-inset);
	border: var(--ring-width) solid rgba(var(--dynamic-bg-color), .3);
	border-radius: 50%;
	box-sizing: border-box;
	pointer-events: none;
}

/* Everything on the ring is placed by rotating it about the centre and pushing it
   out to the ring radius, so a new angle is one transform rather than a measured
   position. The element's own top edge ends up facing outwards. */
.snap,
.knob {
	position: absolute;
	top: 50%;
	left: 50%;
	transform-origin: center center;
	transform: rotate(var(--angle)) translateY(calc(-1 * var(--ring-radius)));
}

/* The anchors are small marks but generous targets: the marks are drawn by the
   pseudo elements while the button itself stays wide enough to hit. */
.snap.quiet {
	pointer-events: none;
}

.snap {
	display: block;
	width: 22px;
	height: 22px;
	margin: -11px 0 0 -11px;
	padding: 0;
	border: none;
	border-radius: 50%;
	background-color: transparent;
	cursor: pointer;
}

/* absolutely positioned rather than margin-centred: a button is a flex container
   by default here, which folds a top margin into its own centring */
.snap::before {
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

.knob {
	width: var(--ring-width);
	height: var(--ring-width);
	margin: calc(var(--ring-width) / -2) 0 0 calc(var(--ring-width) / -2);
	cursor: grab;
	z-index: 2;
}

.dial.dragging .knob {
	cursor: grabbing;
}

/* Scaled from the centreline of the ring, so growing spreads inwards and outwards
   at once and the knob reads as lifting off the band. */
.knob-dot {
	display: block;
	width: 100%;
	height: 100%;
	border-radius: 50%;
	background-color: rgb(var(--dynamic-bg-color));
	transition: transform 150ms ease-out;
}

.dial.dragging .knob-dot,
.dial.knob-parked .knob-dot {
	transform: scale(1.45);
}

@media (hover: hover) and (pointer: fine) {
	/* the dot draws out into a line across the ring, crossing both edges. The
	   radius stays at 1px because only the height grows. A click parks the knob
	   here, so the line is dropped until the pointer leaves and comes back. */
	.snap:hover:not(.quiet)::before {
		opacity: 1;
		height: 20px;
		margin-top: -13px;
		border-radius: 4px;
		background-color: #ffffff;
	}

	.knob:hover .knob-dot {
		transform: scale(1.45);
	}
}

.value {
	position: absolute;
	top: 50%;
	left: 50%;
	width: 40px;
	height: 40px;
	margin: -20px 0 0 -20px;
	border: none;
	outline: none;
	border-radius: 50%;
	background-color: transparent;
	text-align: center;
	font-size: 14px !important;
	font-weight: 600;
	padding: 0;
	cursor: text;
}

.value:focus-visible {
	outline: 2px solid rgb(var(--dynamic-bg-color));
	outline-offset: -2px;
}

.value::-webkit-outer-spin-button,
.value::-webkit-inner-spin-button {
	-webkit-appearance: none;
	margin: 0;
}

.value[type=number] {
	-moz-appearance: textfield;
	appearance: textfield;
}

@media (prefers-reduced-motion: reduce) {

	.snap::before,
	.knob-dot {
		transition: none;
	}
}
</style>
