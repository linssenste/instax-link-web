<template>
    <div>
        <PolaroidEditor v-on:saveable="isSaveable=$event" v-on:save="savedImageEvent" :color="color" :config="config"
            :printerStatus="printerStatus" :save="togglePrinting" />
        <v-btn class="mt-6 font-weight-bold" variant="tonal" :color="color" block :disabled="!isSaveable"
            v-on:click="downloadImageRequest()">
            <v-icon class="mr-2">mdi-download</v-icon>
            donwload polaroid

        </v-btn>

        <v-btn v-if="printerStatus==1" class="mt-2 font-weight-bold" variant="flat" :color="color" block
            :disabled="!isSaveable" v-on:click="printImageRequest()">

            Print image
            <v-icon class="ml-2">mdi-chevron-right</v-icon>

        </v-btn>

        <v-btn v-else-if="printerStatus>1" :loading="printerStatus===4" class="mt-2 font-weight-bold" variant="flat"
            :color="color" block v-on:click="togglePrinting=!togglePrinting">

            <v-icon class="mr-2">mdi-close</v-icon>
            Cancel


        </v-btn>

    </div>
</template>

 
<script setup lang="ts">
import PolaroidEditor from '@/components/polaroid/PolaroidEditor.vue';
import { nextTick } from 'vue';
import { ref } from 'vue'


const togglePrinting=ref(false)
const isSaveable=ref(false)
const emit=defineEmits([]);

const exportStatus=ref(0)
const props=defineProps<{
    color: string,
    printerStatus: number,
    config: any,
    print: (imageUrl: string, numberImages: number, callback: (progress: any) => void, abortController: AbortController) => void
}>()

const numberPrints=ref(1)

const abortController=ref<AbortController|null>(null);

async function printImage(imageUrl: string): Promise<void> {
    abortController.value=null;


    await nextTick();

    abortController.value=new AbortController();
    console.log(abortController.value)
    props.print(imageUrl, numberPrints.value, (progress: any) => {
        console.log("PROGR", progress)
    }, abortController.value)
}


function savedImageEvent(imageUrl: string): void {
    console.log("PRONT", imageUrl)

    if (exportStatus.value==0) {
        console.log("DOWNLOADING...")
    } else {
        console.log("PRINTING....")
        printImage(imageUrl)
    }

    exportStatus.value=0;

}

function downloadImageRequest(): void {
    exportStatus.value=0;
    togglePrinting.value=!togglePrinting.value

}
function printImageRequest(): void {
    exportStatus.value=1;
    togglePrinting.value=!togglePrinting.value
}

props.color;
props.printerStatus;
props.config;
</script>