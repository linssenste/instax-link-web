<template>
	<div class="settings-container">

		<!-- caption input; only visible if no printer is connected -->
		<input id="caption-input" spellcheck="false" class="caption-input" placeholder="Image caption" :maxlength="captionLength" v-model="settings.text" />

		<div class="align-span-buttons">

			<!-- rotation control + input -->
			<div class="rotation-controls">

				<!-- rotate left icon button -->
				<button oncontextmenu="return false" title="rotate image clockwise"  v-on:click="updateRotation(-1)" class="icon-button ">
					<img draggable="false" title="rotate image clockwise" src="@/assets/icons/controls/rotate-left.svg" width="16" />
				</button>


				<!-- input; values are handled in updateRotation function -->
				<div class="rotation-input">
					<input id="rotation-input" title="image roation degree input form" v-model="settings.rotation" v-on:keyup.enter="inputEnterEvent" type="number" pattern="\d*"
						   min="0" max="360">
					<span class="rotation-degree">°</span>
				</div>

				<!-- rotate right icon button -->
				<button oncontextmenu="return false" title="rotate image counter-clockwise" v-on:click="updateRotation(1)" class="icon-button">
					<img draggable="false" title="rotate image counter-clockwise" src="@/assets/icons/controls/rotate-right.svg" width="16" />
				</button>


				<div>

					<!-- color selector -->
					<input title="select background color" type="color" class="color-selector" v-model="settings.color" />
				</div>
			</div>



			<div class="alignment-buttons">

				<!-- Horizontal Scale Button -->
				<button oncontextmenu="return false" title="align image horizontally" v-on:click="setAlignment('scale', false)" class="icon-button">
					<img draggable="false" title="align image horizontally"  src="@/assets/icons/controls/align-horizontal.svg" width="16" />
				</button>


				<!-- Vertical Scale Button -->
				<button oncontextmenu="return false" title="align image vertically" v-on:click="setAlignment('scale', true)" class="icon-button">
					<img draggable="false" title="align image vertically" src="@/assets/icons/controls/align-vertical.svg" width="16" />
				</button>

			</div>
		</div>



		<button v-on:click="save" :style="backgroundColorStyling" :title="config.connection ? 'print image with instax printer' : 'download polaroid image with filter & caption'" class="action-button">
			<span v-if="config.connection">
				Print Image
			</span>
			<span v-else>Download</span>
		</button>


	</div>
</template>

<script lang="ts" setup>
import { computed, onMounted, ref, watch } from 'vue';
const emit = defineEmits(['change', 'scale']);

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
	color: '#FFFFFF',
	text: ''
});


const captionLength = computed(() => {
	return (props.config.width == 600 ? 15 : (props.config.width == 800 ? 25 : 40))
})

const backgroundColorStyling = computed(() => {
	return `background-color:  var(--${props.config.theme}-color);`
})

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

	font-weight: 400!important;
	font-size: 16px !important;
}

.rotation-degree {
	color: #00000055;
	position: absolute;
	right: 0px;
	top: 8px;
}

.rotation-input input {
	height: 40px;
	outline: none;
	border: none;
	text-align: center;
	font-weight: 400!important;
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

	.caption-input:hover {
		background-color: #ffffffee;
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

.caption-input {
	width: 100%;
	height: 40px;
	font-size: 24px!important;
	letter-spacing: 2px;
	padding-top: 5px;

	padding-bottom: 5px;
	margin-top: 5px;
	margin-bottom: 10px;
	text-align: center;
	outline: none;
	background-color: #ffffffaa;
	border: none;
	border-radius: 15px;
	transition: all 100ms ease-in-out;
	font-family: "biro_script_standardregular"!important;
	caret-color: #00000033;
}


.caption-input::placeholder {
	color: #00000033;
	opacity: 1;
}


.caption-input::-ms-input-placeholder {
	color: #00000033;
}


.action-button {
	width: 100%;
	color: white;
	margin-top: 10px;


}
</style>
