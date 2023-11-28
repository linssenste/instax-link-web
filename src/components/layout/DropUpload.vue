<template>
	<div v-show="isDraggingOver" class="drop-overlay">

	  <div class="gradient-border">
		<svg class="svg-border" viewBox="0 0 400 200">
		  <defs>
			<linearGradient id="rainbowGradient" x1="0%" y1="0%" x2="100%" y2="0%" >
			  <stop offset="0%" stop-color="var(--red-color)" />
			  <stop offset="16.6%" stop-color="var(--orange-color)" />
			  <stop offset="33.3%" stop-color="var(--yellow-color)" />
			  <stop offset="50%" stop-color="var(--green-color)" />
			  <stop offset="66.6%" stop-color="var(--blue-color)" />
			  <stop offset="83.3%" stop-color="var(--pink-color)" />
			  <stop offset="100%" stop-color="var(--red-color)" />
			</linearGradient>
		  </defs>
		  <rect x="5" y="5" width="calc(100% - 10px)" height="calc(100% - 10px)" fill="none" stroke="url(#rainbowGradient)" stroke-width="2" rx="3" ry="3"/>
		</svg>
	  </div>
	  <i class="fa-solid fa-plus plus-icon" :style="colorStyling"/>
	</div>
  </template>
  


<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue';


const props = defineProps<{
	theme: string
}>() 
const colorStyling = computed(() => {
	return `color:  var(--${props.theme}-color);`
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


.drop-overlay {
	z-index: 1000000 !important;
	position: fixed;
	width: 100vw;
	height: 100vh;
	top: 0px;
	left: 0px;
	background: rgba(255, 255, 255, 0.65);
	backdrop-filter: blur(6px);
	-webkit-backdrop-filter: blur(6px);
}

.svg-border {
  position: absolute;
  width: 100%;
  height: 100%;
  top: 0;
  left: 0;
}





@keyframes slideGradient {
  0%, 100% {
    stop-color: var(--red-color);
  }
  16% {
    stop-color: var(--orange-color);
  }
  33% {
    stop-color: var(--yellow-color);
  }
  50% {
    stop-color: var(--green-color);
  }
  66% {
    stop-color: var(--blue-color);
  }
  89% {
    stop-color: var(--pink-color);
  }
}
#rainbowGradient stop {
  animation: slideGradient 1s linear infinite;
}


.plus-icon {
	position: absolute;
	top: 50%; 
	left: 50%; 
	transform: translate(-50%, -50%);
	font-size: 75px;
}
</style>