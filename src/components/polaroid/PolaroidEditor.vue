<template>
	<div >
	
		<DropUpload v-on:dropped="getFileData($event)" :theme="config.theme"/>
		
		<div class="polaroid-editor">

			<PolaroidFrame :config="config">
				<template v-slot:polaroid-area>

					<CropperArea v-if="image" :config="config" :image="image" />

					<div v-else data-testid="drop-area" v-on:click="uploadImage()" class="drop-area ">

						<input data-testid="input-file" v-on:change="inputChanged($event)" type="file" name=""
							   accept="image/*" id='upload' hidden>

						<div class="d-flex flex-column ma-0 mt-4 align-center">

							<!-- <v-icon color="grey-darken-2" size="40">mdi-image</v-icon> -->
							<span style="text-transform: uppercase; letter-spacing: 1.05px; font-size: 14px"
								  class="text-grey-darken-2 ml-2 mt-2 font-weight-bold">Upload image</span>
					
						</div>
					</div>


				</template>
			</PolaroidFrame>

			<button style="width: 100%; margin-top: 20px">jdjdj</button>
		</div>
	</div>
</template>

<script setup lang="ts">
import PolaroidFrame from './PolaroidFrame.vue';

import { ref, computed, onUnmounted, onMounted } from 'vue'
import ImageCompressor from 'image-compressor.js';
import CropperArea from './CropperArea.vue';
import DropUpload from '../layout/DropUpload.vue';


const props = defineProps<{
	config: {
		width: number,
		height: number, 
		theme: string
	}
}>()





const image = ref<string | null>(null);


function uploadImage(): void {
	console.log("JS")
	document.getElementById('upload')?.click();
}


function inputChanged(e: Event): void {
	e.preventDefault();
	e.stopImmediatePropagation();

	const file = (e.target as any).files[0];

	getFileData(file)

}

function getFileData(file: File): void {

	var reader = new FileReader();
	reader.readAsDataURL(file);
	reader.onload = async function () {
		image.value = reader.result as string;
	};
	reader.onerror = function (error) {
		console.log('Error: ', error);
	};
}


props.config;
</script>


<style scoped>





.polaroid-editor {
	position: absolute;
	left: 50%;
	top: calc(50% + 50px);
	transform: translate(-50%, -50%);
}
</style>