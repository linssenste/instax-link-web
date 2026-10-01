<template>
	<div class="connection-box">
		<div class="printer-meta-area">

			<!-- Printer type in instax-font -->
			<div class="printer-name" data-testid="printer-name">
				<div />
				<span>instax</span> <span class="printer-name-type">{{ printerType
				}}</span>

			</div>

			<!-- disconnect icon button -->
			<button data-testid="disconnect-printer-button" v-on:click="config.disconnect" title="Disconnect INSTAX Printer"
					class="disconnect-button">
				<span class="disconnect-icon" aria-hidden="true" />

			</button>
		</div>


		<div class="printer-status-info">

			<!-- count polaroids left -->
			<div v-if="config.status != null && config.status.polaroidCount != null && config.status.battery.level != null"
				 class="printer-status-polaroids" data-testid="printer-polaroid-count">

				<img :title="`${config.status?.polaroidCount ?? 0} Polaroids left`" draggable="false"
					 :src="`/polaroids/stack/icon-${config.type}.webp`" height="30" alt="" />
				<span style="letter-spacing: 2px">{{ config.status.polaroidCount }}/10</span>
			</div>

			<!-- battery status -->
			<div v-if="config.status != null && config.status.battery.level != null && config.status.polaroidCount != null"
				 class="printer-status-battery" data-testid="printer-battery-level">

				<img v-if="config.status.battery.charging" draggable="false" width="25"
					 src="@/assets/icons/battery/battery-charging.svg" alt="" />
				<img v-else-if="batteryIcon == 0" draggable="false" width="25" src="@/assets/icons/battery/battery-0.svg" alt="" />
				<img v-else-if="batteryIcon == 25" draggable="false" width="25"
					 src="@/assets/icons/battery/battery-25.svg" alt="" />
				<img v-else-if="batteryIcon == 50" draggable="false" width="25"
					 src="@/assets/icons/battery/battery-50.svg" alt="" />
				<img v-else-if="batteryIcon == 75" draggable="false" width="25"
					 src="@/assets/icons/battery/battery-75.svg" alt="" />
				<img v-else-if="batteryIcon == 100" draggable="false" width="25"
					 src="@/assets/icons/battery/battery-100.svg" alt="" />

				<span v-if="config.status.battery.charging" data-testid="printer-battery-charging-text"
					  class="printer-charging-text">POWER</span>
				<span v-else>
					{{ config.status.battery.level }}%</span>
			</div>

			<!-- connecting text while meta data of printer is retrieved -->
			<div v-else class="connecting-printer-text" data-testid="printer-connecting-text">
				Connecting....
			</div>
		</div>

	</div>
</template>


<script lang="ts" setup>
import { computed } from 'vue';
import type { PrinterStateConfig } from '../../interfaces/PrinterStateConfig';


const props = defineProps<{
	config: PrinterStateConfig
}>();


const printerType = computed(() => {
	if (props.config.status == null || props.config.status?.battery.level == null || props.config.status?.polaroidCount == null) return ''
	else return props.config.status?.type
})

const batteryIcon = computed(() => {
	const { level } = props.config.status?.battery || {}; // Destructure to simplify property access

	if (level == null) return 0;
	if (level <= 10) return 0;
	if (level <= 35) return 25;
	if (level <= 60) return 50;
	if (level <= 90) return 75;

	return 100;
});


</script>


<style scoped>
.connection-box {
	position: relative;
	background-color: rgba(255, 255, 255, .75);
	padding: 15px;
	width: 300px;
	border-radius: 10px;
	transition: all 150ms ease-in-out;

}

.connection-box:hover {
	background-color: rgba(255, 255, 255, 1);

}

.printer-meta-area {
	position: relative;
	display: flex;
	flex-direction: row;
	align-items: center;
	justify-content: space-between;
}

.printer-name {
	font-size: 21px;
	font-family: 'Keedy Sans';

	display: flex;
	align-items: center;

}

.printer-name span {
	margin-left: 8px;
	color: rgb(var(--dynamic-bg-color));

}

.printer-name-type {
	font-size: 20px;
	text-transform: uppercase;
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
	font-size: 16px !important;
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

.printer-charging-text {
	color: rgb(var(--orange-color));
	letter-spacing: 1px
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

/* a mask rather than an img: the icon ships with a grey placeholder fill, which
   is what left it looking washed out on the coloured card */
.disconnect-icon {
	position: absolute;
	top: 50%;
	left: 50%;
	width: 18px;
	height: 18px;
	transform: translate(-50%, -50%);
	background-color: #ffffff;
	-webkit-mask: url('@/assets/icons/printer/bluetooth-disconnect.svg') center / contain no-repeat;
	mask: url('@/assets/icons/printer/bluetooth-disconnect.svg') center / contain no-repeat;
}


.connecting-printer-text {
	text-transform: uppercase;
	letter-spacing: 1.5px;
	font-weight: 400px;
	color: rgb(var(--grey-color))
}
</style>