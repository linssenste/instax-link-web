<template>
	<div>

		<DropImageUpload v-on:dropped="getFileData($event)" />


		<!-- the editor is capped at the frame's intrinsic width so the settings
			 panel below can never end up wider than the polaroid itself -->
		<div class="polaroid-editor" :style="{ maxWidth: `${POLAROID_FRAME_WIDTH[config.type]}px` }">

			<PolaroidFrame :type="config.type" class="frame">
				<template v-slot:polaroid-area="{ displayScale }">

					<CropperArea v-if="image" ref="cropperAreaRef" :config="config" :src="image" :loading="loading"
						:settings="imageSettings" :displayScale="displayScale" v-on:remove-image="removeImageEvent"
						v-on:save="savePolaroidCanvas" />

					<SelectImageUpload v-else v-on:selected="getFileData($event)" />
					<div v-if="loading" class="loading-overlay">
						<div
							style="position: absolute; bottom: 30px; left: 50%; transform: translateX(-50%); color: black; opacity: .35; letter-spacing: 1px;">
							LOADING ...</div>
					</div>

				</template>

				<template v-slot:polaroid-text>
					<!-- the caption is written straight onto the polaroid, in the spot
						 it will occupy on the print -->
					<input v-if="image" id="caption-input" class="polaroid-caption caption-input"
						   data-testid="caption-input" spellcheck="false" placeholder="add a caption"
						   :maxlength="captionLength" v-model="caption" />

					<div v-else class="polaroid-caption">
						<span>Choose an image!</span>
					</div>
				</template>
			</PolaroidFrame>

			<SettingsExpansion :config="config" :queueLength="queueLength" :hasImage="image != null"
							   :savePolaroid="saveEditorPolaroid" v-on:change="updatedSettingsEvent"
							   v-on:scale="fitImageEvent" />

		</div>
	</div>
</template>

<script setup lang="ts">

import { computed, onBeforeUnmount, ref, Ref } from 'vue'
import PolaroidFrame from './PolaroidFrame.vue';
import CropperArea from './CropperArea.vue';
import DropImageUpload from '../files/DropImageUpload.vue';
import SelectImageUpload from '../files/SelectImageUpload.vue';
import { InstaxFilmVariant, type PrinterStateConfig } from '../../interfaces/PrinterStateConfig';
import SettingsExpansion from '../layout/SettingsExpansion.vue';
import { POLAROID_FRAME_WIDTH } from '../../polaroid/frame.geometry';

const emit = defineEmits(['image'])

const props = defineProps<{
	config: PrinterStateConfig,
	queueLength: number;
}>()


const cropperAreaRef: Ref<typeof CropperArea | null> = ref(null);
props.config;


const loading = ref(false)

// how the image is placed in the frame, owned by the settings panel
const adjustments = ref({ rotation: 0, color: '#FFFFFF' })

// the caption is edited on the polaroid itself, so it lives here
const caption = ref('')

const captionLength = computed(() => {
	if (props.config.type === InstaxFilmVariant.MINI) return 18;
	return props.config.type === InstaxFilmVariant.SQUARE ? 25 : 35;
})

const imageSettings = computed(() => ({ ...adjustments.value, text: caption.value }))


const image = ref<string | null>(null);

// the object URL currently backing `image`, kept so it can be revoked again
let objectUrl: string | null = null;


// ImageSettings resets its own adjustments once the image is gone; the caption
// belongs to the image too, so it is cleared alongside it
function removeImageEvent() {
	image.value = null;
	releaseImageSource();

	// delayed, so the text does not visibly vanish while the panel slides away
	setTimeout(() => {
		if (!image.value) caption.value = '';
	}, 500);
}

function updatedSettingsEvent(settings: { rotation: number; color: string }) {
	adjustments.value = settings;
}


async function saveEditorPolaroid(download = false): Promise<void> {

	loading.value = true;

	await new Promise((r) => setTimeout(r, 525)) // await the panel collapse animation


	const imageUrl = await cropperAreaRef.value?.saveCanvasImage(!download);
	emit("image", { src: imageUrl, download: download })

	setTimeout(() => {
		loading.value = false

	}, 750);

}


function fitImageEvent(type: string): void {
	if (cropperAreaRef.value) cropperAreaRef.value.fit((type == 'horizontal'));
}
function savePolaroidCanvas(imageURL: string): void {
	emit('image', imageURL)
}
function getFileData(file: File | null): void {
	if (!file) return;

	// resize first if it is oversized, then hand the blob straight to the canvas
	resizeImage(file, 1024, 1024, setImageSource);
}

