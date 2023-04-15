<template>
    <div oncontextmenu="return false" class="polaroid-area elevation-4"
        :style="`width: ${((config.width/config.height)*300)+30}px`" data-testid="polaroid-area">


        <div :style="`width: ${((config.width/config.height)*300)}px;`" class="cropper-area">

            <!-- Printing overlay!-->

            <VuePictureCropper :key="config.width" v-if="image!=null"
                :style="(printerStatus===2||printerStatus===3||printerStatus===4)? 'opacity: .2; pointer-events: none':''"
                ref="cropperObj" :boxStyle="cropperBox" class="cropper" :presetMode="cropperPreset" :img="image"
                :options="cropperOptions" />

            <div v-else data-testid="drop-area" v-on:click="uploadImage"
                class="drop-area d-flex flex-column align-center justify-center">

                <input data-testid="input-file" v-on:change="inputChanged($event)" type="file" name="" accept="image/*"
                    id='upload' hidden>

                <div class="d-flex flex-column ma-0 mt-4 align-center">

                    <v-icon color="grey-darken-2" size="40">mdi-image</v-icon>
                    <span style="text-transform: uppercase; letter-spacing: 1.05px; font-size: 14px"
                        class="text-grey-darken-2 ml-2 mt-2 font-weight-bold">Upload image</span>
                </div>
            </div>

        </div>
        <div v-if="isEditable" style=" width: 100%; height: 95px; background-color: white;" :key="config.width"
            data-testid="color-selector-container">
            <ColorSelector data-testid="color-selector" class="pt-4" v-on:color-change="setBackgroundColor" />

            <div class="d-flex pt-5  flex-row align-center ma-0">



                <v-btn class="elevation-0 mr-2" v-on:click="rotateImage(1)" size="small" variant="tonal" :ripple="false"
                    icon="mdi-rotate-right" color="black"></v-btn>
                <v-btn class="elevation-0 mr-4" v-on:click="rotateImage(-1);" size="small" variant="tonal" :ripple="false"
                    icon="mdi-rotate-left" color="black"></v-btn>

                <v-btn class="elevation-0 ml-0 mr-0" v-on:click="rotateImage(-90);" size="small" variant="tonal"
                    :ripple="false" icon="mdi-format-rotate-90"></v-btn>




                <v-spacer />
                <v-btn class="elevation-0 ml-0" v-on:click="image=null" variant="flat" color="#F0F0F0" :ripple="false" icon
                    density="comfortable">
                    <v-icon size="small" color="red">mdi-delete</v-icon></v-btn>
            </div>

        </div>
    </div>
</template>



<script setup lang="ts">

import { ref, watch } from 'vue';
import VuePictureCropper, { cropper } from 'vue-picture-cropper'
import ColorSelector from '@/components/polaroid/ColorSelector.vue'

import { computed } from 'vue';

const emit=defineEmits(['save', 'cancelPrinting', 'connect', 'count', 'saveable'])
const props=defineProps<{

    config: any,

    color: string,
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
const image=ref<string|null>(null)


const isEditable=computed(() => {
    return image.value!=null&&(props.printerStatus!==2&&props.printerStatus!==3&&props.printerStatus!==4)
})

watch(isEditable, () => {
    emit('saveable', isEditable.value)
})


function rotateImage(degrees: number): void {
    (cropper as any).rotate(degrees);
}

const cropperPreset: any=computed(() => {
    return {
        mode: 'fixedSize',
        width: props.config.width,
        height: props.config.width,
    }
})


const cropperOptions: any=computed(() => {
    return {
        viewMode: 0,
        doubleClickToggle: false,
        toggleDragModeOnDblclick: false,
        autoCropArea: true,
        dragMode: 'move',
        aspectRatio: props.config.width/props.config.height,
        cropBoxMovable: false,
        cropBoxResizable: false
    }
})

const cropperBox=computed(() => {
    return {
        width: ((props.config.width/props.config.height)*300)+'px',
        height: '300px',
        backgroundColor: '#FFFFFF'

    }
})


function setBackgroundColor(color: string): void {
    backgroundColor.value=color;
    console.log(document.getElementsByClassName('cropper-view-box'))
    if (document.getElementsByClassName('cropper-view-box')!=null&&document.getElementsByClassName('cropper-view-box').length>0) {
        ((document.getElementsByClassName('cropper-view-box')[0] as any).style.backgroundColor=backgroundColor.value);
    }
}


function uploadImage(): void {
    document.getElementById('upload')?.click();
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
        image.value=reader.result as string;
        setBackgroundColor('#FFFFFF')

    };
    reader.onerror=function (error) {
        console.log('Error: ', error);
    };
}


async function saveImage(): Promise<void> {

    if (image.value==null) return emit('save', null);
    const canvasUrl=cropper!.getCroppedCanvas({ width: parseInt(props.config.width as string|'800'), height: parseInt(props.config.height as string|'800'), fillColor: backgroundColor.value, imageSmoothingEnabled: false }).toDataURL('image/jpeg');
    emit('save', canvasUrl)

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


.polaroid-area {
    position: relative;
    height: 445px;
    border: 15px solid white;
    border-top: 20px solid white !important;
    background-color: white;
    border-radius: 8px;
}


.drop-area {
    height: 100%;
    cursor: pointer;
    width: 100%;
    background-color: #E0E0E0;
    border: 2px dashed #C0C0C0;
    border-radius: 5px;
}

.cropper {
    transform: scale(1);
    border: 2px solid #EAEAEA;
    border-radius: 5px !important;
    overflow: hidden !important
}

.cropper-area {
    position: relative;
    height: 100%;
    height: 300px;
    margin-top: 10px;
    border-radius: 5px;
    overflow: hidden !important;
    background-color: #F0F0F0;
}
</style>