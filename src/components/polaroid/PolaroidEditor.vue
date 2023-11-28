<template>
	<div >
	
		<DropUpload v-on:dropped="getFileData($event)" :theme="config.theme"/>
		
		<div class="polaroid-editor">

			<PolaroidFrame :config="config">
				<template v-slot:polaroid-area>

					<CropperArea v-if="image" :config="config" :image="image" />

					<SelectUpload v-else :theme="config.theme" v-on:selected="getFileData($event)"/>
					

				</template>
			</PolaroidFrame>

			<button style="width: 100%; margin-top: 20px">jdjdj</button>
		</div>
	</div>
</template>

<script setup lang="ts">
import PolaroidFrame from './PolaroidFrame.vue';

import { ref } from 'vue'
import CropperArea from './CropperArea.vue';
import DropUpload from '../upload/DropUpload.vue';
import SelectUpload from '../upload/SelectUpload.vue';


const props = defineProps<{
	config: any
}>()



const image = ref<string | null>(null);






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