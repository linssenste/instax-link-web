<template>
	<div oncontextmenu="return false" style="position: relative;  display: flex; flex-direction: row; gap: 8px">

		<div v-for="width in [600, 800, 1260]" :title="polaroidTitle(width)" :key="width" :style="polaroidClass(width)" @click="selectedWidth = width"
			 class="polaroid">
			<div class="inner-polaroid" :style="width === selectedWidth ? selectedImage : ''"></div>
		</div>

	</div>
</template>
  
<script setup lang="ts">
import { computed, ref, watch } from 'vue';

const selectedWidth = ref(800);

const props = defineProps<{

	config: {
		width: number;
		height: number;
		theme: string; 
		connection: boolean
	};
}>();

const emit = defineEmits<{
  (e: 'resize', config: any): void;
}>();

watch(() => props.config, () => {
	if (props.config.connection) selectedWidth.value = props.config.width;
});

const polaroidTitle = (size: number) => {
	switch (size) {
		case 600: return "Instax Mini (600x800)"
		case 800: return "Instax Square (800x800)"
		case 1260: return "Instax Large (1260x840)"
		default: break;
	}
}

watch(selectedWidth, () => {
	emit('resize', { ...props.config, width: selectedWidth.value, height: selectedWidth.value === 1260 ? 840 : 800 });
});




const selectedImage = computed(() => {
	return {
		backgroundImage: `url("/polaroid-placeholder/placeholder-${Math.trunc(Math.random() * 85)}.webp")`
	};
})

function polaroidClass(width: number) {
    return {
        opacity: props.config.connection && selectedWidth.value != width ? '0.25' : undefined,
        backgroundColor: `var(--${selectedWidth.value === width ? props.config.theme : 'light-grey'}-color)`,
        width: `${width/30}px`, 
        boxShadow: `0px 0px 5px rgba(0, 0, 0, ${width === selectedWidth.value ? .5 : 0})`,
        pointerEvents: props.config.connection ? 'none' : 'auto',
    } as any
}

</script>

<style scoped>
.polaroid {
	position: relative;
	padding: 3px;
	height: 35px;
	border-radius: 2px;
	cursor: pointer;
	transition: transform 0.3s;
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
	transform: scale(1.05);
}
</style>