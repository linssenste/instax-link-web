<template>
	<div style="height: 100%; width: 100%; position: relative;" >
	<div data-testid="drop-area" v-on:click="uploadImage()" class="drop-area ">

		<div class="area-background" :style="backgroundColorStyling" />


		<input data-testid="input-file" v-on:change="inputChanged($event)" type="file" name="" accept="image/*" id='upload'
			   hidden>

		<div class="upload-text">
			<i :style="colorStyling" class="fa-solid fa-cloud-arrow-up" />
			<div :style="colorStyling">UPLOAD IMAGE</div>
			<span style="">or drag and drop a file </span>
		</div>


		
	</div>
	<button v-if="!config.connection" v-on:click="connectPrinterEvent" :style="backgroundColorStyling" style="z-index: 10000; width: 130px; position: absolute; bottom: 20px; left: 50%; transform: translateX(-50%);  "><span style="color: white">
		
		<i class="fa-brands fa-bluetooth-b" style="margin-right: 8px; font-size: 15px;"/>Connect</span></button>
	</div>
</template>

<script lang="ts" setup>
import { computed } from 'vue';


const props = defineProps<{

	config: {
		theme: string,
		connection: boolean
	}
}>();
const emit = defineEmits(['selected']);


function connectPrinterEvent(): void {
	console.log("connectPrinterEvent")
}
function inputChanged(e: Event): void {
	e.preventDefault();
	e.stopImmediatePropagation();

	const file = (e.target as any).files[0];

	emit('selected', file)

}
const backgroundColorStyling = computed(() => {
	return `background-color:  var(--${props.config.theme}-color);`
})

const colorStyling = computed(() => {
	return `color:  var(--${props.config.theme}-color);`
})



function uploadImage(): void {
	document.getElementById('upload')?.click();
}

</script>


<style scoped>
.drop-area {
	position: relative;
	width: 100%;
	height: 100%;
	background-color: white;
	cursor: pointer;
	color: #FFFFFFCC;
	transition: all 150ms ease-in-out;

}

.upload-text {
	position: absolute;
	left: 50%;
	top: 50%;
	transform: translate(-50%, -50%);
	width: 100%;
	text-align: center;
}

.upload-text i {
	font-size: 35px;
	margin-bottom: 10px;
}

.upload-text span {
	font-size: 14px;
	font-weight: 200;
	margin-top: 2px
}

.area-background {
	width: 100%;
	height: 100%;
	position: absolute;
	opacity: .5
}


.drop-area:hover {
	color: #FFFFFF;
}
</style>