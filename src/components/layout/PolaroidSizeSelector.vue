<template>
	<div oncontextmenu="return false" class="size-selector">

		<div v-for="filmType in [InstaxFilmType.MINI, InstaxFilmType.SQUARE, InstaxFilmType.LARGE]" :title="polaroidTitle(filmType)" :style="polaroidClass(filmType)"
			 @click="selectedType = filmType" class="polaroid" :data-testid="`polaroid-selector-${filmType}`">
			<div class="inner-polaroid"></div>
		</div>

	</div>
</template>
  
<script setup lang="ts">
import { ref, watch } from 'vue';
import { InstaxFilmType } from '../../types/config.types';

const selectedType = ref<InstaxFilmType>(InstaxFilmType.SQUARE);

const emit = defineEmits<{
	(e: 'type-change', type: InstaxFilmType): void;
}>();

const polaroidTitle = (filmType: InstaxFilmType) => {
	switch (filmType) {
		case InstaxFilmType.MINI: return "Instax Mini (600x800)"
		case InstaxFilmType.SQUARE: return "Instax Square (800x800)"
		case InstaxFilmType.LARGE: return "Instax Large (1240x840)"
		default: break;
	}
}

watch(selectedType, () => {
	emit('type-change', selectedType.value);
});


function polaroidClass(filmType: InstaxFilmType) {
	return {
		backgroundColor: selectedType.value === filmType ? 'var(--dynamic-bg-color)' : 'var(--grey-color)',
		width: `${filmType == InstaxFilmType.MINI ? 18 : (filmType == InstaxFilmType.SQUARE ? 25 : 40)}px`,
		boxShadow: `0px 0px 5px rgba(0, 0, 0, ${filmType === selectedType.value ? .5 : 0})`,
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