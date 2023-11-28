<template>
	<div class="editor">
		<div class="inner" :class="`inner-${config.width}`">
			<slot name="polaroid-area" />
		</div>

		<div class="polaroid">
			<img
				v-show="loadError == false"
				v-on:load="frameLoaded = true"
				v-on:error="loadError = true"
				:src="polaroidImageSource"
				alt="polaroid frame"
				draggable="false"
				preload
				class="polaroid-frame"
			/>
		</div>
	</div>
</template>

<script lang="ts" setup>
import { computed, ref } from 'vue';

const loadError = ref(false)
const frameLoaded = ref(false);

const backgroundColor=ref('#FFFFFF')

const props = defineProps<{
	config: {
		width: number;
		height: number;
	};
}>();

const polaroidImageSource = computed(() => {
	if (props.config.width === 600) {
		return '/polaroids/mini.png';
	} else if (props.config.width === 800) {
		return '/polaroids/square.webp';
	} else {
		return '/polaroids/large.png';
	}
});





</script>


<style scoped>
.editor {

	position: relative;

	z-index: 200!important;
	border-radius: 10px;
	margin: 18px;
	margin-top: 0px;
	margin-bottom: 75px;
}

.polaroid {
	position: absolute;
	top: -30px;
	left: -18px;
	-webkit-user-drag: none;
	user-select: none;
	pointer-events: none;
}

.inner {
	height: 300px;
	background-color: white;
	z-index: 2000000;
}

.inner-600 {
	aspect-ratio: 600/800;
}

.inner-800 {
	aspect-ratio: 800/800;
}

.inner-1260 {
	aspect-ratio: 1260/840;
}

.polaroid-frame {
	height: 400px;
	-webkit-filter: drop-shadow(2px 2px 2px #00000022) drop-shadow(-2px -2px 2px #00000022);
	filter: drop-shadow(2px 2px 2px #00000022) drop-shadow(-2px -2px 2px #00000022);
}
</style>
  