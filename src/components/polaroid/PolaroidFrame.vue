<template>
	<div class="editor">
		<div class="inner" :class="`inner-${config.width}`">
			<slot  name="polaroid-area" />

	
		</div>
	

		<div class="polaroid" >
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

		<div class="polaroid-text">
			<slot  name="polaroid-text"/>
			</div>
	</div>
</template>

<script lang="ts" setup>
import { computed, ref } from 'vue';

const loadError = ref(false)
const frameLoaded = ref(false);


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

	background-color: blue;
	z-index: 200!important;
	border-radius: 10px;
	margin-left: 18px;
	margin-right: 9px;
	margin-top: 0px;
	margin-bottom: 68px;
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
	height: 325px;
	background-color: white;
	z-index: 2000000;
}

.inner-600 {
	padding-top: 5px;
	padding-left: 1px;
	aspect-ratio: 600/800;
}

.inner-800 {
	padding-left: 4px;
	padding-top: 5px;
	aspect-ratio: 800/800;
}

.inner-1260 {
	padding-top: 5px;
	padding-left: 2px;
	aspect-ratio: 1260/840;
}

.polaroid-frame {
	height: 440px;
	-webkit-filter: drop-shadow(2px 2px 2px #00000022) drop-shadow(-2px -2px 2px #00000022);
	filter: drop-shadow(2px 2px 2px #00000022) drop-shadow(-2px -2px 2px #00000022);
	will-change: filter;
}



.polaroid-text {
	position: absolute;
	bottom: -60px;
	z-index: 10000;
	left: 50%; transform: translateX(-50%);
}
</style>
  