<template>
    <div class="area " oncontextmenu="return false">
        <div :class="image!=null&&(isPrinting||aborting==true)? 'print-in-action':''" class=" elevation-10"
            :style="`width: ${((config.width/config.height)*300)+30}px`"
            style="position: relative; height: 445px;  border: 15px solid white; border-top: 20px solid white!important;background-color: white; border-radius: 8px; ">


            <div v-on:dblclick="$event.preventDefault(); $event.stopImmediatePropagation()"
                :style="`width: ${((config.width/config.height)*300)}px;`"
                style="position: relative; height: 100%; height: 300px; margin-top: 10px;  border-radius: 5px; overflow: hidden!important; background-color: #F0F0F0; ">

                <PrintingOverlay :color="color" v-if="image!=null&&(isPrinting||aborting==true)" :progress="status"
                    :isPrinting="isPrinting" :aborting="aborting" :printingCount="printingCount" />

                <!-- {{  }} -->

                <VuePictureCropper :key="config.width" v-if="image!=null"
                    :style="isPrinting? 'opacity: .2; pointer-events: none':''"
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
            <div style=" width: 100%; height: 105px; background-color: white;">
                <div v-if="image!=null&&isPrinting!=true" class="d-flex flex-row ma-0 hide-scrollbar align-center pt-0 pl-1"
                    :style="`width: ${((config.width/config.height)*300)}px; overflow-x: auto; height: 50px`">



                    <PageBackgroundSelector :key="config.width" v-on:change="setBackgroundColor($event)" :dense="true" />



                </div>
                <div v-if="image!=null&&isPrinting!=true" class="d-flex pt-2  flex-row align-center ma-0">



                    <!-- <v-btn style="background-color: #EAEAEA;" v-on:click="cropper.rotate(+45);" size="x-small" variant="solo"
    :ripple="false" icon="mdi-format-rotate-90" color="black"></v-btn> -->


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



                <div v-if="isPrinting==true&&!aborting" class="d-flex flex-row align-center justify-center pt-9">
                    <v-btn :disabled="totalPrints<=1||printingCount>=1" v-on:click="totalPrints-=1" :ripple="false"
                        class="mr-4" icon density="compact" variant="tonal"><v-icon
                            size="x-small">mdi-minus</v-icon></v-btn>
                    <div style="font-size: 20px; width: 15px; text-align: center;" class="font-weight-medium">
                        {{totalPrints}}</div>
                    <v-btn :disabled="totalPrints>=10||printingCount>=1" v-on:click="totalPrints+=1" :ripple="false"
                        class="ml-4" icon density="compact" variant="tonal"><v-icon size="x-small">mdi-plus</v-icon></v-btn>

                </div>



                <!-- <div v-if="image==null" class="d-flex flex-row align-center">
                    <img width="100"
                        src="https://upload.wikimedia.org/wikipedia/commons/thumb/3/3f/Instax.svg/1280px-Instax.svg.png" />
                </div> -->
            </div>



        </div>



        <div class="pt-5" style="height: 80px; width: 100%; ">

            <!-- <div style="height: 30px">
                <div v-if="image!=null&&isPrinting!=true" class="d-flex flex-row align-center">
                    <div class="color-button bg-black" :class="backgroundColor=='#000000'? 'active-button':'inactive-button'"
                    v-on:click="setBackgroundColor('#000000')">
                </div>
                <div class="color-button bg-white mr-0 ml-1"
                    :class="backgroundColor=='#FFFFFF'? 'active-button':'inactive-button'"
                    v-on:click="setBackgroundColor('#FFFFFF')">
                </div>



                    <v-spacer />

                    <v-btn class="elevation-0" v-on:click="cropper.zoom(-0.025);" density="comfortable" variant="flat"
                        :ripple="false" icon color="#FFFFFF77"><v-icon color="black" size="small">mdi-minus</v-icon></v-btn>
                    <v-btn class="elevation-0 ml-2" v-on:click="cropper.zoom(0.025);" density="comfortable" variant="flat"
                        :ripple="false" icon color="#FFFFFF77"><v-icon color="black" size="small">mdi-plus</v-icon></v-btn>

                </div>
            </div> -->

            <v-btn :style="image==null||aborting||(isPrinting==true&&status==0)? 'opacity: .2;':''"
                v-if="!isPrinting&&!aborting&&isConnected" :color="`${color}`" rounded="lg" class="font-weight-bold mt-2"
                variant="flat" block v-on:click="saveImage">Print
                image</v-btn>

            <v-btn :style="hasBluetoothAccess!==true? 'opacity: .5; pointer-events: none':''" v-on:click="connectPrinter()"
                v-else-if="!isConnected" color="blue-darken-2" variant="tonal"
                class="font-weight-bold mt-2 text-blue-darken-1" rounded="lg" block><v-icon class="mr-2"
                    color="blue-darken-1">mdi-bluetooth</v-icon>Connect Printer</v-btn>
            <v-btn v-else-if="isConnected&&(isPrinting||aborting)" class="mt-2 font-weight-bold " :loading="aborting"
                variant="flat" :color="`${color}`" rounded="lg" block v-on:click="cancelPrint()"><v-icon
                    class="mr-2">mdi-close</v-icon>Cancel</v-btn>
        </div>
    </div>
