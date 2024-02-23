<template>
	<div v-if="isDraggingOver" data-testid="drop-area"  class="drop-overlay">

		<!-- opaque background color in theme color -->
		<div data-testid="color-overlay" class="color-overlay" />

		<img width="60" class="plus-icon" data-testid="plus-icon" title="add new image" src="@/assets/icons/printer/plus.svg" />

	</div>
</template>
	
	
<script setup lang="ts">
import {onMounted, onUnmounted, ref } from 'vue';


// events
const emit = defineEmits<{
	
	/**
	 * emits dropped file
	 * @param {File} dropped file
	 */
	(e: 'dropped', type: File): void;
}>();



const isDraggingOver = ref(false);


onMounted(() => {
	document.addEventListener('dragover', dragOver);
	document.addEventListener('dragenter', dragEnter);
	document.addEventListener('dragleave', dragLeave);
	document.addEventListener('drop', onDrop);
});

onUnmounted(() => {
	document.removeEventListener('dragover', dragOver);
	document.removeEventListener('dragenter', dragEnter);
	document.removeEventListener('dragleave', dragLeave);
	document.removeEventListener('drop', onDrop);
});



let dragCounter = 0; // debounce drag cursor in edge cases

const updateDragState = (isDragging: boolean) => {
	isDraggingOver.value = isDragging;
};


const dragOver = (e: DragEvent) => {
	e.preventDefault();
	e.stopImmediatePropagation();

	updateDragState(true);
};


const dragEnter = (e: DragEvent) => {
	e.preventDefault();
	e.stopPropagation();
	dragCounter++;
	updateDragState(true);
};

const dragLeave = (e: DragEvent) => {
	e.preventDefault();
	e.stopPropagation();
	dragCounter--;
	if (dragCounter === 0) {
		updateDragState(false);
	}
};

const onDrop = (e: DragEvent) => {
	e.preventDefault();
	e.stopPropagation();
	dragCounter = 0;
	updateDragState(false);

	if (e.dataTransfer?.files) {
		const file = e.dataTransfer.files[0];
		if (file && file.type.startsWith('image/')) {
			emit('dropped', file);
		}
	}
};

</script>
	
<style scoped lang="scss">


.drop-overlay {
	z-index: 1000000 !important;
	position: fixed;
	width: 100vw;
	height: 100vh;
	top: 0px;
	left: 0px;
	background: rgba(255, 255, 255, .5);
    -moz-backdrop-filter: blur(4px);
	-webkit-backdrop-filter: blur(4px);

	backdrop-filter: blur(4px);
}

.color-overlay {
	position: absolute;
	top: 0px;
	background-color: var(--dynamic-bg-color);
	left: 0px;
	width: 100%;
	height: 100%;
	opacity: .5;
}


.plus-icon {
	position: absolute;
	top: 50%;
	left: 50%;
	transform: translate(-50%, -50%);
	font-size: 75px;
	z-index: 10
}


</style> 