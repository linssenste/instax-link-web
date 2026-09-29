<template>
	<div class="settings-container">

		<div class="align-span-buttons">

			<!-- rotation dial: drag the knob, click a quarter turn, or type a value -->
			<div class="rotation-controls">

				<RotateSelector v-model="settings.rotation" />

				<!-- color selector; the icon sits on top of the swatch -->
				<div class="color-control">
					<input title="select background color" aria-label="Background color behind the image"
						   data-testid="color-selector-input" type="color" class="color-selector"
						   v-model="settings.color" />
					<span class="color-icon" aria-hidden="true" data-testid="color-selector-icon"
						  :style="{ backgroundColor: readableIconColor }" />
				</div>
			</div>

			<div class="alignment-buttons">

				<!-- Horizontal Scale Button -->
				<button oncontextmenu="return false" type="button" title="align image vertically"
						aria-label="Fit image to the frame height" data-testid="align-vertical-button"
						v-on:click="setAlignment('scale', false)" class="icon-button">
					<img draggable="false" alt="" src="@/assets/icons/controls/align-vertical.svg" width="16" />
				</button>

				<!-- Vertical Scale Button -->
				<button oncontextmenu="return false" type="button" data-testid="align-horizontal-button"
						title="align image horizontally" aria-label="Fit image to the frame width"
						v-on:click="setAlignment('scale', true)" class="icon-button">
					<img draggable="false" alt="" src="@/assets/icons/controls/align-horizontal.svg" width="16" />
				</button>

			</div>
		</div>

	</div>
</template>

<script lang="ts" setup>
import { computed, onBeforeUnmount, ref, watch } from 'vue';
import RotateSelector from './RotateSelector.vue';
const emit = defineEmits(['change', 'scale']);

/**
 * Pick black or white for the icon drawn on the chosen colour.
 *
 * Uses relative luminance rather than a plain average: the eye is far more
 * sensitive to green than to blue, so averaging would call a saturated blue
 * light and a yellow dark. The 0.179 threshold is where the contrast ratio
 * against black overtakes the one against white.
 */
function readableOn(color: string): string {
	const hex = color.replace('#', '').trim();
	const full = hex.length === 3 ? hex.split('').map((part) => part + part).join('') : hex;
	if (!/^[0-9a-f]{6}$/i.test(full)) return '#000000';

	const channel = (offset: number) => {
		const value = parseInt(full.slice(offset, offset + 2), 16) / 255;
		return value <= 0.03928 ? value / 12.92 : Math.pow((value + 0.055) / 1.055, 2.4);
	};

	const luminance = 0.2126 * channel(0) + 0.7152 * channel(2) + 0.0722 * channel(4);
	return luminance > 0.179 ? '#000000' : '#FFFFFF';
}

const props = withDefaults(defineProps<{
	hasImage?: boolean;
}>(), { hasImage: true });

// how the loaded image is placed inside the frame. The caption is not part of
// this: it is edited on the polaroid itself
const settings = ref({
	rotation: 0,
	color: '#FFFFFF'
});

// these settings belong to the loaded image, so they are reset once it is gone.
// delayed, so the fields do not visibly jump while the panel slides away
let resetTimer: ReturnType<typeof setTimeout> | undefined;
watch(() => props.hasImage, (hasImage) => {
	clearTimeout(resetTimer);
	if (hasImage) return;

	resetTimer = setTimeout(() => {
		settings.value.rotation = 0;
	}, 500);
});

onBeforeUnmount(() => clearTimeout(resetTimer));

const readableIconColor = computed(() => readableOn(settings.value.color));


async function setAlignment(type: 'scale', horizontal: boolean): Promise<void> {
	emit(type, horizontal ? 'horizontal' : 'vertical')
}

watch(settings, () => {
	emit('change', settings.value);
}, { deep: true });

</script>

<style scoped>
.settings-container {
	position: relative;
	display: flex;
	flex-direction: column;
	align-items: center;
	padding: 0 10px 10px;
	justify-content: center;
}

.align-span-buttons {
	display: flex;
	flex-direction: row;
	align-items: center;
	width: 100%;
	justify-content: space-between;
}

.alignment-buttons {
	display: flex;
	flex-direction: row;
	align-items: center;
	gap: 4px;

}

.icon-button {
	width: 40px;
	height: 40px;
	border-radius: 50%;
	position: relative;
	outline: none;
	border: none;
	background-color: #ffffffaa;
	cursor: pointer;
	padding: 0;
	transition: all 100ms ease-in-out;
}

.icon-button img {
	margin-right: 0;
	position: absolute;
	opacity: .95;
	top: 50%;
	left: 50%;
	transform: translate(-50%, -50%);
}

.icon-button:focus-visible {
	outline: 2px solid rgb(var(--dynamic-bg-color));
	outline-offset: 2px;
	z-index: 10;
}

@media (hover: hover) and (pointer: fine) {
	.icon-button:hover {
		background-color: #ffffffee;
		/* transform: scale(1.05); */
		z-index: 10;
		box-shadow: 0px 0px 5px rgba(0, 0, 0, .05);
	}

	.icon-button:hover img {
		opacity: 1;
	}

}

.rotation-controls {
	position: relative;
	display: flex;
	flex-direction: row;
	align-items: center;
	gap: 6px;
}

input[type=number]::-webkit-outer-spin-button,
input[type=number]::-webkit-inner-spin-button {
	-webkit-appearance: none;
	margin: 0;
}

input[type=number] {
	-moz-appearance: textfield;
}

.color-selector:focus-visible {
	outline: 2px solid rgb(var(--dynamic-bg-color)) !important;
	outline-offset: 2px;
}

.color-selector {
	background-color: transparent;

	outline: none !important;
	border: none;
	-webkit-user-drag: none;

	-moz-user-select: none;
	-webkit-user-select: none;
	user-select: none;

	cursor: pointer;
	width: 100%;
	height: 100%;
	border-radius: 10px !important;
	padding: 0px !important;
	overflow: hidden;

	/* keeps a white swatch visible against the panel */
	box-shadow: inset 0 0 0 1px rgba(0, 0, 0, .12);

	margin: 0px;
	outline-color: transparent;
}

.color-control {
	position: relative;
	width: 40px;
	height: 40px;
	flex: none;
}

/* Masked so it can be recoloured: the fill is set from the luminance of the
   chosen colour, so the icon stays legible on anything from white to black. */
.color-icon {
	position: absolute;
	inset: 0;
	pointer-events: none;
	-webkit-mask: url('../../assets/icons/controls/fill-color.svg') center / 18px 18px no-repeat;
	mask: url('../../assets/icons/controls/fill-color.svg') center / 18px 18px no-repeat;
	transition: background-color 150ms ease-in-out;
}

/* The swatch itself is drawn inside a shadow root with its own square border, so
   the rounding has to be applied there as well or the colour stays a square. */
.color-selector::-webkit-color-swatch-wrapper {
	padding: 0;
	border-radius: 10px;
}

.color-selector::-webkit-color-swatch {
	border: none;
	border-radius: 10px;
}

.color-selector::-moz-color-swatch {
	border: none;
	border-radius: 10px;
}

</style>
