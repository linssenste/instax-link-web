<template>
	<div oncontextmenu="return false" class="size-selector">

		<div v-for="width in [600, 800, 1240]" :title="polaroidTitle(width)" :key="width" :style="polaroidClass(width)"
			 @click="selectedWidth = width" class="polaroid" :data-testid="`polaroid-selector-${width}`">
			<div class="inner-polaroid"></div>
		</div>

	</div>
</template>
  
<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import type {STATE_CONFIG} from '../../types/config.types'; 

const selectedWidth = ref(800);

const emit = defineEmits<{
	(e: 'resize', config: STATE_CONFIG): void;
}>();

const props = defineProps<{
	config: STATE_CONFIG
}>();




const polaroidTitle = (size: number) => {
	switch (size) {
		case 600: return "Instax Mini (600x800)"
		case 800: return "Instax Square (800x800)"
		case 1240: return "Instax Large (1240x840)"
		default: break;
	}
}

watch(selectedWidth, () => {
	emit('resize', { ...props.config, width: selectedWidth.value, height: (selectedWidth.value === 1260 ? 840 : 800) });
});




function polaroidClass(width: number) {
	return {
		backgroundColor: `var(--${selectedWidth.value === width ? props.config.theme : 'grey'}-color)`,
		width: `${width / 30}px`,
		boxShadow: `0px 0px 5px rgba(0, 0, 0, ${width === selectedWidth.value ? .5 : 0})`,
	}
}

</script>

<style scoped>
.polaroid {
	position: relative;
	padding: 3px;
	height: 35px;
	border-radius: 2px;
	cursor: pointer;
	transition: all 150ms;
	z-index: 1;
}

.inner-polaroid {
	background-color: #f5f5f5 !important;
	z-index: 2;
	width: 100%;


	height: 28px;
	background-size: cover;
	background-position: center;
	border-radius: 0;
}

.polaroid:hover {
	transform: scale(1.02);
	box-shadow: 0px 0px 5px rgba(0, 0, 0, .1) 
}


.size-selector {
	position: relative;
	display: flex;
	flex-direction: row;
	gap: 8px;
	width: 130px;
	justify-content: center;
}
</style>