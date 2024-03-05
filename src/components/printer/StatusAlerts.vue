<template>
	<div v-if="status.polaroidCount != null && status.battery.level != null">

		<!-- alert #1: no polaroids left -->
		<div v-if="status.polaroidCount <= 0" class="error-card" data-testid="polaroid-count-status">
			<img src="@/assets/icons/printer/warning.svg" width="22" />
			<span>Insert new Polaroids</span>
		</div>

		<!-- alert #2: recharge battery -->
		<div v-if="(!status.battery.charging && status.battery.level <= 10)" class="error-card"
			 data-testid="battery-status">
			<img src="@/assets/icons/battery/battery-warning.svg" width="22" />
			<span> Recharge battery </span>
		</div>

	</div>
</template>

<script lang="ts" setup>
import type { PrinterStatus } from '../../interfaces/PrinterStateConfig';

const props = defineProps<{
	status: PrinterStatus;
}>();

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
	background-color: var(--dynamic-bg-color);

	padding: 15px;
	padding-left: 15px;
	margin-top: 10px;
	border-radius: 10px;


}
</style>