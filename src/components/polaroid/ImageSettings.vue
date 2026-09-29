<template>
	<div class="settings-container">

		<div class="align-span-buttons">

			<!-- rotation control + input -->
			<div class="rotation-controls">

				<!-- rotate left icon button -->
				<button oncontextmenu="return false" title="rotate image clockwise" v-on:click="updateRotation(-1)"
						class="icon-button " data-testid="rotate-clockwise-button">
					<img draggable="false" title="rotate image clockwise" src="@/assets/icons/controls/rotate-left.svg"
						 width="16" />
				</button>


				<!-- input; values are handled in updateRotation function -->
				<div class="rotation-input">
					<input id="rotation-input" data-testid="rotation-input" title="image roation degree input form"
						   v-model="settings.rotation" v-on:keyup.enter="inputEnterEvent" type="number" pattern="\d*"
						   min="0" max="360">
					<span class="rotation-degree">°</span>
				</div>

				<!-- rotate right icon button -->
				<button oncontextmenu="return false" title="rotate image counter-clockwise" v-on:click="updateRotation(1)"
						class="icon-button" data-testid="rotate-counter-clockwise-button">
					<img draggable="false" title="rotate image counter-clockwise"
						 src="@/assets/icons/controls/rotate-right.svg" width="16" />
				</button>


				<div>
					<!-- color selector -->
					<input title="select background color" data-testid="color-selector-input" type="color"
						   class="color-selector" v-model="settings.color" />
				</div>
			</div>


			<div class="alignment-buttons">

				<!-- Horizontal Scale Button -->
				<button oncontextmenu="return false" title="align image vertically" data-testid="align-vertical-button"
						v-on:click="setAlignment('scale', false)" class="icon-button">
					<img draggable="false" title="align image vertically" src="@/assets/icons/controls/align-vertical.svg"
						 width="16" />
				</button>


				<!-- Vertical Scale Button -->
				<button oncontextmenu="return false" data-testid="align-horizontal-button" title="align image horizontally"
						v-on:click="setAlignment('scale', true)" class="icon-button">
					<img draggable="false" title="align image vertically" src="@/assets/icons/controls/align-horizontal.svg"
						 width="16" />
				</button>

			</div>
		</div>

	</div>
</template>

<script lang="ts" setup>
import { onBeforeUnmount, ref, watch } from 'vue';
const emit = defineEmits(['change', 'scale']);

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


async function setAlignment(type: 'scale', horizontal: boolean): Promise<void> {
	emit(type, horizontal ? 'horizontal' : 'vertical')
}

watch(settings, () => {
	emit('change', settings.value);
}, { deep: true });


// wrap any degree value (including the string the number input hands us) into [0, 360)
function normalizeRotation(value: unknown): number {
	const degrees = Number(value);
	if (!Number.isFinite(degrees)) return 0;
	return ((Math.round(degrees) % 360) + 360) % 360;
}


// step the rotation by one degree in either direction
function updateRotation(value: number) {
	settings.value.rotation = normalizeRotation(Number(settings.value.rotation) + value);
}


// normalize the manually typed value and blur the input field
function inputEnterEvent() {
	settings.value.rotation = normalizeRotation(settings.value.rotation);
	(document.activeElement as HTMLInputElement)?.blur()
}


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
	position: absolute;
	opacity: .95;
	top: 50%;
	left: 50%;
	transform: translate(-50%, -50%);
}


.rotation-input {
	height: 40px;
	width: 45px;
	position: relative;

	background-color: #FFFFFFAA;


	font-weight: 400 !important;
	font-size: 16px !important;
}

.rotation-degree {
	color: #00000055;
	position: absolute;
	right: 0px;
	top: 8px;
}

.rotation-input input {
	position: relative;
	height: 40px;
	outline: none;
	width: 30px;
	border: none;
	text-align: center;
	font-weight: 400 !important;
	padding-right: 2px;
	padding-left: 10px;
	background-color: transparent;
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
	gap: 0px;
}

.rotation-controls .icon-button {
	z-index: 5;
	border-radius: 0px;
	width: 40px;
	height: 40px;
}

.rotation-controls .icon-button:first-child {

	border-top-left-radius: 50%;
	border-bottom-left-radius: 50%;
}

.rotation-controls .icon-button:last-of-type {

	border-top-right-radius: 50%;
	border-bottom-right-radius: 50%;
	margin-right: 4px;
}


input[type=number]::-webkit-outer-spin-button,
input[type=number]::-webkit-inner-spin-button {
	-webkit-appearance: none;
	margin: 0;
}

input[type=number] {
	-moz-appearance: textfield;
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
	width: 35px !important;
	border-radius: 10px !important;
	height: 40px !important;
	padding: 0px !important;

	margin: 0px;
	margin-top: 3px;
	outline-color: transparent;
}

</style>
