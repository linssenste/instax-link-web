<template>
	<div>

		<DropUpload v-on:dropped="getFileData($event)" :theme="config.theme" />

		<div class="polaroid-editor">

			<PolaroidFrame :config="config" style="z-index: 5">
				<template v-slot:polaroid-area>


					<CropperArea v-if="image" :key="config.width || image" ref="cropperAreaRef" :config="config"
								 :image="image" :settings="imageSettings" v-on:save="savePolaroidCanvas" />

					<SelectUpload v-else :config="config" v-on:selected="getFileData($event)" />

				</template>

				<template v-slot:polaroid-text>
					<button class="expand-button" v-if="image"
							:title="`${settingsExpansion ? 'Hide' : 'Show'} image settings`" v-on:click="expandContract"
							:style="settingsExpansion ? 'transform: rotate(-180deg)' : 'transform: rotate(0deg)'"><i
						   class="fa-solid fa-chevron-down" />
						</button>
				</template>
			</PolaroidFrame>

			<div id="expand-container">
				<div id="expand-contract" class="collapsed">
					<ImageSettings :config="config" :save="saveImage" v-on:change="imageSettings = $event"
								   v-on:scale="fitImageEvent" v-on:remove-image="image = null" />

				</div>
			</div>


		</div>
	</div>
</template>

<script setup lang="ts">

import { ref, watch } from 'vue'
import PolaroidFrame from './PolaroidFrame.vue';

import CropperArea from './CropperArea.vue';
import SelectUpload from '../upload/SelectUpload.vue';
import ImageSettings from './ImageSettings.vue';
import DropUpload from '../upload/DropUpload.vue';

const emit = defineEmits(['image'])

const props = defineProps<{
	config: {
		width: number,
		height: number,
		theme: string,
		connection: boolean
	},
}>()

const cropperAreaRef: any = ref(null);


props.config;



const imageSettings = ref({
	rotation: 0,
	color: '#FFFFFF'
})

const settingsExpansion = ref(false)

const image = ref<string | null>(null);
watch(image, (newVal, prevVal) => {
	const el = document.getElementById("expand-contract");

	if (el && ((newVal == null && prevVal != null) || (prevVal == null && newVal != null))) {
		expandContract();

		setTimeout(() => {
			imageSettings.value.color = '#FFFFFF'
			imageSettings.value.rotation = 0;
		}, 750);

	}
});

async function saveImage(): Promise<void> {

	const imageUrl = await cropperAreaRef.value?.saveCanvasImage();
	emit("image", imageUrl)

}

function expandContract() {
	const el = document.getElementById("expand-contract");

	if (el) {
		el.classList.toggle('expanded');
		el.classList.toggle('collapsed');
		settingsExpansion.value = !settingsExpansion.value
	}
}





function fitImageEvent(type: string): void {
	if (cropperAreaRef.value) {
		if (type == 'horizontal') cropperAreaRef.value.fitVertically();
		else cropperAreaRef.value.fitHorizontally();
	}
}
function savePolaroidCanvas(imageURL: string): void {
	emit('image', imageURL)
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
	top: calc(50% + 15px);
	transform: translate(-50%, -50%);
	display: flex;
	flex-direction: column;
	align-items: center;
}



#expand-container {
	overflow: hidden;
	position: relative;
	width: calc(100% - 10px);
	padding: 5px;
}

#expand-contract {
	margin-top: -110px;
	transition: all 550ms;
}

#expand-contract.expanded {
	margin-top: 10px;
}

.expand-button {
	background-color: transparent;
	outline: none;
	border: none;

	color: #000000 !important;
	opacity: .3;
	padding: 5px;
	font-size: 18px;
	transition: all 100ms;
	cursor: pointer;
}



.expand-button:hover {
	opacity: .75;
}
</style>