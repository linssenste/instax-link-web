<template>
	<!-- there is nothing to configure without an image, so the panel is taken out
		 of the layout entirely once it has slid back behind the frame -->
	<div v-show="isVisible" class="settings-panel" ref="panelRef"
		 :class="{ 'no-transition': isDragging || isPositioning }" :style="{ marginTop: `${panelOffset}px` }">

		<!-- the collapsible part: how the image sits in the frame -->
		<!-- Collapsed, these controls sit behind the polaroid: inert takes them out of
			 the tab order so Tab and Shift Tab cannot reach something nobody can see.
			 The keyboard shortcuts still work, being listened for on the document. -->
		<div ref="settingsRef" class="settings-wrap" :inert="isExpanded ? undefined : true">
			<ImageSettings :hasImage="hasImage" :alignment="alignment" v-on:change="$emit('change', $event)"
						   v-on:scale="$emit('scale', $event)" v-on:centre="$emit('centre', $event)"
						   v-on:move="$emit('move', $event)" v-on:open-film="$emit('open-film')"
						   v-on:toggle-settings="toggleClickEvent" />
		</div>

		<!-- the footer stays visible while the panel is collapsed, so the image can
			 be printed or downloaded without opening the settings first -->
		<div ref="footerRef" class="panel-footer">

			<div class="print-download-action-buttons">

				<!-- print image button if connected -->
				<LoadingButton v-if="config.connection" :style="awaitingQueue" :loading="savingAction === 'print'"
							   :disabled="savingAction === 'download'" label="Print Image" loadingLabel="Rendering"
							   class="action-button" data-testid="print-image-button"
							   title="print image with instax printer" v-on:click="saveEvent(false)" />


				<!-- download image as polaroid button if not connected -->
				<LoadingButton v-else :loading="savingAction === 'download'" label="Download" loadingLabel="Rendering"
							   :icon="downloadIcon" class="action-button" data-testid="download-image-button"
							   v-on:click="saveEvent(true)" />


				<!-- icon button to download (without subtitle) -->
				<LoadingButton v-if="config.connection" :loading="savingAction === 'download'"
							   :disabled="savingAction === 'print'" :icon="downloadIcon"
							   class="download-icon-button" data-testid="download-image-icon-button"
							   aria-label="Download the polaroid" title="Download the polaroid"
							   v-on:click="saveEvent(true)" />

			</div>

			<!-- grab handle: click to toggle, drag vertically to slide the panel
				 out from behind the polaroid frame -->
			<button type="button" class="expand-button" data-testid="expand-handle" :aria-expanded="isExpanded"
					:disabled="saving"
					:title="titleWith(`${isExpanded ? 'Hide' : 'Show'} image settings`, SHORTCUTS.settings)"
					v-on:click="toggleClickEvent" v-on:pointerdown="dragStartEvent" v-on:pointermove="dragMoveEvent"
					v-on:pointerup="dragEndEvent" v-on:pointercancel="dragEndEvent">
				<span class="chevron" aria-hidden="true"
					  :style="{ transform: `rotate(${isExpanded ? -180 : 0}deg)` }" />
			</button>
		</div>
	</div>
</template>

<script setup lang="ts">
import { MAX_QUEUE_LENGTH } from '../../interfaces/QueueImage';
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import ImageSettings from '../polaroid/ImageSettings.vue';
import { NOT_ALIGNED, type FrameAlignment } from '../../polaroid/frame.geometry';
import { titleWith, SHORTCUTS } from '../../polaroid/shortcuts';
import LoadingButton from '../controls/LoadingButton.vue';
import downloadIcon from '@/assets/icons/controls/download.svg';
import type { PrinterStateConfig } from '../../interfaces/PrinterStateConfig';

defineEmits<{
	(e: 'change', settings: { rotation: number; text: string; color: string }): void;
	(e: 'scale', type: string): void;
	(e: 'centre', axis: string): void;
	(e: 'move', by: { x: number, y: number }): void;
	(e: 'open-film'): void;
}>();

