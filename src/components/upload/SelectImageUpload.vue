<template>
	<div class="upload-area" title="Upload or drop an image" v-on:click="uploadImage()">

		<!-- opaque background color in theme color -->
		<div class="area-background" :style="backgroundColorStyling" />

		<input data-testid="input-file" v-on:change="inputChanged($event)" type="file" name="" accept="image/*" id='upload'
			   hidden title="Upload image input" placeholder="">

		<img width="50" data-testid="plus-icon" title="Upload or drop an image" class="upload-icon" src="@/assets/icons/printer/plus.svg" />

	</div>
</template>

<script lang="ts" setup>
import { computed } from 'vue';
import type { STATE_CONFIG } from '../../types/config.types';

const props = defineProps<{
	config: STATE_CONFIG
}>();

const emit = defineEmits(['selected']);


function inputChanged(e: Event): void {
	e.preventDefault();
	e.stopImmediatePropagation();

	const file = (e.target as any).files[0];

	emit('selected', file)

}

function uploadImage(): void {
	document.getElementById('upload')?.click();
}


const backgroundColorStyling = computed(() => {
	return `background-color:  var(--${props.config.theme}-color);`
})

</script>


<style scoped>
.upload-area {
	cursor: pointer;
	height: 100%;
	background-color: white;
	width: 100%;
	position: relative;
}


.upload-icon {
	opacity: .5;
	transition: all 150ms ease-in-out;
	position: absolute;
	left: 50%;
	top: 50%;
	transform: translate(-50%, -50%);
	padding-top: 15px;
	text-align: center;
}

.upload-area:hover .upload-icon {
	opacity: 1;

	width: 55px;
}


.area-background {
	width: 100%;
	height: 100%;
	position: absolute;
	opacity: .5
}
</style>