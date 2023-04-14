<template>
    <div class="d-flex flex-row align-center justify-center" style="height: 100%; width: 100%;">
        <PolaroidCropper :printingCount="printingCount" v-on:count="emit('count', $event)" v-on:connect="connectPrinter()"
            :isConnected="isConnected" :aborting="aborting" class="image-creator" :status="printProgress"
            v-on:save="printImageEvent" v-on:cancelPrinting="cancelPrintingEvent()" :isPrinting="isPrinting" :color="color"
            :deviceStatus="status" />
    </div>
</template>


<script setup lang="ts">
import PolaroidCropper from '@/components/PolaroidCropper.vue';
import { nextTick } from 'vue';
import { watch, ref } from 'vue'
const emit=defineEmits(['print', 'cancel', 'connect', 'count']);
const props=defineProps<{
    isPrinting: boolean;
    isConnected: boolean;
    printingCount: number,
    printProgress: number
    color: string;
    aborting: boolean;
}>()

const status=ref({ ...JSON.parse(localStorage.getItem('instax-printer')||'{}') })

watch(() => props.isConnected, async () => {
    await nextTick();

    console.log("SJJSJS")
    status.value={ ...JSON.parse(localStorage.getItem('instax-printer')||'{}') }


})
function connectPrinter(): void {
    emit('connect')
}
function printImageEvent(imageUrl: string): void {
    emit('print', imageUrl)
}

function cancelPrintingEvent(): void {
    emit('cancel')
}


props.isConnected;
props.isPrinting;
props.printProgress;
props.aborting;
props.color;
</script>