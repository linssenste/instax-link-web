<template>
	<div>

		<div v-if="!hasBluetoothAccess">NO ACCESS</div>

		<button v-else-if="!config.connection" v-on:click="config.connect" class="connect-button"
				>
			<img width="18" height="18" alt="bluetooth icon to connect" src="@/assets/icons/printer/bluetooth.svg" />
			<span>Connect</span>
		</button>

		<div v-else>
			<div class="connection-box">
				<div
					 style="position: relative; display: flex; flex-direction: row; align-items: center; justify-content: space-between;">

					<!-- Printer type in instax-font -->
					<div class="printer-name">
						<div></div>
						<span >instax</span> <span style="font-size: 20px">{{ printerType }}</span>

					</div>
					<button v-on:click="config.disconnect" title="Disconnect INSTAX Printer" class="disconnect-button"
							>
						<img width="18" alt="bluetooth icon to disconnect" draggable="false"
							 src="@/assets/icons/printer/bluetooth-disconnect.svg" />
						<!-- <span>Disconnect</span> -->
					</button>
				</div>


				<div class="printer-status-info">

					<div v-if="status.polaroidCount != null && status.battery.level != null"
						 class="printer-status-polaroids">

						<img :title="`${remainingPolaroids} Polaroids left`" draggable="false"
							 :src="`/polaroids/stack/icon-${config.type}.webp`" height="30" />
						<span style="letter-spacing: 2px">{{ status.polaroidCount }}/10</span>
					</div>

					<div v-if="status.battery.level != null && status.polaroidCount != null"
						 class="printer-status-battery">
						<img v-if="status.battery.charging" draggable="false" width="25"
							 src="@/assets/icons/battery/battery-charging.svg" />
						<img v-else-if="batteryIcon == 0" draggable="false" width="25" src="@/assets/icons/battery/battery-0.svg" />
						<img v-else-if="batteryIcon == 25" draggable="false" width="25"
							 src="@/assets/icons/battery/battery-25.svg" />
						<img v-else-if="batteryIcon == 50" draggable="false" width="25"
							 src="@/assets/icons/battery/battery-50.svg" />
						<img v-else-if="batteryIcon == 75" draggable="false" width="25"
							 src="@/assets/icons/battery/battery-75.svg" />
						<img v-else-if="batteryIcon == 100" draggable="false" width="25"
							 src="@/assets/icons/battery/battery-100.svg" />

						<span v-if="status.battery.charging" style="color: var(--orange-color); letter-spacing: 1px">POWER</span>
						<span v-else>
							{{ status.battery.level }}%</span>
					</div>

					<div v-else style="text-transform: uppercase; letter-spacing: 1.5px; font-weight: 400px; color: var(--grey-color)">
						Connecting....
					</div>
				</div>

			</div>

		
		<StatusAlerts :status="status" />

			<PrintingStatus :stack="status.polaroidCount" :queue="queue" />
			

		</div>



	</div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';

import PrintingStatus from '../printer/PrintingStatus.vue';
import StatusAlerts from '../printer/StatusAlerts.vue'
import type { PRINTER_STATUS, STATE_CONFIG } from '../../types/config.types';

const props = defineProps<{
	config: STATE_CONFIG;
	status: PRINTER_STATUS,
	queue: any,
	hasBluetoothAccess: boolean
}>();

// display leave dialog if connected to printer
onMounted(() => {
	window.addEventListener("beforeunload", (event) => {
		if (props.config.connection == true && props.queue.length > 0) event.returnValue = true;
	});
})
let remainingPolaroids = ref(10)

props.config;
props.status;
props.hasBluetoothAccess;

const printerType = computed(() => {
	if (!(props.status.battery.level != null && props.status.polaroidCount != null)) return ''
	else return props.status.type
})
const batteryIcon = computed(() => {
	if (props.status.battery.level == null || props.status.battery.level <= 10) return 0;
	else if (props.status.battery.level <= 35) return 25;
	else if (props.status.battery.level <= 60) return 50;
	else if (props.status.battery.level <= 90) return 75;
	else if (props.status.battery.level >= 90) return 100;
})



</script>


<style scoped>

.connection-box {
	position: relative;
	background-color: rgba(255, 255, 255, .75);
	padding: 15px;
	width: 260px;
	border-radius: 10px;
	transition: all 150ms ease-in-out;

}

.connection-box:hover {
	background-color: rgba(255, 255, 255, 1);

}

.printer-name {
	font-size: 21px;
	font-family: 'Keedy Sans';

	display: flex;
	align-items: center;

}

.printer-name span {
	margin-left: 8px;
	color: var(--dynamic-bg-color); 

}

.printer-name div {
	position: relative;
	width: 12px;
	height: 12px;
	border-radius: 50%;
	background-color: green;
	margin-left: 2px;
	margin-right: 5px;
	opacity: 1;
	transform: scale(1);
	animation: pulse 1s infinite ease-in-out
}


@keyframes pulse {
	0% {
		transform: scale(1);
	}

	50% {
		transform: scale(0.8);
	}

	100% {
		transform: scale(1);
	}
}

.printer-status-info {
	font-weight: 400;
	font-size: 16px!important;
	position: relative;
	display: flex;
	flex-direction: row;
	align-items: center;
	justify-content: space-between;
	gap: 30px;
	height: 30px !important;
	margin-top: 10px;
}


.printer-status-polaroids {
	position: relative;
	display: flex;
	flex-direction: row;
	align-items: center;
}

.printer-status-polaroids img {
	filter: drop-shadow(2px 2px 2px #00000022) drop-shadow(-2px -2px 2px #00000022);
	margin-right: 8px;
}

.printer-status-battery {
	position: relative;
	display: flex;
	flex-direction: row;
	align-items: center;
}

.printer-status-battery img {
	margin-right: 8px
}


.disconnect-button {
	height: 35px;
	width: 35px;
	border-radius: 50%;
	
	position: relative;



}

.disconnect-button img {
	position: absolute;
	top: 50%;
	left: 50%;
	transform: translate(-50%, -50%)
}

.connect-button {
	color: #FFFFFF;


	padding-left: 30px;
	padding-right: 30px;
}
</style>