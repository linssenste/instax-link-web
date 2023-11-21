<template>
	<div style="position: relative; padding: 20px; display: flex; flex-direction: row; gap: 8px">
	  <div v-for="width in [600, 800, 1260]" :key="width" :style="polaroidClass(width)" @click="selectedWidth = width" class="polaroid">
		<div class="inner-polaroid" :style="selectedPolaroid(width)"></div>
	  </div>
	</div>
  </template>
  
  <script setup lang="ts">
  import { ref, watch } from 'vue';
  
  const selectedWidth = ref(800);
  
  const props = defineProps<{
	color: string;
	isConnected: boolean;
	config: {
	  width: number;
	  height: number;
	};
  }>();
  
  const emit = defineEmits(['resize']);
  
  watch([() => props.isConnected, () => props.config], () => {
	if (props.isConnected) selectedWidth.value = props.config.width;
  });
  
  watch(selectedWidth, () => {
	emit('resize', { width: selectedWidth.value, height: selectedWidth.value === 1260 ? 840 : 800 });
  });
  
  function selectedPolaroid(width: number) {
	return {
	  backgroundImage: width === selectedWidth.value ? `url("/polaroid-placeholder/placeholder-${Math.trunc(Math.random() * 10)}.webp")` : 'none',
	};
  }
  
  function polaroidClass(width: number) {
	return {
	  backgroundColor: `var(--${selectedWidth.value === width ? props.color : 'grey'}-color)`,
	  width: width === 600 ? '20px' : width === 800 ? '30px' : '45px',
	};
  }
  </script>

<style scoped>
.polaroid {
	position: relative;
	padding: 3px;
	height: 38px;
	border-radius: 2px;
	cursor: pointer;
	transition: transform 0.3s;
	z-index: 1;
}

.inner-polaroid {
	background-color: #f5f5f5 !important;
	z-index: 2;
	width: 100%;
	

	height: 30px;
	background-size: cover;
	border-radius: 0;
}

.polaroid:hover {
	transform: scale(1.1);
}



.disabled {
	opacity: .3;
	pointer-events: none;
}
</style>