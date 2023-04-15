<template>
    <div>
        <PolaroidEditor v-on:saveable="isSaveable=$event" v-on:save="printImage" :color="color" :config="config"
            :printerStatus="printerStatus" :save="togglePrinting" />
        <v-btn :disabled="!isSaveable" v-on:click="togglePrinting=!togglePrinting">SAVE</v-btn>
    </div>
</template>

 
<script setup lang="ts">
import PolaroidEditor from '@/components/polaroid/PolaroidEditor.vue';
import { ref } from 'vue'


const togglePrinting=ref(false)
const isSaveable=ref(false)
const emit=defineEmits([]);


function printImage(imageUrl: string): void {
    console.log("PRONT", imageUrl)

}
const props=defineProps<{
    color: string,
    printerStatus: number,
    config: any,
    print: (imageUrl: string, numberImages: number, callback: (progress: any) => void, abortController: AbortController) => void
}>()

props.color;
props.printerStatus;
props.config;
</script>