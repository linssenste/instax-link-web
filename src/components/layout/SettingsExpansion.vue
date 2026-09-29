<template>
	<!-- there is nothing to configure without an image, so the panel is taken out
		 of the layout entirely rather than just dimmed -->
	<div v-show="hasImage" class="settings-panel" ref="panelRef" :class="{ 'no-transition': isDragging || isPositioning }"
		 :style="{ marginTop: `${panelOffset}px` }">

		<!-- the collapsible part: how the image sits in the frame -->
		<ImageSettings :hasImage="hasImage" v-on:change="$emit('change', $event)"
					   v-on:scale="$emit('scale', $event)" />

		<!-- the footer stays visible while the panel is collapsed, so the image can
			 be printed or downloaded without opening the settings first -->
		<div ref="footerRef" class="panel-footer">

			<div class="print-download-action-buttons">

				<!-- print image button if connected -->
				<button v-if="config.connection" type="button" :style="awaitingQueue" v-on:click="saveEvent(false)"
						data-testid="print-image-button" title="print image with instax printer" class="action-button">
					<span>
						Print Image
					</span>
				</button>


				<!-- download image as polaroid button if not connected -->
				<button v-else type="button" v-on:click="saveEvent(true)" class="action-button"
						data-testid="download-image-button">
					<img draggable="false" alt="" src="@/assets/icons/controls/download.svg" width="14" height="14" />
					Download
				</button>


				<!-- icon button to download (without subtitle) -->
				<button v-if="config.connection" type="button" v-on:click="saveEvent(true)" class="download-icon-button"
						data-testid="download-image-icon-button" aria-label="Download the polaroid"
						title="Download the polaroid">
					<img draggable="false" alt="" src="@/assets/icons/controls/download.svg" width="14" height="14" />
				</button>
			</div>

			<!-- grab handle: click to toggle, drag vertically to slide the panel
				 out from behind the polaroid frame -->
			<button type="button" class="expand-button" data-testid="expand-handle" :aria-expanded="isExpanded"
					:title="`${isExpanded ? 'Hide' : 'Show'} image settings`" v-on:click="toggleClickEvent"
					v-on:pointerdown="dragStartEvent" v-on:pointermove="dragMoveEvent" v-on:pointerup="dragEndEvent"
					v-on:pointercancel="dragEndEvent">
				<img width="15" height="15" alt="" :draggable="false"
					 :style="{ transform: `rotate(${isExpanded ? -180 : 0}deg)` }"
					 :title="`${isExpanded ? 'Hide' : 'Show'} image settings`"
					 src="@/assets/icons/controls/chevron-down.svg" />
			</button>
		</div>
	</div>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import ImageSettings from '../polaroid/ImageSettings.vue';
import type { PrinterStateConfig } from '../../interfaces/PrinterStateConfig';

defineEmits<{
	(e: 'change', settings: { rotation: number; text: string; color: string }): void;
	(e: 'scale', type: string): void;
}>();

const props = defineProps<{
	config: PrinterStateConfig;
	hasImage: boolean;
	queueLength: number;
	savePolaroid: (download: boolean) => void;
}>();

// the printer only takes so many images at a time
const awaitingQueue = computed(() => {
	if (props.queueLength > 2) return `background-color: rgb(var(--grey-color))!important; opacity: .2; cursor: not-allowed; pointer-events: none!important; color: black;`;
	else return ''
});

// fallback for the footer height before it has been measured
const FALLBACK_FOOTER_HEIGHT = 35;
// offset of the fully revealed panel; slightly negative so it tucks under the frame
const EXPANDED_OFFSET = -20;
// a pointer movement below this is treated as a click, not a drag
const DRAG_CLICK_THRESHOLD = 6;

const panelRef = ref<HTMLDivElement | null>(null);
const footerRef = ref<HTMLDivElement | null>(null);
const panelHeight = ref(0);
const footerHeight = ref(0);
const isExpanded = ref(false);
const isDragging = ref(false);

// set while the panel is being put on a position it should snap to rather than
// animate towards
const isPositioning = ref(false);

// set while the panel is sliding out from behind the frame, so the resting
// position does not get applied on top of the animation
const isRevealing = ref(false);

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
	if (isDragging.value || isRevealing.value) return;
	panelOffset.value = restingOffset.value;
}, { immediate: true });

// identifies the current reveal, so one that is still in flight when the image
// changes again cannot finish and open a panel that should be gone
let revealToken = 0;

// the panel comes up collapsed, so a new image shows only its action button
watch(() => props.hasImage, (hasImage) => {
	revealToken++;
	isExpanded.value = false;

	if (!hasImage) {
		endReveal();
		return;
	}

	revealFromBehindFrame(revealToken);
});

function endReveal(): void {
	isPositioning.value = false;
	isRevealing.value = false;
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
	isRevealing.value = true;

	// let v-show give the panel a box, then measure it
	await nextTick();
	if (token !== revealToken) return endReveal();
	measurePanel();

	// start fully tucked away behind the frame
	panelOffset.value = hiddenOffset.value;
	await nextTick();
	if (token !== revealToken) return endReveal();

	// Commit that starting position while transitions are still off. Doing this
	// after switching them back on would make the panel animate *towards* the
	// hidden offset first, from whatever stale value the measurement committed.
	void panelRef.value?.offsetHeight;

	// transitions back on, starting offset unchanged so nothing moves yet
	isPositioning.value = false;
	await nextTick();
	if (token !== revealToken) return endReveal();

	// and slide out to the collapsed resting position
	isRevealing.value = false;
	panelOffset.value = collapsedOffset.value;
}

function toggleClickEvent(): void {
	// swallow the click that terminates a drag gesture
	if (didDrag) {
		didDrag = false;
		return;
	}
	if (!props.hasImage) return;
	isExpanded.value = !isExpanded.value;
}

function dragStartEvent(event: PointerEvent): void {
	if (!props.hasImage) return;
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
	background-color: rgba(255, 255, 255, 0.5);
	border-bottom-right-radius: 10px;
	border-bottom-left-radius: 10px;
	z-index: 0;
	padding-top: 42px;
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
	   between the polaroid's edge and the action button while collapsed */
	padding: 12px 10px 0;
}

.print-download-action-buttons {
	position: relative;
	width: 100%;
	display: flex;
	flex-direction: row;
	align-items: center;
}

.action-button {
	width: 100%;
	color: white;
}

.download-icon-button {
	margin-left: 5px;
	width: 40px;
	position: relative;
}

.download-icon-button img {
	position: absolute;
	top: 50%;
	left: 50%;
	transform: translate(-50%, -50%);
	margin-right: 0;
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

.expand-button:focus-visible {
	outline: 2px solid rgb(var(--dynamic-bg-color));
	outline-offset: -2px;
}

.expand-button img {
	margin-right: 0;
	opacity: 0.3;
	transition: opacity 250ms ease, transform 250ms ease;
}

.expand-button:hover img {
	opacity: 1;
}
</style>
