<template>
	<div class="editor-root" :class="{ ready: frameReady }" data-testid="editor-root">

		<DropImageUpload :hasImage="image != null" v-on:dropped="getFileData($event)" />


		<!-- the editor is capped at the frame's intrinsic width so the settings
			 panel below can never end up wider than the polaroid itself -->
		<div class="polaroid-editor" :style="{ maxWidth: `${POLAROID_FRAME_WIDTH[config.type]}px` }">

			<PolaroidFrame :type="config.type" class="frame" v-on:ready="frameReady = true">
				<template v-slot:polaroid-area>

					<CropperArea v-if="image" ref="cropperAreaRef" :config="config" :src="image" :loading="loading"
						:settings="imageSettings" v-on:remove-image="removeImageEvent"
						v-on:save="savePolaroidCanvas" />

					<SelectImageUpload v-else v-on:selected="getFileData($event)" />
					<div v-if="loading" class="loading-overlay" role="status" aria-live="polite"
						 data-testid="loading-overlay">
						<span class="loading-label">Rendering polaroid</span>
						<div class="loading-stripes" aria-hidden="true">
							<span /><span /><span /><span /><span />
						</div>
					</div>

				</template>

				<template v-slot:polaroid-text>
					<!-- the caption is written straight onto the polaroid, in the spot
						 it will occupy on the print -->
					<input v-if="image" id="caption-input" class="polaroid-caption caption-input"
						   data-testid="caption-input" spellcheck="false" placeholder="add a caption"
						   aria-label="Caption printed on the polaroid" :maxlength="captionLength" v-model="caption" />

					<div v-else class="polaroid-caption">
						<span>Choose an image!</span>
					</div>
				</template>
			</PolaroidFrame>

			<SettingsExpansion :config="config" :queueLength="queueLength" :hasImage="image != null"
							   :savingAction="savingAction" :savePolaroid="saveEditorPolaroid"
							   v-on:change="updatedSettingsEvent" v-on:scale="fitImageEvent" />

		</div>
	</div>
</template>

<script setup lang="ts">

import { computed, onBeforeUnmount, onMounted, ref, watch, type Ref } from 'vue'
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


// which action is rendering, so the panel can show progress on just that button
const savingAction = ref<'print' | 'download' | null>(null)
const loading = computed(() => savingAction.value != null)

// nothing is shown until the frame artwork has settled, so the polaroid does not
// assemble itself piece by piece on screen
const frameReady = ref(false);
let frameReadyTimeout: ReturnType<typeof setTimeout> | undefined;

onMounted(() => {
	// never leave the editor hidden if the load event never arrives
	frameReadyTimeout = setTimeout(() => { frameReady.value = true }, 2000);
});

onBeforeUnmount(() => clearTimeout(frameReadyTimeout));

// how the image is placed in the frame, owned by the settings panel
const adjustments = ref({ rotation: 0, color: '#FFFFFF' })

// the caption is edited on the polaroid itself, so it lives here
const caption = ref('')

const captionLength = computed(() => {
	if (props.config.type === InstaxFilmVariant.MINI) return 18;
	return props.config.type === InstaxFilmVariant.SQUARE ? 25 : 35;
})

