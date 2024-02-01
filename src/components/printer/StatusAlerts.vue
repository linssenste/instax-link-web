<template>
	<div v-if="status.polaroids.stack != null && status.battery.level != null"  style="position: relative">
		
		<!-- alert #1: no polaroids left -->
		<div v-if="status.polaroids.stack <= 0" class="error-card"
			 :style="`background-color: var(--${config.theme}-color); color: #FFFFFF`">
			<img src="@/assets/icons/printer/warning.svg" width="22" />
			<span>Insert new Polaroids</span>
		</div>

		<!-- alert #2: recharge battery -->
		<div v-if="(!status.battery.charging && status.battery.level <= 10)" class="error-card"
			 :style="`background-color: var(--${config.theme}-color); color: #FFFFFF`">
			<img src="@/assets/icons/battery/battery-warning.svg" width="22" />
			<span> Recharge battery </span>
		</div>

	</div>
</template>

<script lang="ts" setup>
import type { PRINTER_STATUS, STATE_CONFIG } from '../../types/config.types';



const props = defineProps<{
	config: STATE_CONFIG;
	status: PRINTER_STATUS;
}>();

props.config;
props.status;
</script>

<style scoped>
.error-card {
	font-size: 16px;
	color: white;
	font-weight: 400;
	letter-spacing: .75px;
	display: flex;
	flex-direction: row;
	align-items: center;
	justify-content: start;
	gap: 10px;

	padding: 15px;
	padding-left: 15px;
	margin-top: 10px;
	border-radius: 10px;


}
</style>