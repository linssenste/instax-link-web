<template>
	<div id="printer-settings">

		<div v-if="!config.connection" class="printer-connection">

			<div class="connect-row">
				

				<!-- what this is, which printers it speaks to, and the keyboard -->
				<button type="button" class="help-button" data-testid="open-help-button"
						title="About this, the printers it works with, and the keyboard"
						aria-label="About this app" v-on:click="helpOpen = true">
					<span class="help-icon" aria-hidden="true" />
				</button>

				<LoadingButton :disabled="!hasBluetoothAccess" :loading="connecting" :icon="bluetoothIcon"
							   :iconSize="22" label="Connect" loadingLabel="Connecting" class="connect-button"
							   data-testid="connect-printer-button" v-on:click="connectEvent" />
			</div>

			<a v-if="!hasBluetoothAccess" class="no-support-text" data-testid="no-support-text"
				href="https://developer.mozilla.org/en-US/docs/Web/API/Bluetooth#browser_compatibility">
				Browser not supported
			</a>

			<!-- The queue outlives a disconnect, so it stays reachable: collapsed to a
				 count by default, because without a printer there is nothing happening
				 to watch - but openable, so the photos can still be edited or dropped
				 before the next printer arrives. -->
			<button v-if="queue.length > 0" type="button" class="queue-summary"
					data-testid="offline-queue-toggle" :aria-expanded="offlineQueueOpen"
					aria-controls="offline-queue" v-on:click="offlineQueueOpen = !offlineQueueOpen">
				<span>{{ queueSummary }}</span>
				<span class="chevron" :class="{ open: offlineQueueOpen }" aria-hidden="true" />
			</button>
		</div>

		<div v-else-if="hasBluetoothAccess && config.connection" class="connected-printer"
			data-testid="connected-printer">


			<PrinterStatusCard :config="config" />

			<StatusAlerts v-if="config.status != null" :status="config.status"
				:preparing="config.preparing" />

		</div>

		<!-- Outside both branches: the same cards serve a connected printer and a
			 queue waiting for one. Not gated on the queue having anything in it - a
			 card leaving is still mounted while it animates, and dropping the
			 container the moment the count reached zero destroyed it mid-slide, so
			 removing the last photo never animated at all. An empty box is zero
			 height and costs nothing. -->
		<div v-if="showQueue" id="offline-queue" class="printing-queue">
			<!-- keyed by the photo, not its position: the queue is shifted from the
				 front, so an index key hands one card's state to the next photo.
				 The key is also what lets the group animate a removal rather than
				 having a card blink out of existence -->
			<TransitionGroup name="queue-card" v-on:before-leave="rememberCardHeight">
				<QueueElement v-for="element in queue" :key="element.id" :element="element"
					v-on:cancel="$emit('cancel', element.id)"
					v-on:quantity-change="$emit('quantity-change', element.id, $event)"
					v-on:retry="$emit('retry')" />
			</TransitionGroup>
		</div>

		<HelpDialog :open="helpOpen" v-on:close="helpOpen = false" />
	</div>

</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';

import QueueElement from '../printer/QueueElement.vue'
import StatusAlerts from '../printer/StatusAlerts.vue'

import type { PrinterStateConfig } from '../../interfaces/PrinterStateConfig';
import type { QueueImage } from '../../interfaces/QueueImage'
import PrinterStatusCard from './PrinterStatusCard.vue';
import LoadingButton from '../controls/LoadingButton.vue';
import HelpDialog from '../help/HelpDialog.vue';
import bluetoothIcon from '@/assets/icons/printer/bluetooth.svg';

/**
 * Measure a card before it leaves.
 *
 * Its height is only knowable from the element, and the leave animation has to
 * collapse from that height to nothing - `height: auto` is not something CSS can
 * animate away from.
 */
function rememberCardHeight(el: Element): void {
	const card = el as HTMLElement;
	card.style.setProperty('--card-height', `${card.getBoundingClientRect().height}px`);
}

defineEmits<{
	(e: 'retry'): void;
	(e: 'cancel', id: number): void;
	(e: 'quantity-change', id: number, quantity: number): void;
}>();

