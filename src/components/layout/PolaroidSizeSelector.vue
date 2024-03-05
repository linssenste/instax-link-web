<template>
	<div oncontextmenu="return false" class="size-selector">

		<div v-for="filmType in [InstaxFilmVariant.MINI, InstaxFilmVariant.SQUARE, InstaxFilmVariant.LARGE]" :key="filmType"
			 :title="polaroidTitle(filmType)" :style="polaroidClass(filmType)" @click="selectedType = filmType"
			 class="polaroid" :data-testid="`polaroid-selector-${filmType}`">
			<div class="inner-polaroid"></div>
		</div>

	</div>
</template>
  
<script setup lang="ts">
import { ref, watch } from 'vue';
import { InstaxFilmVariant } from '../../interfaces/PrinterStateConfig';

const selectedType = ref<InstaxFilmVariant>(InstaxFilmVariant.SQUARE);

// events
const emit = defineEmits<{

	/**
	 * emits new selected type (mini, square or large)
	 * @param {InstaxFilmVariant} type new polaroid size type
	 */
	(e: 'type-change', type: InstaxFilmVariant): void;
}>();


// hovering html title
const polaroidTitle = (filmType: InstaxFilmVariant) => {
	switch (filmType) {
		case InstaxFilmVariant.MINI: return "Instax Mini (600x800)"
		case InstaxFilmVariant.SQUARE: return "Instax Square (800x800)"
		case InstaxFilmVariant.LARGE: return "Instax Large (1260x840)"
		default: break;
	}
}

// styling
const polaroidClass = (filmType: InstaxFilmVariant) => {
	return {
		backgroundColor: selectedType.value === filmType ? 'var(--dynamic-bg-color)' : 'var(--grey-color)',
		width: `${filmType == InstaxFilmVariant.MINI ? 18 : (filmType == InstaxFilmVariant.SQUARE ? 25 : 40)}px`,
		boxShadow: `0px 0px 5px rgba(0, 0, 0, ${filmType === selectedType.value ? .25 : 0})`,
	}
}

// emit change event
watch(selectedType, () => {
	emit('type-change', selectedType.value);
}, { immediate: true });

</script>

<style scoped>
.polaroid {
	position: relative;
	padding: 3px;
	height: 35px;
	border-radius: 2px;
	cursor: pointer;
	transition: all 150ms;
}

.inner-polaroid {
	background-color: var(--light-grey-color) !important;
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