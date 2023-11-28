<template>
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
</template>

<script lang="ts" setup>
import { computed } from 'vue';


const props = defineProps<{
	theme: string
}>();
const emit = defineEmits(['selected']);



const backgroundColorStyling = computed(() => {
	return `background-color:  var(--${props.theme}-color);`
})

const colorStyling = computed(() => {
	return `color:  var(--${props.theme}-color);`
})


function inputChanged(e: Event): void {
	e.preventDefault();
	e.stopImmediatePropagation();

	const file = (e.target as any).files[0];

	emit('selected', file)

}

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
	opacity: .3
}


.drop-area:hover {
	color: #FFFFFF;
}
</style>