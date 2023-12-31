<template>
	<div class="settings-container">
		<div class="align-span-buttons">

			<!-- rotation control + input -->
			<div class="rotation-controls">

				<!-- rotate left icon button -->
				<button oncontextmenu="return false" v-on:click="updateRotation(-1)" class="icon-button ">
					<img draggable="false" src="@/assets/icons/controls/rotate_left.webp" width="16" />
				</button>


				<!-- input; values are handled in updateRotation function -->
				<div class="rotation-input">
					<input v-model="settings.rotation" v-on:keyup.enter="inputEnterEvent" type="number" pattern="\d*"
						   min="0" max="360">
					<span style="color: #00000055; position: absolute; right: 4px; top: 8px;">°</span>
				</div>
				<!-- rotate right icon button -->
				<button oncontextmenu="return false" v-on:click="updateRotation(1)" class="icon-button">
					<img draggable="false" src="@/assets/icons/controls/rotate_right.webp" width="16" />
				</button>


				<div>

					<!-- color selector -->
					<input type="color" class="color-selector" v-model="settings.color" />
				</div>
			</div>


			<div class="alignment-buttons">
				<!-- Horizontal Scale Button -->
		
				<button v-if="config.width >= 800" oncontextmenu="return false" v-on:click="setAlignment('scale', false)" class="icon-button">
					<img draggable="false" src="@/assets/icons/controls/scale_horizontal.webp" width="16" />
				</button>

				<!-- Vertical Scale Button -->
				<button oncontextmenu="return false" v-on:click="setAlignment('scale', true)" class="icon-button">
					<img draggable="false" src="@/assets/icons/controls/scale_vertical.webp" width="16" />
				</button>


				<!-- Vertical Scale Button -->
				<button oncontextmenu="return false" v-on:click="removeImage" class="icon-button">
					<i class="fa-solid fa-xmark" style="font-size: 18px; color: red; " />
				</button>

			</div>
		</div>




		<button v-on:click="save" :style="backgroundColorStyling" style="width: 100%;color: white; margin-top: 10px">
			<span v-if="config.connection">
				Print image
			</span>
			<span v-else>
				Save image
			</span>
		</button>


	</div>
</template>

<script lang="ts" setup>
import { computed, ref, watch } from 'vue';
const emit = defineEmits(['change', 'remove-image', 'scale']);

const props = defineProps<{
	config: {
		width: number,
		height: number,
		theme: string,
		connection: boolean,

	},
	save: any
}>();
props.config;
props.save;

const settings = ref({
	rotation: 0,
	color: '#FFFFFF'
});


const backgroundColorStyling = computed(() => {
	return `background-color:  var(--${props.config.theme}-color);`
})

function removeImage(): void {
	emit("remove-image")
}


async function setAlignment(type: 'scale', horizontal: boolean): Promise<void> {
	emit(type, horizontal ? 'horizontal' : 'vertical')
}

watch(settings, () => {
	emit('change', settings.value);
}, { deep: true });



function updateRotation(value: number) {
	if (settings.value.rotation <= 0 && value == -1) settings.value.rotation = 359;
	else if (settings.value.rotation >= 359 && value == 1) settings.value.rotation = 0;
	else settings.value.rotation += value;
}

function inputEnterEvent() {

	if (settings.value.rotation > 360) settings.value.rotation = settings.value.rotation - (Math.round((settings.value.rotation / 360)) * 360)

	if (settings.value.rotation < 0) settings.value.rotation = 360 + settings.value.rotation;
	(document.activeElement as HTMLInputElement)?.blur()
}


</script>

<style scoped>
.settings-container {
	position: relative;
	display: flex;
	flex-direction: column;
	align-items: center;

	padding-top: 4px;



	padding-bottom: 10px;
	position: relative;
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
	transition: all 100ms ease-in-out;
}



.icon-button img {
	position: absolute;
	top: 50%;
	left: 50%;
	transform: translate(-50%, -50%);
}



.rotation-input {
	height: 40px;
	width: 45px;
	position: relative;

	background-color: #FFFFFFAA;

	font-weight: 500;
	font-size: 16px!important;
}

.rotation-input input {
	height:40px;
	outline: none;
	border: none;
	text-align: center;
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

input::-webkit-outer-spin-button,
input::-webkit-inner-spin-button {
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