const props = defineProps<{
	config: PrinterStateConfig;
	queue: QueueImage[]
}>();

const connecting = ref(false);
const helpOpen = ref(false);

/** Whether the queue is open while there is no printer to print it. */
const offlineQueueOpen = ref(false);

const queueSummary = computed(() => props.queue.length === 1
	? '1 image waiting'
	: `${props.queue.length} images waiting`);

/**
 * A connected printer always shows its queue; without one it is the user's call.
 *
 * Kept mounted rather than torn down, so a card removed from it can animate out.
 */
const showQueue = computed(() => props.config.connection
	? props.config.status != null
	: offlineQueueOpen.value);

// nothing left to show, so it should not reopen to an empty box next time
watch(() => props.queue.length, (length) => {
	if (length === 0) offlineQueueOpen.value = false;
});

async function connectEvent(): Promise<void> {
	if (connecting.value) return;

	connecting.value = true;
	try {
		await props.config.connect();
	} catch (error) {
		// a rejected attempt is already handled upstream; it must not escape here
		console.error('> could not connect to the printer', error);
	} finally {
		connecting.value = false;
	}
}


const hasBluetoothAccess = ref(true);

onMounted(() => {

	try {
		if (!navigator.bluetooth) {
			console.error('Bluetooth API not supported');
			hasBluetoothAccess.value = false;
			return;
		}
		// check bluetooth access
		navigator.bluetooth?.getAvailability()?.then(available => {
			if (available) {
				hasBluetoothAccess.value = true;
			}
		});
	} catch (error) {
		console.error('Bluetooth API not supported:', error);
		hasBluetoothAccess.value = false
	}


})



</script>


<style scoped>
/* one width for every state, so nothing in here moves when the contents change */
#printer-settings {
	box-sizing: border-box;
	width: var(--printer-panel-width);
	max-width: 100%;
}

.connect-button {
	color: #FFFFFF;


	padding-left: 30px;
	padding-right: 30px;
}


/* the scrolling box is widened to the window edge and its contents padded back,
   so the bar rides in the gutter beside the cards rather than over them - an
   overlay scrollbar draws inside the box, and the box used to stop where the
   cards did */
/* the count and its arrow, sitting under the connect button */
.queue-summary {
	display: flex;
	align-items: center;
	/* against the right edge, under the connect button it belongs to */
	justify-content: flex-end;
	gap: 2px;
	width: 100%;
	height: 34px;
	padding: 0 2px 0 8px;
	border-radius: 17px;
	background-color: transparent !important;
	box-shadow: none !important;
	color: rgb(var(--black-color));
	font-size: 13px;
	letter-spacing: 1px;
	text-transform: uppercase;
	opacity: .55;
	transition: opacity 150ms ease;
}

@media (hover: hover) and (pointer: fine) {
	.queue-summary:hover {
		opacity: .9;
	}
}

.queue-summary .chevron {
	width: 20px;
	height: 20px;
	background-color: currentColor;
	-webkit-mask: url('../../assets/icons/controls/chevron.svg') center / contain no-repeat;
	mask: url('../../assets/icons/controls/chevron.svg') center / contain no-repeat;
	transition: transform 250ms ease;
}

.queue-summary .chevron.open {
	transform: rotate(180deg);
}

@media (prefers-reduced-motion: reduce) {

	.queue-summary,
	.queue-summary .chevron {
		transition: none;
	}
}

.printing-queue {
	position: relative;
	width: calc(100% + var(--panel-inset));
	max-height: calc(100vh - 130px);
	margin-right: calc(var(--panel-inset) * -1);
	padding-right: var(--panel-inset);
	/* room under the last card, so it is not flush against the end of the scroll */
	padding-bottom: 20px;
	box-sizing: border-box;
	overflow-y: auto;
	overflow-x: hidden;
	scrollbar-gutter: stable;
}