const props = withDefaults(defineProps<{
	config: PrinterStateConfig;
	hasImage: boolean;
	queueLength: number;
	savePolaroid: (download: boolean) => void;
	/** which action is rendering, so only that button reports progress */
	savingAction?: 'print' | 'download' | null;
	/** which framing states already hold, handed down to the controls */
	alignment?: FrameAlignment;
}>(), { savingAction: null, alignment: () => ({ ...NOT_ALIGNED }) });

const saving = computed(() => props.savingAction != null);

// the printer only takes so many images at a time
const awaitingQueue = computed(() => {
	if (props.queueLength >= MAX_QUEUE_LENGTH) return `background-color: rgb(var(--grey-color))!important; opacity: .2; cursor: not-allowed; pointer-events: none!important; color: black;`;
	else return ''
});

// fallback for the footer height before it has been measured
const FALLBACK_FOOTER_HEIGHT = 35;
// offset of the fully revealed panel; slightly negative so it tucks under the frame
const EXPANDED_OFFSET = -20;
// a pointer movement below this is treated as a click, not a drag
const DRAG_CLICK_THRESHOLD = 6;
// how long the panel takes to slide; matches the transition on .settings-panel
const PANEL_TRANSITION_MS = 250;

const panelRef = ref<HTMLDivElement | null>(null);
const footerRef = ref<HTMLDivElement | null>(null);
const panelHeight = ref(0);
const footerHeight = ref(0);
const isExpanded = ref(false);
const settingsRef = ref<HTMLDivElement | null>(null);

// inert is meant to blow focus away on its own, but not every engine does it yet and
// jsdom does none of it, so the focused control is let go of by hand
watch(isExpanded, (expanded) => {
	if (expanded) return;

	const focused = document.activeElement;
	if (focused instanceof HTMLElement && settingsRef.value?.contains(focused)) focused.blur();
});
const isDragging = ref(false);

// set while the panel is being put on a position it should snap to rather than
// animate towards
const isPositioning = ref(false);

// set while the panel is sliding in or out from behind the frame, so the resting
// position does not get applied on top of the animation
const isAnimating = ref(false);

// kept visible while it slides back behind the frame, before leaving the layout
const isHiding = ref(false);

const isVisible = computed(() => props.hasImage || isHiding.value);

// The panel is pulled up behind the polaroid frame by a negative margin, leaving
// only its bottom edge showing. Both heights are measured rather than assumed,
// since the footer grows when a printer connects and the settings row can wrap.
const collapsedOffset = computed(() => {
	const visible = footerHeight.value || FALLBACK_FOOTER_HEIGHT;
	return Math.min(EXPANDED_OFFSET, -(panelHeight.value - visible));
});

// fully tucked behind the polaroid: none of the panel shows
const hiddenOffset = computed(() => -panelHeight.value);

// where the panel comes to rest, open or closed
const restingOffset = computed(() => isExpanded.value ? EXPANDED_OFFSET : collapsedOffset.value);

const panelOffset = ref(EXPANDED_OFFSET);

let dragStartPointer = 0;
let dragStartOffset = 0;
let didDrag = false;
let resizeObserver: ResizeObserver | null = null;

const clampOffset = (offset: number) => Math.min(Math.max(offset, collapsedOffset.value), EXPANDED_OFFSET);

function measurePanel(): void {
	if (panelRef.value) panelHeight.value = panelRef.value.getBoundingClientRect().height;
	if (footerRef.value) footerHeight.value = footerRef.value.getBoundingClientRect().height;
}

// keep the resting position in sync with the measured height
watch(restingOffset, () => {
	if (isDragging.value || isAnimating.value) return;
	panelOffset.value = restingOffset.value;
}, { immediate: true });

// identifies the current reveal, so one that is still in flight when the image
// changes again cannot finish and open a panel that should be gone
let revealToken = 0;

// the panel comes up collapsed, so a new image shows only its action button, and
// slides back out of sight when the image is removed
watch(() => props.hasImage, (hasImage) => {
	revealToken++;

	isExpanded.value = false;
	if (hasImage) isHiding.value = false;

	if (hasImage) revealFromBehindFrame(revealToken);
	else hideBehindFrame(revealToken);
});

