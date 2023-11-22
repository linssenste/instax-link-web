<template>
	<div oncontextmenu="return false" style="position: relative; padding: 20px; display: flex; flex-direction: row; gap: 8px">
	  <div v-for="width in [600, 800, 1260]" :key="width" :style="polaroidClass(width)" @click="selectedWidth = width" class="polaroid">
		<div class="inner-polaroid" :style="width === selectedWidth ? selectedImage : ''"></div>
	  </div>
	</div>
  </template>
  
  <script setup lang="ts">
  import { computed, ref, watch } from 'vue';
  
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


  

  const selectedImage = computed(() => {
	selectedWidth.value;

	return {
	  backgroundImage: `url("/polaroid-placeholder/placeholder-${Math.trunc(Math.random() * 85)}.webp")`
	};

  })

  
  function polaroidClass(width: number) {
	return {
		opacity: props.isConnected && selectedWidth.value != width ? '.25' : '',
	  backgroundColor: `var(--${selectedWidth.value === width ? props.color : 'light-grey'}-color)`,
	  width: width === 600 ? '20px' : width === 800 ? '30px' : '45px',
	  boxShadow: `0px 0px 5px rgba(0, 0, 0, ${width === selectedWidth.value ? '.5' : '0'})`, 
	  pointerEvents:  props.isConnected  ? 'none' : 'all',

	} as any;
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
	

	height: 32px;
	background-size: cover;
	background-position: center;
	border-radius: 0;
}

.polaroid:hover {
	transform: scale(1.1);
}

</style>