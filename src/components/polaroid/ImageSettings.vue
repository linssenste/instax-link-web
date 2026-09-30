<template>
	<div class="settings-container">

		<div class="align-span-buttons">

			<!-- The framing controls read left to right across the panel, and the dial
				 is pushed to the far end. Each is two rows of 40px so the lot sits
				 inside the dial's own height: six in a single row beside it would run
				 past the edge of a mini frame. -->
			<div class="image-controls">

				<!-- the two fits above, and under each the centring for that same axis -->
				<div class="alignment-buttons">

					<button oncontextmenu="return false" type="button" :title="titleWith('Fit the image to the frame height', SHORTCUTS.fitHeight)"
							aria-label="Fit image to the frame height" data-testid="align-vertical-button"
							:aria-pressed="alignment.fitsHeight" :class="{ holds: alignment.fitsHeight }"
							v-on:click="setAlignment('scale', false)" class="icon-button">
						<span class="button-icon fit-height" aria-hidden="true" />
					</button>

					<button oncontextmenu="return false" type="button" data-testid="align-horizontal-button"
							:title="titleWith('Fit the image to the frame width', SHORTCUTS.fitWidth)" aria-label="Fit image to the frame width"
							:aria-pressed="alignment.fitsWidth" :class="{ holds: alignment.fitsWidth }"
							v-on:click="setAlignment('scale', true)" class="icon-button">
						<span class="button-icon fit-width" aria-hidden="true" />
					</button>

					<!-- these light up while the image already sits on that centre line,
						 however it got there, so the four read as the state of the
						 framing and not only as four things to press -->
					<button oncontextmenu="return false" type="button" data-testid="centre-vertical-button"
							:title="titleWith('Centre the image vertically', SHORTCUTS.centreVertically)" aria-label="Centre image on the vertical axis"
							:aria-pressed="alignment.centredVertically"
							:class="{ holds: alignment.centredVertically }"
							v-on:click="$emit('centre', 'vertical')" class="icon-button">
						<span class="button-icon centre-vertical" aria-hidden="true" />
					</button>

					<button oncontextmenu="return false" type="button" data-testid="centre-horizontal-button"
							:title="titleWith('Centre the image horizontally', SHORTCUTS.centreHorizontally)" aria-label="Centre image on the horizontal axis"
							:aria-pressed="alignment.centredHorizontally"
							:class="{ holds: alignment.centredHorizontally }"
							v-on:click="$emit('centre', 'horizontal')" class="icon-button">
						<span class="button-icon centre-horizontal" aria-hidden="true" />
					</button>
				</div>

				<!-- what the picture looks like, rather than where it sits -->
				<div class="look-buttons">

					<!-- color selector; the icon sits on top of the swatch -->
					<div class="color-control">
						<input title="select background color" aria-label="Background color behind the image"
							   data-testid="color-selector-input" type="color" class="color-selector"
							   v-model="settings.color" />
						<span class="color-icon" aria-hidden="true" data-testid="color-selector-icon"
							  :style="{ backgroundColor: readableIconColor }" />
					</div>

					<!-- the film look opens a dialog of its own, so it sits with the
						 other things done to the picture rather than with the actions -->
					<button oncontextmenu="return false" type="button" data-testid="open-film-button"
							:title="titleWith('Film look', SHORTCUTS.filmLook)" aria-label="Open the film look settings"
							v-on:click="$emit('open-film')" class="icon-button">
						<span class="button-icon film-look" aria-hidden="true" />
					</button>
				</div>
			</div>

			<!-- rotation dial: drag the knob, click a quarter turn, or type a value -->
			<RotateSelector v-model="settings.rotation" />
		</div>

	</div>
</template>

<script lang="ts" setup>
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import RotateSelector from './RotateSelector.vue';
import { NOT_ALIGNED, type FrameAlignment } from '../../polaroid/frame.geometry';
import { commandFor, titleWith, SHORTCUTS } from '../../polaroid/shortcuts';
const emit = defineEmits(['change', 'scale', 'centre', 'move', 'open-film', 'toggle-settings']);

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
	/** which framing states already hold, so each control can show its own */
	alignment?: FrameAlignment;
}>(), { hasImage: true, alignment: () => ({ ...NOT_ALIGNED }) });

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

