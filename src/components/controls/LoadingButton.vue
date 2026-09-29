<template>
	<button type="button" :class="{ busy: loading }" :disabled="disabled || loading" v-on:click="clickEvent">
		<span v-if="loading" class="button-spinner" :class="{ spaced: currentLabel != null }" aria-hidden="true" />
		<img v-else-if="icon" :src="icon" :width="iconSize" :height="iconSize" alt="" draggable="false"
			 :class="{ spaced: currentLabel != null }" />

		<span v-if="currentLabel">{{ currentLabel }}</span>
	</button>
</template>

<script setup lang="ts">
import { computed } from 'vue';

const emit = defineEmits<{ (e: 'click'): void }>();

const props = withDefaults(defineProps<{
	label?: string;
	/** shown in place of `label` while loading */
	loadingLabel?: string;
	icon?: string;
	iconSize?: number;
	loading?: boolean;
	disabled?: boolean;
}>(), { iconSize: 14, loading: false, disabled: false });

const currentLabel = computed(() => {
	if (props.loading && props.loadingLabel != null) return props.loadingLabel;
	return props.label;
});

function clickEvent(): void {
	if (props.disabled || props.loading) return;
	emit('click');
}
</script>

<style scoped>
button {
	position: relative;
}

/* unavailable is unavailable, whatever the button normally looks like */
button:disabled {
	background-color: rgb(var(--grey-color));
	opacity: .5;
	box-shadow: none;
	cursor: not-allowed;
}

/* mid-render rather than simply unavailable */
button:disabled.busy {
	cursor: progress;
}

/* only the icon or the spinner sits next to a label, so the gap belongs on them
   rather than on the global `button img` rule */
img,
.button-spinner {
	margin-right: 0;
	flex: none;
}

img.spaced,
.button-spinner.spaced {
	margin-right: 8px;
}

/* rotation only, so the browser keeps it on the compositor and it carries on
   spinning while the main thread is busy */
.button-spinner {
	width: v-bind('`${iconSize}px`');
	height: v-bind('`${iconSize}px`');
	box-sizing: border-box;
	border: 2px solid currentColor;
	border-top-color: transparent;
	border-radius: 50%;
	opacity: .9;
	will-change: transform;
	animation: button-spin 700ms linear infinite;
}

@keyframes button-spin {
	to {
		transform: rotate(360deg);
	}
}

@media (prefers-reduced-motion: reduce) {
	.button-spinner {
		animation: none;
	}
}
</style>