</template>

<script lang="ts">
export default {
    name: "PolaroidCropper",
    inheritAttrs: false,
    customOptions: {},
    components: { PageBackgroundSelector, PrintingOverlay }
}
</script>

<script setup lang="ts">

import { ref, watch } from 'vue';
import VuePictureCropper, { cropper } from 'vue-picture-cropper'
import { Buffer } from 'buffer';
import ImageCompressor from 'image-compressor.js';
import PageBackgroundSelector from './legal/PageBackgroundSelector.vue';
import PrintingOverlay from './polaroid/PrintingOverlay.vue';


const emit=defineEmits(['save', 'cancelPrinting', 'connect', 'count'])
const props=defineProps<{
    status: number
    isPrinting: boolean;
    isConnected: boolean;
    aborting: boolean;
    color: string;

    hasBluetoothAccess: boolean,
    config: any,
    printingCount: number



}>()

props.config;



function cancelPrint(): void {
    console.log("------------------------------------------------------------------ CANCEL PRINT")
    emit('cancelPrinting')
}
const dropArea=ref(null)

function connectPrinter(): void {
    emit('connect')
}
const totalPrints=ref(1)


watch(totalPrints, () => {
    emit('count', totalPrints.value)
})

function unfocusDropArea(): void {
    dropArea.value.style.backgroundColor='#EAEAEA'
}

function focusDropArea(): void {
    dropArea.value.style.backgroundColor='yellow'
}

function setBackgroundColor(color: string): void {
    backgroundColor.value=color;
    console.log(color, document.getElementsByClassName('cropper-view-box'));
    if (document.getElementsByClassName('cropper-view-box')!=null&&document.getElementsByClassName('cropper-view-box').length>0) {
        (document.getElementsByClassName('cropper-view-box')[0].style.backgroundColor=backgroundColor.value);
    }

}
const cropperObj=ref(null);

const backgroundColor=ref('#FFFFFF')

const image=ref(null)

function uploadImage(): void {
    document.getElementById('upload')?.click();
}

function dropHandler(ev) {
    unfocusDropArea();
    console.log("File(s) dropped");

    // Prevent default behavior (Prevent file from being opened)
    ev.preventDefault();
    ev.stopImmediatePropagation();
    if (ev.dataTransfer.items) {
        getFileData(ev.dataTransfer.items[0].getAsFile())
    } else {
        // Use DataTransfer interface to access the file(s)
        getFileData(ev.dataTransfer.files[0].getAsFile())
    }
}

function inputChanged(e): void {
    e.preventDefault();
    e.stopImmediatePropagation();
    console.log("OM", e.target.files)

    const file=e.target.files[0];

    getFileData(file)

}

