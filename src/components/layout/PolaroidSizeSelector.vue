<template>
	<div oncontextmenu="return false" class="size-selector">

		<div v-for="polaroidType in [FilmSize.MINI, FilmSize.SQUARE, FilmSize.LARGE]" :title="polaroidTitle(polaroidType)" :style="polaroidClass(polaroidType)"
			 @click="selectedType = polaroidType" class="polaroid" :data-testid="`polaroid-selector-${polaroidType}`">
			<div class="inner-polaroid"></div>
		</div>

	</div>
</template>
  
<script setup lang="ts">
import { ref, watch } from 'vue';
import { FilmSize } from '../../types/config.types';

const selectedType = ref<FilmSize>(FilmSize.SQUARE);

const emit = defineEmits<{
	(e: 'resize', type: FilmSize): void;
}>();

const polaroidTitle = (polaroidType: FilmSize) => {
	switch (polaroidType) {
		case FilmSize.MINI: return "Instax Mini (600x800)"
		case FilmSize.SQUARE: return "Instax Square (800x800)"
		case FilmSize.LARGE: return "Instax Large (1240x840)"
		default: break;
	}
}

watch(selectedType, () => {
	emit('resize', selectedType.value);
});


function polaroidClass(polaroidType: FilmSize) {
	return {
		backgroundColor: selectedType.value === polaroidType ? 'var(--dynamic-bg-color)' : 'var(--grey-color)',
		width: `${polaroidType == FilmSize.MINI ? 18 : (polaroidType == FilmSize.SQUARE ? 25 : 40)}px`,
		boxShadow: `0px 0px 5px rgba(0, 0, 0, ${polaroidType === selectedType.value ? .5 : 0})`,
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