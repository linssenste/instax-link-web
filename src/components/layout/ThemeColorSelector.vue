<template>
    <div oncontextmenu="return false" class="selector-row">

		<div v-for="color in colors" v-on:click="changeThemeColor(color)"  :class="selectedClass(color)"
            :data-testid="`${color}-color-item`" :aria-label="`theme color selection button for ${color}`" :title="`theme color ${color}`" :style="colorStyling(color)" class="color-item"/>

    </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'

// events
const emit = defineEmits<{
  (e: 'color-change', color: string): void;
}>();


const colors = ['red', 'orange', 'yellow', 'green', 'blue', 'pink']; // yeah, i know... #pride
const selectedColor=ref(localStorage.getItem('theme-color') ?? 'red'); // default color

const colorStyling = (name: string) => ({ backgroundColor: `var(--${name}-color)` });
const selectedClass = (color: string) => (selectedColor.value==color ? 'color-selected' : '');

onMounted(() => {
	// emit default color on loaded to make sure everything is setup correctly
	changeThemeColor(selectedColor.value); 
})

// emit event when color is changed
function changeThemeColor(color: string): void {
	selectedColor.value = color; 
	localStorage.setItem('theme-color', color) // make styling persistent
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
    transition: all 100ms linear;
	-moz-transition: all 100ms linear;
	-webkit-transition: all 100ms linear;
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
