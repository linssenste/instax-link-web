<template>
    <div oncontextmenu="return false" class="polaroid-area elevation-4" :style="``" data-testid="polaroid-area">
        <!-- {{config}} {{(((config.width/config.height)||1)*((config.height-500)||300))}} -->
        <div :key="String(config.width)" class="cropper-area"
            :style="`width: ${(((config.width/config.height)||1)*(config.height-500||300))}px!important; height: ${(config.height-500)}px!important`">


            <!-- Printing overlay!-->

            <div v-if="(printerStatus===2||printerStatus===3||printerStatus===4)"
                style="position: absolute; height: 100%; width: 100%; z-index: 50">
                <div
                    style="position: relative; height: 100%; width: 100%; background-color: rgba(240, 240, 240, .3); transition: all 150ms linear;">

                    <slot name="overlay" />
                </div>
            </div>

            <VuePictureCropper v-if="image!=null"
                :style="(printerStatus===2||printerStatus===3||printerStatus===4)? 'opacity: .15; pointer-events: none':''"
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
        <div v-if="isEditable" style=" width: 100%; background-color: white;"
            data-testid="color-selector-container">
            <ColorSelector data-testid="color-selector" class="pt-4" v-on:color-change="setBackgroundColor" />

            <div class="d-flex pt-5  flex-row align-center ma-0">
                <v-btn v-on:click="alignVerticalCenter()"
                       class="elevation-0 mr-2" 
                       icon="mdi-format-vertical-align-center"
                       variant="tonal"
                       size="small"
                       :ripple="false"
                       color="black">
                </v-btn>
                <v-btn v-on:click="alignHorizontalCenter()"
                       class="elevation-0 mr-4"
                       icon="mdi-format-horizontal-align-center"
                       variant="tonal"
                       size="small"
                       :ripple="false"
                       color="black">
                </v-btn>
                <v-btn v-on:click="fitVertical()"
                       class="elevation-0 mr-2"
                       icon="mdi-arrow-expand-vertical"
                       variant="tonal"
                       size="small"
                       :ripple="false"
                       color="black">
                </v-btn>
                <v-btn v-on:click="fitHorizontal()"
                       class="elevation-0"
                       icon="mdi-arrow-expand-horizontal"
                       variant="tonal"
                       size="small"
                       :ripple="false"
                       color="black">
                </v-btn>
            </div>
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
        <div v-else class="d-flex flex-row align-center justify-center "
            style=" width: 100%; height: 95px; background-color: white;">
            <slot name="text-area" />

        </div>
    </div>
</template>



<script setup lang="ts">

import { ref, watch } from 'vue';
import VuePictureCropper, { cropper } from 'vue-picture-cropper'
import ColorSelector from '@/components/polaroid/ColorSelector.vue'
import ImageCompressor from 'image-compressor.js';
import { computed } from 'vue';

const emit=defineEmits(['save', 'cancelPrinting', 'connect', 'count', 'saveable'])
const props=defineProps<{
    config: any,
    color: string,
    printerStatus: number,
    save: boolean,
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

interface CanvasData {
    left: number,
    top: number,
    height: number,
    width: number,
    naturalWidth: number,
    naturalHeight: number,
}

function getImageSize(): CanvasData {
    return (cropper as any).getCanvasData();
}

function getCropperSize(): {width: number, height: number} {
    return (cropper as any).getContainerData();
}

function alignVerticalCenter(): void {
    const imageSize = getImageSize();
    const cropperSize = getCropperSize();
    const top = (cropperSize.height - imageSize.height)/2;
    (cropper as any).moveTo(imageSize.left, top);
}

function alignHorizontalCenter(): void {
    const imageSize = getImageSize();
    const cropperSize = getCropperSize();
    const left = (cropperSize.width - imageSize.width)/2;
    (cropper as any).moveTo(left, imageSize.top);
}

function fit(ratio: number): void {
    const cropperSize = getCropperSize();
    const pivot = {x: cropperSize.width/2, y: cropperSize.height/2};
    (cropper as any).zoomTo(ratio, pivot);
    alignVerticalCenter();
    alignHorizontalCenter();
}

function fitVertical(): void {
    fit(getCropperSize().height / getImageSize().naturalHeight);
}

function fitHorizontal(): void {
    fit(getCropperSize().width / getImageSize().naturalWidth);
}

const cropperPreset: any=computed(() => {
    return {
        mode: 'fixedSize',
        width: props.config.width||800,
        height: props.config.width||800,
    }
})


const cropperOptions: any=computed(() => {
    return {
        viewMode: 0,
        doubleClickToggle: false,
        toggleDragModeOnDblclick: false,
        autoCropArea: true,
        dragMode: 'move',
        aspectRatio: (props.config.width/props.config.height)||1,
        cropBoxMovable: false,
        cropBoxResizable: false
    }
})

const cropperBox=computed(() => {
    return {
        width: ((((props.config.width/props.config.height)||1))*((props.config.height-500)||300))+'px',
        height: ((props.config.height-500)||300)+'px',
        backgroundColor: '#FFFFFF'

    }
})


function setBackgroundColor(color: string): void {
    backgroundColor.value=color;

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
    const canvas=cropper!.getCroppedCanvas({ width: props.config.width||800, height: props.config.height||800, fillColor: backgroundColor.value, imageSmoothingEnabled: false });




    // Convert canvas to a Blob
    canvas.toBlob(async (blob) => {
        // Create a File from the Blob
        const file=new File([blob as Blob], "compressed-image.jpeg", { type: "image/jpeg" });

        // Compress the file using ImageCompressor
        const compressor=new ImageCompressor();

        let isCompressed=false;
        let compressionQuality=1;
        let compressedFile=null;

        while (isCompressed==false) {
            const options={
                maxWidth: props.config.width||800,
                maxHeight: props.config.height||800,
                minWidth: props.config.width||800,
                minHeight: props.config.height||800,
                quality: compressionQuality, // Adjust this value to control the image compression quality
            };

            compressedFile=await compressor.compress(file, options)

            console.log(options)
            // Check if the compressed file size is smaller than 65kB
            if (compressedFile.size>=60*1024) {
                compressionQuality-=.1
                continue;
            }

            isCompressed=true;
        }


        if (compressedFile==null) throw new Error();

        const reader=new FileReader();
        reader.onloadend=() => {
            const base64=reader.result;
            emit('save', base64);
        };
        reader.readAsDataURL(compressedFile);
    }, "image/jpeg");

}

props.config;
props.color;
props.printerStatus;
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
    min-height: 380px;
    min-width: 200px;
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