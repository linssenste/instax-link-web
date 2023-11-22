<template>
    <div oncontextmenu="return false" class="selector-row">

		<div v-for="color in colors" v-on:click="changeThemeColor(color)"  :class="selectedColor==color? 'color-selected' : ''"
            :data-testid="`${color}-color-item`" :style="colorStyling(color)" class="color-item"/>

    </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'

const emit=defineEmits(['color-change'])

const colors = ['red', 'orange', 'yellow', 'green', 'blue', 'pink']; // #pride


const selectedColor=ref((localStorage.getItem('background')||'red')); 


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
    margin-right: 5px !important;
	border-radius: 3px;
}

.color-item:hover {
    transform: scale(1.1);
    transition: all 50ms linear;

}

.color-selected {
    border-radius: 50% !important;
}
</style>