function endAnimation(): void {
	isPositioning.value = false;
	isAnimating.value = false;
}

/**
 * Slide the panel back under the polaroid, then drop it out of the layout.
 *
 * The reverse of the reveal, so removing an image is as smooth as adding one. It
 * has to stay visible for the length of the slide, which is why the panel is
 * shown on `isVisible` rather than on `hasImage` alone.
 */
async function hideBehindFrame(token: number): Promise<void> {
	if (panelHeight.value <= 0) {
		// never measured, so there is nothing on screen to animate away
		isHiding.value = false;
		endAnimation();
		return;
	}

	isHiding.value = true;
	isAnimating.value = true;
	isPositioning.value = false; // transitions stay on, this one animates

	await nextTick();
	if (token !== revealToken) return;

	panelOffset.value = hiddenOffset.value;

	await new Promise((resolve) => setTimeout(resolve, PANEL_TRANSITION_MS));
	if (token !== revealToken) return;

	isHiding.value = false;
	endAnimation();
}

/**
 * Slide the panel out from behind the polaroid, stopping at its collapsed
 * position with the action button showing.
 *
 * The panel has no box while hidden, so where it should start and stop is not
 * known until it is shown. The starting offset then has to be committed by the
 * browser before the target is set: otherwise both land in a single style
 * recalculation, the browser only ever sees the end value, and the panel jumps.
 * Measuring is itself what forces that commit, which is why the order below
 * matters - measure first, then position, then commit, then move.
 */
async function revealFromBehindFrame(token: number): Promise<void> {
	isPositioning.value = true;
	isAnimating.value = true;

	// let v-show give the panel a box, then measure it
	await nextTick();
	if (token !== revealToken) return endAnimation();
	measurePanel();

	// start fully tucked away behind the frame
	panelOffset.value = hiddenOffset.value;
	await nextTick();
	if (token !== revealToken) return endAnimation();

	// Commit that starting position while transitions are still off. Doing this
	// after switching them back on would make the panel animate *towards* the
	// hidden offset first, from whatever stale value the measurement committed.
	void panelRef.value?.offsetHeight;

	// transitions back on, starting offset unchanged so nothing moves yet
	isPositioning.value = false;
	await nextTick();
	if (token !== revealToken) return endAnimation();

	// and slide out to the collapsed resting position
	isAnimating.value = false;
	panelOffset.value = collapsedOffset.value;
}

function toggleClickEvent(): void {
	if (saving.value) return;

	// swallow the click that terminates a drag gesture
	if (didDrag) {
		didDrag = false;
		return;
	}
	if (!props.hasImage) return;
	isExpanded.value = !isExpanded.value;
}

function dragStartEvent(event: PointerEvent): void {
	if (!props.hasImage || saving.value) return;
	if (event.pointerType === 'mouse' && event.button !== 0) return;

	didDrag = false;
	isDragging.value = true;
	dragStartPointer = event.clientY;
	dragStartOffset = panelOffset.value;

	// capture so the gesture keeps tracking outside the small handle
	(event.currentTarget as HTMLElement).setPointerCapture?.(event.pointerId);
}

function dragMoveEvent(event: PointerEvent): void {
	if (!isDragging.value) return;

	const delta = event.clientY - dragStartPointer;
	if (Math.abs(delta) > DRAG_CLICK_THRESHOLD) didDrag = true;

	panelOffset.value = clampOffset(dragStartOffset + delta);
}

function dragEndEvent(event: PointerEvent): void {
	if (!isDragging.value) return;
	isDragging.value = false;
	(event.currentTarget as HTMLElement).releasePointerCapture?.(event.pointerId);

	if (!didDrag) {
		panelOffset.value = isExpanded.value ? EXPANDED_OFFSET : collapsedOffset.value;
		return;
	}

	// snap to whichever resting position is closer
	const toExpanded = Math.abs(panelOffset.value - EXPANDED_OFFSET);
	const toCollapsed = Math.abs(panelOffset.value - collapsedOffset.value);

	isExpanded.value = toExpanded <= toCollapsed;
	panelOffset.value = isExpanded.value ? EXPANDED_OFFSET : collapsedOffset.value;
}

