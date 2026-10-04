<template>
	<div v-if="status.polaroidCount != null && status.battery.level != null">

		<!-- The printer getting a pack ready, which it does for a few seconds after
			 one goes in. Not an error card: nothing is wrong, it is simply not able
			 to take an image yet, and a failure dialog here was alarming for
			 something that clears itself. -->
		<div v-if="preparing" class="notice-card" data-testid="preparing-status">
			<span class="spinner" aria-hidden="true" />
			<span>Preparing film pack</span>
		</div>

		<!-- alert #1: no polaroids left -->
		<div v-if="status.polaroidCount <= 0" class="error-card" data-testid="polaroid-count-status">
			<img src="@/assets/icons/printer/warning.svg" width="22" alt="" />
			<span>Insert new Polaroids</span>
		</div>

		<!-- alert #2: recharge battery -->
		<div v-if="(!status.battery.charging && status.battery.level <= 10)" class="error-card"
			 data-testid="battery-status">
			<img src="@/assets/icons/battery/battery-warning.svg" width="22" alt="" />
			<span> Recharge battery </span>
		</div>

	</div>
</template>

<script lang="ts" setup>
import type { PrinterStatus } from '../../interfaces/PrinterStateConfig';

withDefaults(defineProps<{
	status: PrinterStatus;
	/** the printer is setting a pack up and cannot take an image yet */
	preparing?: boolean;
}>(), { preparing: false });

</script>

<style scoped>
/* the same shape as an error card, in a colour that is not alarming */
.notice-card {
	font-size: 16px;
	color: white;
	font-weight: 400;
	letter-spacing: .75px;
	display: flex;
	flex-direction: row;
	align-items: center;
	justify-content: start;
	gap: 10px;
	background-color: rgb(var(--blue-color));
	padding: 15px;
	margin-top: 10px;
	border-radius: 10px;
}

.spinner {
	flex: none;
	width: 16px;
	height: 16px;
	border: 2px solid rgba(255, 255, 255, .35);
	border-top-color: #ffffff;
	border-radius: 50%;
	animation: notice-spin 800ms linear infinite;
}

@keyframes notice-spin {
	to {
		transform: rotate(360deg);
	}
}

@media (prefers-reduced-motion: reduce) {
	.spinner {
		animation-duration: 2400ms;
	}
}

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
	background-color: rgb(var(--dynamic-bg-color));

	padding: 15px;
	padding-left: 15px;
	margin-top: 10px;
	border-radius: 10px;


}
</style>