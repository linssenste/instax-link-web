<template>
<div  data-testid="drop-area" v-on:click="uploadImage()" class="drop-area " >

<div class="area-background" :style="backgroundColorStyling"/>
<div class="area-border"></div>
<input data-testid="input-file" v-on:change="inputChanged($event)" type="file" name=""
	   accept="image/*" id='upload' hidden>

	   <div style="position: absolute; left: 50%; top: 50%; transform: translate(-50%, -50%); width: 100%; text-align: center;">
		<i :style="colorStyling" class="fa-solid fa-cloud-arrow-up" style="font-size: 50px; margin-bottom: 20px;"/>
		<div :style="colorStyling"><b>UPLOAD IMAGE</b></div>
		<div style="font-size: 14px; font-weight: 200; margin-top: 2px">or drag and drop a file </div>
	</div>

</div>
</template>

<script lang="ts" setup>
import { computed } from 'vue';


const props = defineProps<{
	config: any
}>(); 
const emit = defineEmits(['selected']);



const backgroundColorStyling = computed(() => {
	return `background-color:  var(--${props.config.theme}-color);`
})

const colorStyling = computed(() => {
	return `color:  var(--${props.config.theme}-color);`
})


function inputChanged(e: Event): void {
	e.preventDefault();
	e.stopImmediatePropagation();

	const file = (e.target as any).files[0];

	emit('selected', file)

}

function uploadImage(): void {
	console.log("JS")
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
	color: #FFFFFFAA; 
	transition: all 150ms ease-in-out;

}

.area-background {
	width: 100%; 
	height: 100%;
	position: absolute;
	opacity: .3
}
.area-border {
position: absolute;
	top: 50%;
	left: 50%;
	transform: translate(-50%, -50%);
	width: calc(100% - 40px);
	height: calc(100% - 40px);
	border: 2px dashed #FFFFFF88;
	border-radius: 4px;
	transition: all 150ms ease-in-out;

}

.drop-area:hover {
	color: #FFFFFF;
}

.drop-area:hover .area-border {
	border: 2px dashed #FFFFFFFF;
}
</style>