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
		</div>

		<div v-else-if="hasBluetoothAccess && config.connection" class="connected-printer"
			data-testid="connected-printer">


			<PrinterStatusCard :config="config" />

			<StatusAlerts v-if="config.status != null" :status="config.status" />

			<div v-if="config.status != null && queue.length > 0" class="printing-queue">
				<QueueElement v-for="(element, index) in queue" :key="index" :element="element"
					v-on:cancel="removeImageEvent(index)" v-on:quantity-change="element.quantity = $event"
					v-on:retry="$emit('retry')" />
			</div>

		</div>

		<HelpDialog :open="helpOpen" v-on:close="helpOpen = false" />
	</div>

</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue';

import QueueElement from '../printer/QueueElement.vue'
import StatusAlerts from '../printer/StatusAlerts.vue'

import type { PrinterStateConfig } from '../../interfaces/PrinterStateConfig';
import type { QueueImage } from '../../interfaces/QueueImage'
import PrinterStatusCard from './PrinterStatusCard.vue';
import LoadingButton from '../controls/LoadingButton.vue';
import HelpDialog from '../help/HelpDialog.vue';
import bluetoothIcon from '@/assets/icons/printer/bluetooth.svg';

defineEmits<{ (e: 'retry'): void }>();

const props = defineProps<{
	config: PrinterStateConfig;
	queue: QueueImage[]
}>();

const connecting = ref(false);
const helpOpen = ref(false);

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


function removeImageEvent(index: number): void {

	if (index == 0 && (props.config.status?.polaroidCount ?? 0) > 0) {
		props.queue[0].abortController?.abort();
	}

}


</script>


<style scoped>
.connect-button {
	color: #FFFFFF;


	padding-left: 30px;
	padding-right: 30px;
}


/* the scrolling box is widened to the window edge and its contents padded back,
   so the bar rides in the gutter beside the cards rather than over them - an
   overlay scrollbar draws inside the box, and the box used to stop where the
   cards did */
.printing-queue {
	position: relative;
	width: calc(100% + var(--panel-inset));
	max-height: calc(100vh - 130px);
	margin-right: calc(var(--panel-inset) * -1);
	padding-right: var(--panel-inset);
	box-sizing: border-box;
	overflow-y: auto;
	overflow-x: hidden;
	scrollbar-gutter: stable;
}

.connected-printer {
	position: relative;
}

.printer-connection {
	position: relative;
	display: flex;
	flex-direction: column;
	align-items: center;
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
	gap: 8px;
	width: 100%;
}

.connect-row .connect-button {
	flex: 1 1 auto;
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