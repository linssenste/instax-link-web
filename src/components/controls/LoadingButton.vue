<template>
	<button type="button" :class="{ busy: loading }" :disabled="disabled || loading" v-on:click="clickEvent">
		<span v-if="loading" class="button-spinner" :class="{ spaced: currentLabel != null }" aria-hidden="true" />
		<span v-else-if="icon" class="button-icon" :class="{ spaced: currentLabel != null }"
			  :style="{ '--button-icon': iconMask }" aria-hidden="true" />

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
}>(), { iconSize: 20, loading: false, disabled: false });

/**
 * The mask source, quoted. A small icon is inlined as a data uri carrying a raw
 * apostrophe, which an unquoted url() cannot hold: the declaration would be thrown
 * away and the mark would come out as a filled square.
 */
const iconMask = computed(() => props.icon == null ? undefined : `url("${props.icon}")`);

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
	/* the icon and the spinner are both drawn in currentColor, so the one colour
	   here covers the label and the mark alike */
	color: #ffffff;
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
.button-icon,
.button-spinner {
	margin-right: 0;
	flex: none;
}

.button-icon.spaced,
.button-spinner.spaced {
	margin-right: 8px;
}

/* a mask rather than an img: the icons ship with a placeholder fill, and this way
   the mark takes the button's own colour */
.button-icon {
	display: block;
	width: v-bind('`${iconSize}px`');
	height: v-bind('`${iconSize}px`');
	background-color: currentColor;
	-webkit-mask: var(--button-icon) center / contain no-repeat;
	mask: var(--button-icon) center / contain no-repeat;
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
