<template>
	<div oncontextmenu="return false" class="selector-row">

		<div v-for="color in colors" :key="color" v-on:click="changeThemeColor(color)" :class="selectedClass(color)"
			 :data-testid="`${color}-color-item`" :title="`Theme color '${color}''`" :style="colorStyling(color)"
			 class="color-item" />

	</div>
</template> 

<script setup lang="ts">
import { ref, onMounted, watchEffect } from 'vue'

// color update event
const emit = defineEmits<{
	(e: 'color-change', color: string): void;
}>();


const colors = ['black', 'red', 'orange', 'yellow', 'green', 'blue', 'pink']; // yeah, i know... #pride
const selectedColor = ref(localStorage.getItem('theme-color') ?? 'red'); // default color

const colorStyling = (name: string) => ({ backgroundColor: `var(--${name}-color)` });
const selectedClass = (color: string) => (selectedColor.value == color ? 'color-selected' : '');

onMounted(() => {
	// const params = new Proxy(new URLSearchParams(window.location.search), {
	// 	get: (searchParams: any, prop: any) => searchParams.get(prop),
	// });

	// if (params.random === "true") {
	// 	const randomIndex = Math.floor(Math.random() * (colors.length - 1)) + 1;
	// 	selectedColor.value = colors[randomIndex]
	// }

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
</style>
