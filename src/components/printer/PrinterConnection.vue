<template>
	<div v-if="hasBluetoothAccess" id="printer-settings">

		<button v-if="!config.connection" v-on:click="config.connect" class="connect-button"
				data-testid="connect-printer-button">
			<img width="18" height="18" alt="bluetooth icon to connect" src="@/assets/icons/printer/bluetooth.svg" />
			<span>Connect</span>
		</button>

		<div v-else class="connected-printer" data-testid="connected-printer">


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
	queue: QueueImage[],
}>();

declare global {
	interface Navigator {
		bluetooth?: {
			getAvailability(): Promise<boolean>;
			// Add other Bluetooth API methods here if needed
		};
	}
}

const hasBluetoothAccess = ref(false);

onMounted(() => {

	try {
		// check bluetooth access
		navigator.bluetooth?.getAvailability()?.then(available => {
			if (available) {
				hasBluetoothAccess.value = true;
			}
		});
	} catch (error) {
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


.printing-queue {
	position: relative;
	width: 100%;
	height: calc(100vh - 130px);
	overflow: scroll;
}

.connected-printer {
	position: relative;
}
</style>