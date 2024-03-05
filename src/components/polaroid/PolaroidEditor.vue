<template>
	<div>

		<DropImageUpload v-on:dropped="getFileData($event)" />


		<div class="polaroid-editor"
			 :style="`width: ${config.type == InstaxFilmVariant.MINI ? 270 : (config.type == InstaxFilmVariant.SQUARE ? 350 : 500)}px`">


			<PolaroidFrame :type="config.type" style="z-index: 5" :key="config.type">
				<template v-slot:polaroid-area>

					<CropperArea v-if="image" class="cropper-area" :key="image" ref="cropperAreaRef" :config="config"
								 :src="image" :loading="loading" v-on:remove-image="removeImageEvent"
								 :settings="imageSettings" v-on:save="savePolaroidCanvas" />

					<SelectImageUpload v-else v-on:selected="getFileData($event)" />
					<div v-if="loading" class="loading-overlay">
						<div
							 style="position: absolute; bottom: 30px; left: 50%; transform: translateX(-50%); color: black; opacity: .35; letter-spacing: 1px;">
							LOADING ...</div>
					</div>

				</template>

				<template v-slot:polaroid-text>
					<div v-if="!image" class="polaroid-caption">
						<span>Choose an image!</span>
					</div>

					<button v-else-if="!loading" class="expand-button" v-on:click="expandContract"
							:title="`${settingsExpansion ? 'Hide' : 'Show'} image settings`"
							:style="settingsExpansion ? 'transform: rotate(-180deg)' : 'transform: rotate(0deg)'">
						<img width="20" height="20" :title="`${settingsExpansion ? 'Hide' : 'Show'} image settings`"
							 src="@/assets/icons/controls/chevron-down.svg" />
					</button>

				</template>
			</PolaroidFrame>

			<div id="expand-container">
				<div id="expand-contract" :style="expansion" class="collapsed">
					<ImageSettings :queueLength="queueLength" :config="config" :savePolaroid="saveEditorPolaroid"
								   v-on:change="imageSettings = $event" v-on:scale="fitImageEvent"
								   v-on:remove-image="image = null" />

				</div>

			</div>


		</div>
	</div>
</template>

<script setup lang="ts">

import { computed, ref, watch, Ref } from 'vue'
import PolaroidFrame from './PolaroidFrame.vue';
import CropperArea from './CropperArea.vue';
import ImageSettings from './ImageSettings.vue';

import DropImageUpload from '../files/DropImageUpload.vue';
import SelectImageUpload from '../files/SelectImageUpload.vue';
import { InstaxFilmVariant, type PrinterStateConfig } from '../../interfaces/PrinterStateConfig';

const emit = defineEmits(['image'])

const props = defineProps<{
	config: PrinterStateConfig,
	queueLength: number;
}>()



const cropperAreaRef: Ref<typeof CropperArea | null> = ref(null);
props.config;


const loading = ref(false)
const imageSettings = ref({
	rotation: 0,
	text: '',
	color: '#FFFFFF'
})

const expansion = computed(() => {
	return `margin-top: ${(!settingsExpansion.value || !image.value) ? (-120 - 51) : (props.config.connection ? -55 : 10)}px; pointer-events: ${settingsExpansion.value ? 'inherit' : 'none'}`
})

const settingsExpansion = ref(false)

const image = ref<string | null>(null);
watch(image, (newVal, prevVal) => {
	const el = document.getElementById("expand-contract");

	if (el && ((newVal == null && prevVal != null) || (prevVal == null && newVal != null))) {
		expandContract();

		setTimeout(() => {
			imageSettings.value.rotation = 0;
		}, 750);

	}
});


function removeImageEvent() {
	image.value = null;
	setTimeout(() => {
		imageSettings.value.text = ""
	}, 500);
}

async function saveEditorPolaroid(download = false): Promise<void> {


	loading.value = true;



	expandContract();
	await new Promise((r) => setTimeout(r, 525)) // await animation 


	const imageUrl = await cropperAreaRef.value?.saveCanvasImage(!download);
	emit("image", { src: imageUrl, download: download })

	loading.value = false


}

function expandContract() {
	if (!image.value) settingsExpansion.value = false;
	else settingsExpansion.value = !settingsExpansion.value
}


function fitImageEvent(type: string): void {
	if (cropperAreaRef.value) cropperAreaRef.value.fit((type == 'horizontal'));

}
function savePolaroidCanvas(imageURL: string): void {
	emit('image', imageURL)
}
function getFileData(file: File | null): void {
	if (!file) return;

	const reader = new FileReader();
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
.loading-overlay {
	position: absolute;
	width: 100%;
	height: 100%;
	top: 0;
	left: 0;

	background: rgba(255, 255, 255, .75);
	-webkit-backdrop-filter: blur(8px);
	-moz-backdrop-filter: blur(8px);
	backdrop-filter: blur(8px);

}

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
	width: 100%;
	padding: 5px;
}

#expand-contract {
	width: 100%;
	transition: all 450ms ease-in-out;
}

#expand-contract.expanded {
	margin-top: 10px;
}


.cropper-area {
	transition: all 250ms ease-in-out;
}

.expand-button {
	background-color: transparent;
	outline: none;
	border: none;

	color: #000000 !important;
	opacity: .3;
	padding: 5px;
	margin-top: 0px;
	transition: all 250ms;
	cursor: pointer;
}

.expand-button:hover {
	opacity: .75;
}
</style>