/* A card leaves in two movements: it slides out to the right, and then its own
   box collapses, which is what draws the cards below it up.

   It deliberately stays in the flow. Taking it out with `position: absolute` let
   the others move at the same time, which read as the whole list lurching rather
   than one card leaving - and because this container is the card's containing
   block, removing the last card collapsed the container to nothing and clipped
   the card before it had moved at all.
   
   Collapsing needs a height to collapse from, which only the element knows;
   `before-leave` measures it into --card-height. */
.queue-card-leave-active {
	box-sizing: border-box;
	overflow: hidden;
	pointer-events: none;
	animation: queue-card-leave 480ms cubic-bezier(.3, .1, .3, 1) forwards;
}

@keyframes queue-card-leave {
	0% {
		transform: translateX(0);
		opacity: 1;
		height: var(--card-height);
		margin-top: 15px;
		padding-top: 10px;
		padding-bottom: 10px;
	}

	/* gone from view, still holding its place */
	45% {
		transform: translateX(112%);
		opacity: 0;
		height: var(--card-height);
		margin-top: 15px;
		padding-top: 10px;
		padding-bottom: 10px;
	}

	/* and now the place itself closes up */
	100% {
		transform: translateX(112%);
		opacity: 0;
		height: 0;
		margin-top: 0;
		padding-top: 0;
		padding-bottom: 0;
	}
}

/* a new card fades up rather than appearing mid-air */
.queue-card-enter-active {
	transition: transform 220ms ease-out, opacity 220ms ease-out;
}

.queue-card-enter-from {
	transform: translateY(-8px);
	opacity: 0;
}

/* reordering, which the collapse above does not cover */
.queue-card-move {
	transition: transform 300ms cubic-bezier(.22, .61, .36, 1);
}

@media (prefers-reduced-motion: reduce) {

	.queue-card-enter-active,
	.queue-card-move {
		transition: none;
	}

	.queue-card-leave-active {
		animation-duration: 1ms;
	}
}

.connected-printer {
	position: relative;
}

.printer-connection {
	position: relative;
	display: flex;
	flex-direction: column;
	/* against the right edge, where the panel itself sits. The panel holds a fixed
	   width so the queue cards match the connected ones, and nothing in here
	   stretches to fill it - the button keeps its own size */
	align-items: flex-end;
	justify-content: center;
	width: 100%;
	height: 100%;
	gap: 4px;
}

/* the connect button keeps the room it had; the question mark sits beside it */
.connect-row {
	display: flex;
	flex-direction: row;
	align-items: center;
	justify-content: flex-end;
	gap: 8px;
	width: auto;
}

/* sized by its label, not by the panel it sits in */
.connect-row .connect-button {
	flex: 0 0 auto;
}

.help-button {
	position: relative;
	flex: none;
	width: 40px;
	height: 40px;
	padding: 0;
	border: none;
	border-radius: 50%;
	opacity: 1;
	background-color: rgba(var(--dynamic-bg-color), .12);
	cursor: pointer;
}

/* a mask rather than an image, so the mark takes the theme colour */
.help-icon {
	position: absolute;
	top: 50%;
	left: 50%;
	width: 20px;
	height: 20px;
	margin: -10px 0 0 -10px;
	background-color: rgb(var(--dynamic-bg-color));
	-webkit-mask: url('@/assets/icons/controls/help.svg') center / contain no-repeat;
	mask: url('@/assets/icons/controls/help.svg') center / contain no-repeat;
}

.help-button:focus-visible {
	outline: 2px solid rgb(var(--dynamic-bg-color));
	outline-offset: 2px;
}

@media (hover: hover) and (pointer: fine) {
	.help-button:hover {
		background-color: rgba(var(--dynamic-bg-color), .2);
		box-shadow: none;
	}
}


.no-support-text {
	text-align: center;
	color: rgb(var(--dynamic-bg-color));
	margin-top: 5px;
	font-size: 14px;
}

.no-support-text:visited {
	color: black;
}

@media screen and (max-width: 1000px) {
	.connect-button {
		width: 100% !important;
		height: 50px !important;
		font-size: larger;
	}

	.connect-button img {
		width: 22px;
		height: 22px;
		margin-right: 10px;
	}

	.no-support-text {

		margin-top: 10px;
		font-size: 15px;
	}
}
</style>