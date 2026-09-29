<template>
	<div oncontextmenu="return false" class="selector-row" role="group" aria-label="Theme color">

		<button v-for="color in colors" :key="color" type="button" v-on:click="changeThemeColor(color)"
				:class="selectedClass(color)" :data-testid="`${color}-color-item`" :title="`Theme color '${color}''`"
				:aria-label="`Theme color ${color}`" :aria-pressed="selectedColor === color" :style="colorStyling(color)"
				class="color-item" />

	</div>
</template> 

<script setup lang="ts">
import { ref, onMounted, watchEffect } from 'vue'

// color update event
const emit = defineEmits<{

	/**
	 * emits selected color to be updated on printer if connected
	 * @param {string} color
	 */
	(e: 'color-change', color: string): void;
}>();


const colors = ['black', 'red', 'orange', 'yellow', 'green', 'blue', 'pink']; // yeah, i know... #pride
const selectedColor = ref(localStorage.getItem('theme-color') ?? 'red'); // default color

const colorStyling = (name: string) => ({ backgroundColor: `rgb(var(--${name}-color))` });
const selectedClass = (color: string) => (selectedColor.value == color ? 'color-selected' : '');

onMounted(() => {
	// emit default color on loaded to make sure everything is setup correctly
	changeThemeColor(selectedColor.value);
})


watchEffect(() => {
	document.documentElement.style.setProperty('--dynamic-bg-color', `var(--${selectedColor.value}-color)`);
});

// emit event when color is changed
function changeThemeColor(color: string): void {
	selectedColor.value = color;
	localStorage.setItem('theme-color', color)
	emit('color-change', selectedColor.value)

	// update meta theme color: 
	const themeColorMetaTag = document.querySelector('meta[name="theme-color"]');

	// Check if the meta tag exists
	if (themeColorMetaTag) {
		// Update the content attribute to the new color
		themeColorMetaTag.setAttribute('content', color);
	} else {
		// If the meta tag does not exist, create one and append it to the <head>
		const newMetaTag = document.createElement('meta');
		newMetaTag.setAttribute('name', 'theme-color');
		newMetaTag.setAttribute('content', color);
		document.head.appendChild(newMetaTag);
	}

}

</script>

<style scoped>
.selector-row {

	display: flex;
	flex-direction: row;
	align-items: center;
}

.color-item {
	width: 20px;
	cursor: pointer;
	height: 20px;
	padding: 0;
	border: none;
	opacity: 1;
	display: block;

	-moz-transition: all 100ms linear;
	-webkit-transition: all 100ms linear;
	transition: all 100ms linear;
	margin-right: 5px !important;
	border-radius: 3px;
}

@media (hover: hover) and (pointer: fine) {
	.color-item:hover {
		transform: scale(1.1);

	}
}

.color-selected {
	border-radius: 50% !important;
}

.color-item:focus-visible {
	outline: 2px solid rgb(var(--black-color));
	outline-offset: 2px;
}
</style>