/**
 * The editor's keyboard, listened for on the document so it works whether or not the
 * panel is open. The settings are the right home for it: the rotation lives here,
 * and everything else is already an event this component sends.
 */
function keyboardEvent(event: KeyboardEvent): void {
	if (!props.hasImage) return;

	const command = commandFor(event);
	if (command == null) return;

	event.preventDefault();

	switch (command.kind) {
		case 'move': return emit('move', { x: command.x, y: command.y });
		case 'fit': return emit('scale', command.horizontal ? 'horizontal' : 'vertical');
		case 'centre': return emit('centre', command.horizontal ? 'horizontal' : 'vertical');
		case 'rotate': return void (settings.value.rotation += command.degrees);
		case 'film': return emit('open-film');
		case 'settings': return emit('toggle-settings');
	}
}

onMounted(() => document.addEventListener('keydown', keyboardEvent));
onBeforeUnmount(() => document.removeEventListener('keydown', keyboardEvent));

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

/* the full width of the panel: the framing controls from the left edge, the dial
   at the right */
.align-span-buttons {
	display: flex;
	flex-direction: row;
	align-items: center;
	width: 100%;
	justify-content: space-between;
}

/* a wider gap between the clusters than within them, so the two read apart */
.image-controls {
	display: flex;
	flex-direction: row;
	align-items: center;
	gap: 20px;
	flex: none;
}

.alignment-buttons {
	display: grid;
	grid-template-columns: repeat(2, 40px);
	gap: 4px;
	flex: none;
}

.look-buttons {
	display: grid;
	grid-template-columns: 40px;
	gap: 4px;
	flex: none;
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

/* masks rather than images, so the mark takes a colour from the stylesheet: the
   icons themselves ship with a placeholder fill that would vanish on white */
.button-icon {
	position: absolute;
	top: 50%;
	left: 50%;
	width: 20px;
	height: 20px;
	margin: -10px 0 0 -10px;
	opacity: .8;
	background-color: #000000;
	transition: opacity 100ms ease-in-out, background-color 100ms ease-in-out;
}

.fit-width {
	-webkit-mask: url('@/assets/icons/controls/fit-width.svg') center / contain no-repeat;
	mask: url('@/assets/icons/controls/fit-width.svg') center / contain no-repeat;
}

/* the same icon on its side: two bars across instead of two bars up */
.fit-height {
	-webkit-mask: url('@/assets/icons/controls/fit-width.svg') center / contain no-repeat;
	mask: url('@/assets/icons/controls/fit-width.svg') center / contain no-repeat;
	rotate: 90deg;
}

.film-look {
	-webkit-mask: url('@/assets/icons/controls/sliders.svg') center / contain no-repeat;
	mask: url('@/assets/icons/controls/sliders.svg') center / contain no-repeat;
}

.centre-vertical {
	-webkit-mask: url('@/assets/icons/controls/vertical-alignment.svg') center / contain no-repeat;
	mask: url('@/assets/icons/controls/vertical-alignment.svg') center / contain no-repeat;
}

.centre-horizontal {
	-webkit-mask: url('@/assets/icons/controls/horitzontal-alignment.svg') center / contain no-repeat;
	mask: url('@/assets/icons/controls/horitzontal-alignment.svg') center / contain no-repeat;
}

/* already the case: the button reads as lifted, the way it does under the pointer,
   and stays there for as long as it holds */
.icon-button.holds {
	background-color: #ffffff;
}

.icon-button.holds .button-icon {
	opacity: 1;
	background-color: rgb(var(--dynamic-bg-color));
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

	.icon-button:hover .button-icon {
		opacity: 1;
		background-color: rgb(var(--dynamic-bg-color));
	}

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