// maxlength only stops further typing, so a caption written for a wider film has
// to be cut back when a smaller one is picked
watch(captionLength, (limit) => {
	if (caption.value.length > limit) caption.value = caption.value.slice(0, limit);
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
	if (savingAction.value != null) return;

	savingAction.value = download ? 'download' : 'print';

	await new Promise((r) => setTimeout(r, 525)) // await the panel collapse animation

	// hand the browser a frame to paint the overlay before the capture blocks it
	await new Promise((r) => requestAnimationFrame(() => r(null)))

	try {
		const imageUrl = await cropperAreaRef.value?.saveCanvasImage(!download);

		// the cropper is gone if the image was removed while it rendered
		if (imageUrl) emit("image", { src: imageUrl, download, caption: caption.value, type: props.config.type })
	} catch (error) {
		// otherwise the editor would stay stuck in its loading state
		console.error('> could not render the polaroid', error)
		savingAction.value = null;
		return;
	}

	setTimeout(() => {
		savingAction.value = null
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


</script>


<style scoped>
/* the whole editor arrives at once, once the frame artwork is there to arrive in.
   It owns a stacking context at level 0 so the z-indexes inside it stay inside,
   and the corner controls sit above it */
.editor-root {
	position: relative;
	z-index: 0;

	opacity: 0;
	transform: translateY(10px) scale(.985);
	transition: opacity 450ms ease-out, transform 450ms ease-out;
	will-change: opacity, transform;
}

.editor-root.ready {
	opacity: 1;
	transform: none;

	/* the reveal is over; keeping the layer promoted would only cost memory */
	will-change: auto;
}

@media (prefers-reduced-motion: reduce) {
	.editor-root {
		transition: none;
		transform: none;
	}
}

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

/* the label is for screen readers; the dots carry it visually */
.loading-label {
	position: absolute;
	width: 1px;
	height: 1px;
	overflow: hidden;
	clip-path: inset(50%);
	white-space: nowrap;
}

.loading-stripes {
	position: absolute;
	top: 50%;
	left: 50%;
	transform: translate(-50%, -50%);
	display: flex;
	align-items: flex-end;
}

/* The bars sit edge to edge like the theme strip and rise in a wave.
   Height comes from scaleY rather than the height property, so the browser keeps
   this on the compositor: the wave carries on while the main thread is busy
   rasterising the canvas.

   The five colours and their order are the Polaroid stripe. */
.loading-stripes span {
	width: 14px;
	height: 24px;
	transform-origin: bottom center;
	transform: scaleY(.28);
	will-change: transform;
	animation: loading-wave 1.3s cubic-bezier(.4, 0, .2, 1) infinite;
}

/* only the outer ends are rounded, so the bars read as one strip */
.loading-stripes span:first-child {
	border-top-left-radius: 2px;
	border-bottom-left-radius: 2px;
}

.loading-stripes span:last-child {
	border-top-right-radius: 2px;
	border-bottom-right-radius: 2px;
}

.loading-stripes span:nth-child(1) {
	background-color: rgb(var(--blue-color));
}

.loading-stripes span:nth-child(2) {
	background-color: rgb(var(--green-color));
	animation-delay: .09s;
}

.loading-stripes span:nth-child(3) {
	background-color: rgb(var(--yellow-color));
	animation-delay: .18s;
}

.loading-stripes span:nth-child(4) {
	background-color: rgb(var(--orange-color));
	animation-delay: .27s;
}

.loading-stripes span:nth-child(5) {
	background-color: rgb(var(--red-color));
	animation-delay: .36s;
}

/* each bar grows up from the baseline, holds, then settles back */
@keyframes loading-wave {

	0%,
	62%,
	100% {
		transform: scaleY(.28);
	}

	28% {
		transform: scaleY(1);
	}
}

@media (prefers-reduced-motion: reduce) {
	.loading-stripes span {
		animation: none;
		transform: scaleY(.5);
	}
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
	height: calc(45px * var(--polaroid-scale, 1));
	padding: calc(8px * var(--polaroid-scale, 1)) calc(10px * var(--polaroid-scale, 1)) 0;

	border-radius: calc(12px * var(--polaroid-scale, 1));
	caret-color: rgba(0, 15, 85, .45);
	transition: background-color 150ms ease-in-out;

	/* the focus ring replaces the tint as the focus cue, so keep both */
	outline-offset: calc(-2px * var(--polaroid-scale, 1));

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

.caption-input:focus-visible {
	outline: 2px solid rgb(var(--dynamic-bg-color));
}

@media (hover: hover) and (pointer: fine) {
	.caption-input:hover {
		background-color: rgba(var(--caption-tint), .14);
	}
} */
</style>
