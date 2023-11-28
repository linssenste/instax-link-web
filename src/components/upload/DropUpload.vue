<template>
	<div v-show="isDraggingOver" class="drop-overlay">

		<div class="gradient-border">

			<i class="fa-solid fa-plus plus-icon" :style="colorStyling"/>

		</div>
	</div>
</template>
	
	
<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue';

const props = defineProps<{
	theme: string
}>()
const colorStyling = computed(() => {
	return `color: var(--${props.theme}-color);`
})
const isDraggingOver = ref(false);

const emit = defineEmits(['dropped']);

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
			console.log(file)
			emit('dropped', file)
			//getFileData(file);
		}
	}
};
</script>
	
<style scoped lang="scss">
.border-hint-dotted {
	position: absolute;


}


.drop-overlay {
	z-index: 1000000 !important;
	position: fixed;
	width: 100vw;
	height: 100vh;
	top: 0px;
	left: 0px;
	background: rgba(255, 255, 255, 1);
}

.gradient-border {
	position: absolute;
	display: flex;
	justify-content: center;
	align-items: center;
	width: auto;
	height: auto;
	top: 25px;
	left: 25px;
	right: 25px;
	bottom: 25px;
	background: white;
	border-radius: .25rem
}

.gradient-border::after {
	position: absolute;
	content: '';


	z-index: -1;
	width: calc(100% + .25rem * 4);
	height: calc(100% + .25rem * 4);
	background: linear-gradient(60deg,
			var(--blue-color),
			var(--pink-color),
			var(--orange-color),
			var(--yellow-color),
			var(--green-color),
			var(--red-color),
			var(--blue-color));

	background-size: 300% 300%;
	background-position: 0 50%;
	border-radius: calc(2 * .25rem);
	animation: moveGradient 2s alternate infinite;
}


@keyframes moveGradient {
	50% {
		background-position: 100% 50%;
	}
}

.plus-icon {
	position: absolute;
	top: 50%; 
	left: 50%; 
	transform: translate(-50%, -50%);
	font-size: 75px;
}
</style> 