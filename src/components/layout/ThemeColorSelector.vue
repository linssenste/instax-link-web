<template>
    <div class="selector-row">

		<div v-for="color in colors" v-on:click="changeThemeColor(color)"  :class="selectedColor==color? 'color-selected' : ''"
            data-testid="pink-color-selector-item" :style="colorStyling(color)" class="color-item"/>

    </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'

const colors = ['red', 'orange', 'yellow', 'green', 'blue', 'pink'];
const selectedColor=ref((localStorage.getItem('background')||'red'))
const emit=defineEmits(['color-change'])

function colorStyling(name: string) {
	return {
		backgroundColor: `var(--${name}-color)`
	}
}

onMounted(() => {
	changeThemeColor(selectedColor.value); 
})
function changeThemeColor(color: string): void {

	selectedColor.value = color; 
    localStorage.setItem('background', selectedColor.value)
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
    transition: all 50ms linear;
    margin-right: 10px !important;

	border-radius: 50%;
}

.color-item:hover {
    transform: scale(1.3);
    transition: all 50ms linear;

}

.color-selected {
    transform: scale(1.3);
    border-radius: 4px !important;

}
</style>