// collapse before handing over, so the panel is out of the way while the
// polaroid is rendered
function saveEvent(download: boolean): void {
	if (saving.value) return;
	isExpanded.value = false;
	props.savePolaroid(download);
}

onMounted(() => {
	measurePanel();

	if (typeof ResizeObserver === 'undefined' || !panelRef.value) return;
	resizeObserver = new ResizeObserver(measurePanel);
	resizeObserver.observe(panelRef.value);
	if (footerRef.value) resizeObserver.observe(footerRef.value);
});

onBeforeUnmount(() => {
	resizeObserver?.disconnect();
	resizeObserver = null;
});
</script>

<style scoped>
.settings-panel {
	position: relative;
	margin-left: 3px;
	width: calc(100% - 6px);
	-webkit-backdrop-filter: blur(8px);
	backdrop-filter: blur(8px);
	background-color: rgba(var(--dynamic-bg-color), .1);
	border-bottom-right-radius: 10px;
	border-bottom-left-radius: 10px;
	z-index: 0;
	padding-top: 28px;
	overflow: hidden;
	transition: margin-top 250ms ease, opacity 250ms ease;

	-webkit-user-select: none;
	user-select: none;
}

/* no transition while the finger is on the handle, or while the panel is being
   put into the position it animates from */
.settings-panel.no-transition {
	transition: none;
}

.panel-footer {
	position: relative;
	display: flex;
	flex-direction: column;

	/* the top padding is measured as part of the footer, so it becomes a gap
	   between the polaroid's edge and the action button while collapsed. No
	   horizontal padding here: the grab handle runs the full width */
	padding: 12px 0 0;
}

.print-download-action-buttons {
	position: relative;
	width: 100%;
	display: flex;
	flex-direction: row;
	align-items: center;
	padding: 0 10px;
	box-sizing: border-box;
}

.action-button {
	width: 100%;
	color: white;
}


.download-icon-button {
	margin-left: 5px;
	width: 40px;
	padding: 0;
	position: relative;

	/* the action button beside it asks for 100% width, so this one has to refuse
	   to shrink or it stops being a circle */
	flex: none;
	border-radius: 50%;

	/* the spinner inside draws in currentColor */
	color: white;
}

.expand-button {
	position: relative;
	background-color: transparent;
	outline: none;
	display: flex;
	align-items: center;
	justify-content: center;
	border: none;
	width: 100%;
	height: 30px;
	margin-top: 6px;
	padding: 5px;
	cursor: pointer;

	/* reset the global button styling */
	border-radius: 0;
	opacity: 1;
	font-size: inherit;
	letter-spacing: normal;

	/* let the handle receive touch drags instead of scrolling the page */
	touch-action: none;
	-webkit-user-select: none;
	user-select: none;
}


.chevron {
	width: 23px;
	height: 23px;
	background-color: rgb(var(--black-color));
	opacity: .4;

	/* masked rather than an <img>, so the arrow can take the theme colour */
	-webkit-mask: url('../../assets/icons/controls/chevron.svg') center / contain no-repeat;
	mask: url('../../assets/icons/controls/chevron.svg') center / contain no-repeat;

	transition: opacity 250ms ease, transform 250ms ease, background-color 250ms ease;
}

@media (hover: hover) and (pointer: fine) {

	/* the handle carries the panel's own tint, so hovering pulls more of the
	   theme colour through rather than lifting the button off the surface */
	.expand-button:hover:not(:disabled) {
		background-color: rgba(var(--dynamic-bg-color), .2);
		box-shadow: none;
	}

	.expand-button:hover:not(:disabled) .chevron {
		background-color: rgb(var(--dynamic-bg-color));
		opacity: 1;
	}
}

.expand-button:disabled {
	cursor: progress;
}

.expand-button:disabled .chevron {
	opacity: .12;
}
</style>
