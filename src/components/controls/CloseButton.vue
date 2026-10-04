<template>
	<button type="button" class="close" :class="tone" :style="{ '--close-size': `${size}px` }"
			:aria-label="label" :title="title ?? label" :data-testid="testid" v-on:click="$emit('click')">

		<!-- a mask rather than an img, so the mark takes a colour from the theme and
			 stays out of the accessible name -->
		<span class="mark" aria-hidden="true" />
	</button>
</template>

<script setup lang="ts">
withDefaults(defineProps<{
	label: string;
	title?: string;
	testid?: string;
	/** how it sits: on a panel in the theme colour, or over a photo in plain grey */
	tone?: 'theme' | 'plain';
	size?: number;
}>(), { tone: 'theme', size: 32 });

defineEmits<{ (e: 'click'): void }>();
</script>

<style scoped>
.close {
	width: var(--close-size);
	height: var(--close-size);
	padding: 0;
	flex: none;
	border: none;
	border-radius: 50%;
	opacity: 1;
	box-shadow: none;
	cursor: pointer;
	display: block;
	transition: background-color 150ms linear;
}

.close.theme {
	background-color: rgba(var(--dynamic-bg-color), .12);
}

.close.plain {
	background-color: #e0e0e0cc;
}

.mark {
	display: block;
	width: calc(var(--close-size) * .6);
	height: calc(var(--close-size) * .6);
	margin: 0 auto;
	opacity: .75;
	-webkit-mask: url('../../assets/icons/controls/close.svg') center / contain no-repeat;
	mask: url('../../assets/icons/controls/close.svg') center / contain no-repeat;
	transition: opacity 150ms linear;
}

.close.theme .mark {
	background-color: rgb(var(--dynamic-bg-color));
	opacity: 1;
}

.close.plain .mark {
	background-color: #000000;
}

.close:focus-visible {
	outline: 2px solid rgb(var(--dynamic-bg-color));
	outline-offset: 2px;
}

@media (hover: hover) and (pointer: fine) {
	.close.theme:hover {
		background-color: rgba(var(--dynamic-bg-color), .2);
	}

	.close.plain:hover {
		background-color: #e0e0e0;
	}

	.close:hover .mark {
		opacity: 1;
	}
}

@media (prefers-reduced-motion: reduce) {

	.close,
	.mark {
		transition: none;
	}
}
</style>
