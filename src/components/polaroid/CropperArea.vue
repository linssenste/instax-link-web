<template>

<VuePictureCropper v-if="image != null" :key="config" ref="cropperObj" :boxStyle="cropperBox" class="cropper"
								   :presetMode="cropperPreset" :img="image" :options="cropperOptions" />
</template>

<script lang="ts" setup>
import VuePictureCropper, { cropper } from 'vue-picture-cropper'

import { ref, computed } from 'vue';


const props = defineProps<{
	config: {
		width: number, 
		height: number
	}, 
	image: string
}>()

props.image; 
props.config;


const cropperObj = ref(null);
const backgroundColor = ref('#FFFFFF')


const cropperPreset: any = computed(() => {
	return {
		mode: 'fixedSize',
		width: props.config.width || 800,
		height: props.config.width || 800,
	}
})


const cropperOptions: any = computed(() => {
	return {
		viewMode: 0,
		doubleClickToggle: false,
		toggleDragModeOnDblclick: false,
		autoCropArea: true,
		dragMode: 'move',
		aspectRatio: (props.config.width / props.config.height) || 1,
		cropBoxMovable: false,
		cropBoxResizable: false
	}
})

const cropperBox = computed(() => {
	return {
		width: '100%', //(props.config.width == 600 ? '222px' : (props.config.width == 800 ? '291px' : '465px')),
		height: '100%',//(props.config.width == 600 ? '296px' : (props.config.width == 800 ? '291px' : '292px')),
		backgroundColor: '#FFFFFF'

	}
})


function setBackgroundColor(color: string): void {

	backgroundColor.value = color;

	if (document.getElementsByClassName('cropper-view-box') != null && document.getElementsByClassName('cropper-view-box').length > 0) {
		((document.getElementsByClassName('cropper-view-box')[0] as any).style.backgroundColor = backgroundColor.value);
	}
}


async function saveImage(): Promise<void> {

// if (image.value==null) return emit('save', null);
const canvas = cropper!.getCroppedCanvas({ width: props.config.width || 800, height: props.config.height || 800, fillColor: backgroundColor.value, imageSmoothingEnabled: false });




// Convert canvas to a Blob
canvas.toBlob(async (blob) => {
	// Create a File from the Blob
	const file = new File([blob as Blob], "compressed-image.jpeg", { type: "image/jpeg" });

	// Compress the file using ImageCompressor
	const compressor = new ImageCompressor();

	let isCompressed = false;
	let compressionQuality = 1;
	let compressedFile = null;

	while (isCompressed == false) {
		const options = {
			maxWidth: props.config.width || 800,
			maxHeight: props.config.height || 800,
			minWidth: props.config.width || 800,
			minHeight: props.config.height || 800,
			quality: compressionQuality, // Adjust this value to control the image compression quality
		};

		compressedFile = await compressor.compress(file, options)

		console.log(options)
		// Check if the compressed file size is smaller than 65kB
		if (compressedFile.size >= 60 * 1024) {
			compressionQuality -= .1
			continue;
		}

		isCompressed = true;
	}


	if (compressedFile == null) throw new Error();

	const reader = new FileReader();
	reader.onloadend = () => {
		const base64 = reader.result;
		console.log(base64)
		// emit('save', base64);
	};
	reader.readAsDataURL(compressedFile);
}, "image/jpeg");

}

</script>



<style scoped>

</style>