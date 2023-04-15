<template>
    <div v-on:dblclick="" class="d-flex flex-row align-center justify-center" style="height: 100%; width: 100%;">
        <div style="position: absolute; left: 50%; top: calc(50% - 200px); transform: translate(-50%, -50%);">
            <ConfettiExplosion v-if="showExplosion" :particleCount="50" :force="0.5" />
        </div>
        <PolaroidCropper :hasBluetoothAccess="hasBluetoothAccess" :printingCount="printingCount"
            v-on:count="emit('count', $event)" v-on:connect="connectPrinter()" :isConnected="isConnected"
            :aborting="aborting" class="image-creator" :status="printProgress" v-on:save="printImageEvent"
            v-on:cancelPrinting="cancelPrintingEvent()" :isPrinting="isPrinting" :color="color" :config="config" />
    </div>
</template>


<script setup lang="ts">
import ConfettiExplosion from "vue-confetti-explosion";
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
    confetti: boolean;

    hasBluetoothAccess: boolean,
    config: any
}>()

const showExplosion=ref(false)

watch(() => props.confetti, async () => {
    if (showExplosion.value==true) return;
    showExplosion.value=true;

    setTimeout(() => {
        showExplosion.value=false

    }, 3000);
})
watch(() => props.isConnected, async () => {
    await nextTick();

    console.log("SJJSJS")


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