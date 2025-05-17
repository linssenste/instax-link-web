<template>
	<div id="printer-settings">

		<div v-if="!config.connection" class="printer-connection">

			<button :disabled="!hasBluetoothAccess" v-on:click="config.connect" class="connect-button"
				data-testid="connect-printer-button">
				<img width="18" draggable="false" height="18" alt="bluetooth icon to connect"
					src="@/assets/icons/printer/bluetooth.svg" />
				<span>Connect</span>
			</button>

			<a v-if="!hasBluetoothAccess" class="no-support-text"
				href="https://developer.mozilla.org/en-US/docs/Web/API/Bluetooth#browser_compatibility">
				Browser not supported
			</a>
		</div>

		<div v-else-if="hasBluetoothAccess && config.connection" class="connected-printer"
			data-testid="connected-printer">


			<PrinterStatusCard :config="config" />

			<StatusAlerts v-if="config.status != null" :status="config.status" />

			<div v-if="config.status != null" class="printing-queue">
				<QueueElement v-for="(element, index) in queue" :key="index" :element="element"
					v-on:cancel="removeImageEvent(index)" v-on:quantity-change="element.quantity = $event" />
			</div>

		</div>

	</div>


</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue';

import QueueElement from '../printer/QueueElement.vue'
import StatusAlerts from '../printer/StatusAlerts.vue'

import type { PrinterStateConfig } from '../../interfaces/PrinterStateConfig';
import type { QueueImage } from '../../interfaces/QueueImage'
import PrinterStatusCard from './PrinterStatusCard.vue';

const props = defineProps<{
	config: PrinterStateConfig;
	queue: QueueImage[]
}>();
props.mobile;

declare global {
	interface Navigator {
		bluetooth?: {
			getAvailability(): Promise<boolean>;
			// Add other Bluetooth API methods here if needed
		};
	}
}

const hasBluetoothAccess = ref(true);

onMounted(() => {

	console.log('PrinterConnection mounted');
	console.log(navigator.bluetooth)
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
props.config;




function removeImageEvent(index: number): void {

	if (index == 0 && props.config.status.polaroidCount > 0) {
		props.queue[0].abortController.abort();
	}

}


</script>


<style scoped>
.connect-button {
	color: #FFFFFF;


	padding-left: 30px;
	padding-right: 30px;
}

.connect-button:disabled {

	background-color: var(--grey-color) !important;
	cursor: not-allowed !important;
	opacity: 0.4 !important;
}


.printing-queue {
	position: relative;
	width: 100%;
	height: calc(100vh - 130px);
	overflow: scroll;
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



.no-support-text {
	text-align: center;
	color: var(--dynamic-bg-color);
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