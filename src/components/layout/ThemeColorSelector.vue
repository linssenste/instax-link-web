<template>
	<div oncontextmenu="return false" class="selector-row" role="group" aria-label="Theme color">

		<button v-for="color in colors" :key="color" type="button" v-on:click="selectColorEvent(color)"
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


const colors = ['red', 'orange', 'yellow', 'green', 'blue']; 
// a fresh colour every load rather than a remembered one. Black is the hidden
// black and white mode, so it is never drawn at random
const randomColor = () => colors[Math.floor(Math.random() * colors.length)];

const selectedColor = ref(randomColor());

const colorStyling = (name: string) => ({ backgroundColor: `rgb(var(--${name}-color))` });
const selectedClass = (color: string) => (selectedColor.value == color ? 'color-selected' : '');

// no swatch stands for this one: picking the active colour again falls back to it
const BLACK_AND_WHITE = 'black';

onMounted(() => {
	// emit default color on loaded to make sure everything is setup correctly
	changeThemeColor(selectedColor.value);
})

// clicking the colour that is already active drops the theme into black and white
function selectColorEvent(color: string): void {
	changeThemeColor(selectedColor.value === color ? BLACK_AND_WHITE : color);
}


watchEffect(() => {
	document.documentElement.style.setProperty('--dynamic-bg-color', `var(--${selectedColor.value}-color)`);
});

// emit event when color is changed
function changeThemeColor(color: string): void {
	selectedColor.value = color;
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
/* one continuous strip of segments; the active one widens out of it */
.selector-row {
	display: flex;
	flex-direction: row;
	align-items: flex-end;
}

.color-item {
	width: 40px;
	height: 15px;
	cursor: pointer!important;
	padding: 0;
	margin: 0;
	border: none;
	border-radius: 0;
	opacity: 1;
	display: block;

	transition: width 260ms cubic-bezier(.22, .61, .36, 1);
}

/* only the outer ends of the row are rounded, so the bars read as one strip */
.color-item:first-of-type {
	border-top-left-radius: 2px;
	border-bottom-left-radius: 2px;
}

.color-item:last-of-type {
	border-top-right-radius: 2px;
	border-bottom-right-radius: 2px;
}

.color-selected {
	width: 70px;
}

/* the active segment is out of reach of hover, so clicking the one under the
   cursor settles at its selected width instead of sticking at the hover width */
@media (hover: hover) and (pointer: fine) {
	.color-item:not(.color-selected):hover {
		width: 50px;
	}
}

/* a 10px strip is hard to hit with a thumb, so it thickens where there is no
   mouse to aim with */
@media (pointer: coarse),
(max-width: 600px) {
	.color-item {
		height: 26px;
	}
}

@media (prefers-reduced-motion: reduce) {
	.color-item {
		transition: none;
	}
}

.color-item:focus-visible {
	outline: 2px solid rgb(var(--black-color));
	outline-offset: 2px;
}
</style>