function getFileData(file: File): void {
    console.log(file)
    var reader=new FileReader();
    reader.readAsDataURL(file);
    reader.onload=function () {
        image.value=reader.result
        //  console.log(reader.result);
    };
    reader.onerror=function (error) {
        console.log('Error: ', error);
    };
}

async function saveImage(): Promise<void> {


    const canvas=cropper!.getCroppedCanvas({ width: parseInt(props.config.width as string|'800'), height: parseInt(props.config.height as string|'800'), fillColor: backgroundColor.value, imageSmoothingEnabled: false });




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
                maxWidth: parseInt(props.config.width as string|'800'),
                maxHeight: parseInt(props.config.height as string|'800'),
                minWidth: parseInt(props.config.width as string|'800'),
                minHeight: parseInt(props.config.height as string|'800'),
                quality: compressionQuality, // Adjust this value to control the image compression quality
            };

            compressedFile=await compressor.compress(file, options)

            // Check if the compressed file size is smaller than 65kB
            if (compressedFile.size>=(parseInt(props.config.compression as string|"32"))*1024) {
                compressionQuality-=.1
                console.log("QUALITY = ", compressionQuality, compressedFile.size, (parseInt(props.config.compression as string|"32"))*1024)
                continue;
            }


            isCompressed=true;
        }


        if (compressedFile==null) throw new Error();
        // Convert the compressed File to a base64 string
        const reader=new FileReader();
        reader.onloadend=() => {
            const base64=reader.result;


            // Emit the 'save' event with the base64-encoded image
            emit('save', base64);
        };
        reader.readAsDataURL(compressedFile);
        // } else {
        //     // Handle the case where the compressed image is still larger than 65kB
        //     console.error('The compressed image is still larger than 65kB:', compressedFile.size);
        // }

        // .catch((err) => {
        //     // Handle any errors that occur during compression
        //     console.error('Error compressing image:', err);
        // });
    }, "image/jpeg");
}







saveImage;
props.status;
props.isPrinting;
props.disabled;
props.color;
</script>

<style>
.cropper-crop-box,
.cropper-view-box {
    border-radius: 2px;
}

.cropper-crop-box {
    /* border-bottom: 10px solid white; */
    /* height: 300px!important;
width: 300px!important; */
    /* s 50%; */
}

img {
    display: block;

    /* This rule is very important, please don't ignore this */
    max-width: 100%;
}

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
<style scoped lang="scss">
.print-in-action {}

.print-in-action:hover {
    /* Start the shake animation and make the animation last for 0.5 seconds */
    animation: shake 0.5s;

    /* When the animation is finished, start again */
    animation-iteration-count: infinite;
}

@keyframes shake {
    0% {
        transform: translate(1px, 1px) rotate(0deg);
    }

    10% {
        transform: translate(-1px, -2px) rotate(-1deg);
    }

    20% {
        transform: translate(-3px, 0px) rotate(1deg);
    }

    30% {
        transform: translate(3px, 2px) rotate(0deg);
    }

    40% {
        transform: translate(1px, -1px) rotate(1deg);
    }

    50% {
        transform: translate(-1px, 2px) rotate(-1deg);
    }

    60% {
        transform: translate(-3px, 1px) rotate(0deg);
    }

    70% {
        transform: translate(3px, 1px) rotate(-1deg);
    }

    80% {
        transform: translate(-1px, -1px) rotate(1deg);
    }

    90% {
        transform: translate(1px, 2px) rotate(0deg);
    }

    100% {
        transform: translate(1px, -2px) rotate(-1deg);
    }
}

.color-button {
    height: 30px;
    width: 30px;
    border-radius: 50%;
    transition: all 150ms linear;
    // background-color: black
}


.active-button {
    transform: scale(1);
    border: 3px solid #ffbc00;
}

.inactive-button {
    transform: scale(.8);
    border: 3px solid #EAEAEA;
}

/* Ensure the size of the image fit the container perfectly */
img {
    display: block;

    /* This rule is very important, please don't ignore this */
    max-width: 100%;
}

.area {
    position: relative;
    padding-top: 90px;
}
</style>
