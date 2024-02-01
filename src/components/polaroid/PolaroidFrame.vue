<template>
	<div class="editor" >
		<div class="inner" id="polaroid-frame" :class="`inner-${config.width}`">
			<slot  name="polaroid-area" />

		</div>
	

		<div class="polaroid"  >
			<img
				v-show="loadError == false"
				v-on:load="frameLoaded = true"
				v-on:error="loadError = true"
				:src="polaroidImageSource"
				alt="polaroid frame"
				draggable="false"
				preload
				:width="config.width == 800 ? 368 : (config.width == 600 ? 282 : 528)"
				height="440"
				
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
		return '/polaroids/mini.webp';
	} else if (props.config.width === 800) {
		return '/polaroids/square.webp';
	} else {
		return '/polaroids/large.webp';
	}
});





</script>


<style scoped>
.editor {

	position: relative;

	z-index: 200!important;
	border-radius: 10px;
	margin-left: 18px;
	margin-right: 18px;
	margin-top: 0px;
	margin-bottom: 68px;
}

.polaroid {
	position: absolute;
	top: -30px;
	left: -18px;
	-webkit-user-drag: none;


	-moz-user-select: none;
	-webkit-user-select: none;
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

.inner-1240 {
	padding-top: 5px;
	padding-left: 2px;
	aspect-ratio: 1240/840;
}


.polaroid-frame {
	height: 440px;
	-webkit-filter: drop-shadow(2px 2px 2px #00000022) drop-shadow(-2px -2px 2px #00000022);
	filter: drop-shadow(2px 2px 2px #00000022) drop-shadow(-2px -2px 2px #00000022);
	will-change: filter;
}



.polaroid-text {
	position: absolute;
	top: calc(100% + 22px);
	z-index: 10000;
	width: 100%;display: flex;
	flex-direction: row;
	align-items: center;
	text-align: center;
	justify-content: center;
}
</style>
  