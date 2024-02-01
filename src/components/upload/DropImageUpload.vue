<template>
	<div v-if="isDraggingOver" data-testid="drop-area"  class="drop-overlay" :class="colorStyling">

		<!-- opaque background color in theme color -->
		<div data-testid="color-overlay" class="color-overlay" :style="colorStyling" />

		<img width="60" class="plus-icon" data-testid="plus-icon" title="add new image" src="@/assets/icons/printer/plus.svg" />

	</div>
</template>
	
	
<script setup lang="ts">
import {watch,  computed, onMounted, onUnmounted, ref } from 'vue';

const props = defineProps<{
	theme: string
}>();

const emit = defineEmits(['dropped']);


const colorStyling = computed(() => {
	return `background-color: var(--${props.theme}-color);`
})
const isDraggingOver = ref(false);

watch(isDraggingOver, () => {
	console.log("CHAN", isDraggingOver.value)
})
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


const updateDragState = (isDragging: boolean) => {

	isDraggingOver.value = isDragging;
};

const dragOver = (e: DragEvent) => {
	e.preventDefault();
	e.stopImmediatePropagation();

	updateDragState(true);
};
let dragCounter = 0;

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