<template>
    <div class="area " oncontextmenu="return false">
        <div class=" elevation-10" :style="`width: ${((config.width/config.height)*300)+30}px`"
            style="position: relative; height: 445px;  border: 15px solid white; border-top: 20px solid white!important;background-color: white; border-radius: 8px; ">


            <div v-on:dblclick="$event.preventDefault(); $event.stopImmediatePropagation()"
                :style="`width: ${((config.width/config.height)*300)}px;`"
                style="position: relative; height: 100%; height: 300px; margin-top: 10px;  border-radius: 5px; overflow: hidden!important; background-color: #F0F0F0; ">

                <!-- Printing overlay!-->

                <VuePictureCropper :key="config.width" v-if="image!=null"
                    :style="(printerStatus===2||printerStatus===3||printerStatus===4)? 'opacity: .2; pointer-events: none':''"
                    v-on:click="$event.preventDefault(); $event.stopImmediatePropagation()"
                    v-on:dblclick="$event.preventDefault(); $event.stopImmediatePropagation()" ref="cropperObj" :boxStyle="{
                        width: ((config.width/config.height)*300)+'px',
                        height: '300px',
                        backgroundColor: '#FFFFFF'

                    }"
                    style="transform: scale(1);border: 2px solid #EAEAEA; border-radius: 5px!important; overflow: hidden!important"
                    :presetMode="{
                        mode: 'fixedSize',
                        width: config.width,
                        height: config.width,
                    }" :img="image" :options="{
    viewMode: 0,
    doubleClickToggle: false,
    toggleDragModeOnDblclick: false,
    autoCropArea: true,
    dragMode: 'move',
    aspectRatio: config.width/config.height,
    cropBoxMovable: false,
    cropBoxResizable: false
}" />

                <div v-else v-on:click="uploadImage" v-on:drop="dropHandler"
                    class="d-flex flex-column align-center justify-center" ref="dropArea"
                    style="height: 100%; cursor: pointer; width: 100%; background-color: #EAEAEA; border: 2px dashed #A0A0A0; border-radius: 5px;"
                    v-on:dragenter="focusDropArea()" v-on:dragleave="unfocusDropArea()"
                    v-on:dragover="focusDropArea(); $event.preventDefault();">

                    <input v-on:change="inputChanged" type="file" name="" accept="image/*" id='upload' hidden>

                    <div class="d-flex flex-row ma-0 mt-4 align-center">

                        <v-icon color="#A0A0A0">mdi-image</v-icon><span
                            style="color: #A0A0A0; text-transform: uppercase; letter-spacing: 1.05px; font-size: 15px"
                            class=" ml-2">Upload image</span>
                    </div>
                </div>

            </div>
            <div v-if="isEditable" style=" width: 100%; height: 95px; background-color: white;" :key="config.width">
                <ColorSelector class="pt-4" v-on:color-change="setBackgroundColor" />

                <div class="d-flex pt-5  flex-row align-center ma-0">



                    <v-btn class="elevation-0 mr-2" v-on:click="cropper.rotate(1);" size="small" variant="tonal"
                        :ripple="false" icon="mdi-rotate-right" color="black"></v-btn>
                    <v-btn class="elevation-0 mr-4" v-on:click="cropper.rotate(-1);" size="small" variant="tonal"
                        :ripple="false" icon="mdi-rotate-left" color="black"></v-btn>

                    <v-btn class="elevation-0 ml-0 mr-0" v-on:click="cropper.rotate(-90);" size="small" variant="tonal"
                        :ripple="false" icon="mdi-format-rotate-90"></v-btn>




                    <v-spacer />
                    <v-btn class="elevation-0 ml-0" v-on:click="image=null" variant="flat" color="#F0F0F0" :ripple="false"
                        icon density="comfortable">
                        <v-icon size="small" color="red">mdi-delete</v-icon></v-btn>
                </div>

            </div>
        </div>

    </div>
</template>



<script setup lang="ts">

import { ref, watch } from 'vue';
import VuePictureCropper, { cropper } from 'vue-picture-cropper'
import ColorSelector from '@/components/polaroid/ColorSelector.vue'
import { nextTick } from 'vue';
import { computed } from 'vue';

const emit=defineEmits(['save', 'cancelPrinting', 'connect', 'count', 'saveable'])
const props=defineProps<{

    config: any,

    printerStatus: number
    save: boolean
}>()

props.config;
props.printerStatus;

watch(() => props.save, () => {
    saveImage();
})




const cropperObj=ref(null);
const backgroundColor=ref('#FFFFFF')
const image=ref(null)

const dropArea=ref(null);


const isEditable=computed(() => {
    return image.value!=null&&(props.printerStatus!==2&&props.printerStatus!==3&&props.printerStatus!==4)
})

watch(isEditable, () => {
    emit('saveable', isEditable.value)
})

function unfocusDropArea(): void {
    (dropArea.value as any).style.backgroundColor='#EAEAEA'
}

function focusDropArea(): void {
    (dropArea.value as any).style.backgroundColor='yellow'
}

function setBackgroundColor(color: string): void {
    backgroundColor.value=color;
    console.log(document.getElementsByClassName('cropper-view-box'))
    if (document.getElementsByClassName('cropper-view-box')!=null&&document.getElementsByClassName('cropper-view-box').length>0) {
        (document.getElementsByClassName('cropper-view-box')[0].style.backgroundColor=backgroundColor.value);
    }
}


function uploadImage(): void {
    document.getElementById('upload')?.click();
}

function dropHandler(ev: Event) {
    unfocusDropArea();
    console.log("File(s) dropped");

    // Prevent default behavior (Prevent file from being opened)
    ev.preventDefault();
    ev.stopImmediatePropagation();
    if ((ev as any).dataTransfer.items) {
        getFileData((ev as any).dataTransfer.items[0].getAsFile())
    } else {
        // Use DataTransfer interface to access the file(s)
        getFileData((ev as any).dataTransfer.files[0].getAsFile())
    }
}

function inputChanged(e: Event): void {
    e.preventDefault();
    e.stopImmediatePropagation();

    const file=(e.target as any).files[0];

    getFileData(file)

}

function getFileData(file: File): void {
    console.log(file)
    var reader=new FileReader();
    reader.readAsDataURL(file);
    reader.onload=async function () {
        image.value=reader.result
        setBackgroundColor('#FFFFFF')

    };
    reader.onerror=function (error) {
        console.log('Error: ', error);
    };
}

async function saveImage(): Promise<void> {

    const canvas=cropper!.getCroppedCanvas({ width: parseInt(props.config.width as string|'800'), height: parseInt(props.config.height as string|'800'), fillColor: backgroundColor.value, imageSmoothingEnabled: false }).toDataURL();
    console.log(canvas)
    emit('save', canvas)

}


</script>

<style >
.cropper-view-box {
    box-shadow: 0 0 0 0px #F0F0F0;
    background-color: white;
    /* border-bottom: 100px solid #F0F0F0; */
    outline: 0;
}

.cropper-face {
    background-color: inherit !important;
}

.cropper-dashed,
.cropper-point.point-se,
.cropper-point.point-sw,
.cropper-point.point-nw,
.cropper-point.point-ne,
.cropper-line {
    display: none !important;
}

.cropper-view-box {
    outline: inherit !important;
}
</style>


<style scoped>
img {
    display: block;

    /* This rule is very important, please don't ignore this */
    max-width: 100%;
}


.area {
    position: relative;
}
</style>