// object URLs reference the blob in place. Reading the file into a base64 data
// URL instead would copy it, inflate it by a third, and make the canvas parse
// that string back again on every load
function setImageSource(blob: Blob): void {
	releaseImageSource();
	objectUrl = URL.createObjectURL(blob);
	image.value = objectUrl;
}

function releaseImageSource(): void {
	if (!objectUrl) return;
	URL.revokeObjectURL(objectUrl);
	objectUrl = null;
}

onBeforeUnmount(releaseImageSource);

// scale an oversized image down before it ever reaches the canvas
function resizeImage(file: File, maxWidth: number, maxHeight: number, callback: (resizedFile: Blob) => void): void {
	if (file.size < 1.5 * maxWidth * maxHeight) {
		callback(file);
		return;
	}

	try {
		const img = new Image();
		const sourceUrl = URL.createObjectURL(file);

		img.onload = function () {
			URL.revokeObjectURL(sourceUrl);

			const canvas = document.createElement('canvas');
			let width = img.width;
			let height = img.height;

			// Scale down maintaining aspect ratio
			if (width > maxWidth || height > maxHeight) {
				const aspectRatio = width / height;
				if (width > height) {
					width = maxWidth;
					height = maxWidth / aspectRatio;
				} else {
					height = maxHeight;
					width = maxHeight * aspectRatio;
				}
			}

			// Set canvas size and draw the image
			canvas.width = width;
			canvas.height = height;
			const ctx = canvas.getContext('2d')!;
			ctx.drawImage(img, 0, 0, width, height);

			canvas.toBlob((blob) => {
				callback(blob ?? file);
			}, file.type, 0.85);
		};

		img.onerror = function () {
			URL.revokeObjectURL(sourceUrl);
			callback(file);
		}

		img.src = sourceUrl;
	} catch {
		callback(file);
	}
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
	position: relative;

	/* auto margins (rather than justify-content on the scroll parent) keep the
	   editor centred without clipping its top edge once it overflows. The width
	   cap comes from the film variant and is bound in the template */
	margin: auto;
	padding: 20px 10px;
	width: calc(100% - 20px);
}

.frame {
	z-index: 5;
}

/* the caption lives in the frame's bottom border, so it scales with the frame
   and keeps its position no matter how far the polaroid is scaled down */
.polaroid-caption {
	width: 100%;
	text-align: center;
	color: rgba(0, 15, 85, .75);
	font-family: 'biro_script_standardregular' !important;
	font-size: calc(25px * var(--polaroid-scale, 1));

	/* a negative padding is ignored by the browser, so the nudge is a margin */
	margin-top: calc(-10px * var(--polaroid-scale, 1));
}

.polaroid-caption span {
	white-space: nowrap;
}

/* the input is the caption itself, sitting where the text will be printed. It is
   tinted with the theme colour so it reads as a field on the white paper, and
   every offset scales with the frame */
.caption-input {
	display: block;
	box-sizing: border-box;
	border: none;
	outline: none;
	letter-spacing: 1px;

	/* 5px of breathing room either side of the frame's text area */
	width: calc(100% - 10px * var(--polaroid-scale, 1));
	margin-left: calc(5px * var(--polaroid-scale, 1));
	margin-right: calc(5px * var(--polaroid-scale, 1));

	/* a fixed box, so the padding below shifts the text inside it rather than
	   growing the field. An input centres its text in the content box, so the
	   8px of top padding moves the text down by half that */
	height: calc(40px * var(--polaroid-scale, 1));
	padding: calc(8px * var(--polaroid-scale, 1)) calc(10px * var(--polaroid-scale, 1)) 0;

	border-radius: calc(12px * var(--polaroid-scale, 1));
	caret-color: rgba(0, 15, 85, .45);
	transition: background-color 150ms ease-in-out;

	/* Tint of the field. Transparent at rest, so what is on screen is what gets
	   printed - the italic placeholder is what makes it discoverable - and tinted
	   only while pointed at or focused.
	   For a permanent tint instead, raise --caption-rest-opacity to about .12.
	   A white tint is not worth trying: the paper is already near white, which is
	   why it read as invisible. */
	--caption-tint: var(--dynamic-bg-color);
	--caption-rest-opacity: 0;

	background-color: rgba(var(--caption-tint), var(--caption-rest-opacity));
}

.caption-input::placeholder {
	color: rgba(0, 15, 85, .3);
	font-style: italic;
	opacity: 1;
}

/* .caption-input:focus {
	background-color: rgba(var(--caption-tint), .22);
}

@media (hover: hover) and (pointer: fine) {
	.caption-input:hover {
		background-color: rgba(var(--caption-tint), .14);
	}
} */
</style>
