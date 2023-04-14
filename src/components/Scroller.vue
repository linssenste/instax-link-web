<template>
    <div>

        <v-btn style="position: absolute; top: 5px; left: 50px" variant="solo" v-on:click="connectPrinter">Drucker
            verbinden</v-btn>

        <div id="area" class="d-flex flex-column  align-center  justify-center  printer-dashboard">


            <PolaroidCropper v-on:save="savedImage" />

            <div v-if="isConnected" style="position: relative; width: 100%;">

                <v-btn v-on:click="disconnect">disconnect</v-btn>

                <v-btn v-if="isPrinting" v-on:click="stopPrinting">Drucken abbrechen</v-btn>


                <v-btn v-on:click="write">Write</v-btn>
            </div>
        </div>
    </div>
</template>


<script setup lang="ts">
/// <reference types="web-bluetooth" />

import { ref, watch, nextTick } from 'vue';
import { InstaxPrinter } from '@/plugins/printer/instax'
import { INSTAX_EVENT } from '@/plugins/printer/events'

import PolaroidCropper from './PolaroidCropper.vue'


let isConnected=ref(false)

const polaroidCrop=ref(null);
let isPrinting=ref(false)
let printerStatus=ref(null);
let printer: any=null;
function handleDisconnect(): void {

    isConnected.value=false;


}




const printerMeta=ref({})
function disconnect(): void {

    if (printer==null) return;
    printer.disconnect()
}


function stopPrinting(): void {
    console.log("STOP")
}
async function connectPrinter(): Promise<void> {

    try {
        printer=new InstaxPrinter();

        const device=await printer.connect();
        // console.log("de", device)


        await printer.information()

        // const interval = setInterval(async () => {
        //     if (isConnected.value == false) clearInterval(interval)
        //     await printer.information()
        // }, 2500)
        device.addEventListener('gattserverdisconnected', handleDisconnect);

        isConnected.value=true

        await nextTick();

        // printer.notifications(event => {
        //     console.log("NOTIFICATION",event)
        //     if (event.data != null && Object.keys(event.data).length > 0) printerMeta.value = {...printerMeta.value, ...event.data}
        //     // console.log("YES: ", event.data)
        // })
    } catch (error) {
        isConnected.value=false;
    }

}



function savedImage(image: string): void {
    console.log('SAVE', image)
    isPrinting.value=true
    printer.sendImage(image)
}


function write(): void {

    const value=new Uint8Array(printer._encode({ opcode: INSTAX_EVENT.LED_PATTERN_SETTINGS, payload: Array.from(printer.color([[255, 0, 0], [255, 8, 0], [255, 16, 0], [255, 25, 0], [255, 33, 0], [255, 41, 0], [255, 49, 0], [255, 58, 0], [255, 0, 0], [255, 8, 0], [255, 16, 0], [255, 25, 0], [255, 33, 0], [255, 41, 0], [255, 49, 0], [255, 58, 0], [255, 0, 0], [255, 8, 0], [255, 16, 0], [255, 25, 0], [255, 33, 0], [255, 41, 0], [255, 49, 0], [255, 58, 0], [255, 0, 0], [255, 8, 0], [255, 16, 0], [255, 25, 0], [255, 33, 0], [255, 41, 0], [255, 49, 0], [255, 58, 0], [255, 0, 0], [255, 8, 0], [255, 16, 0], [255, 25, 0], [255, 33, 0], [255, 41, 0], [255, 49, 0], [255, 58, 0], [255, 0, 0], [255, 8, 0], [255, 16, 0], [255, 25, 0], [255, 33, 0], [255, 41, 0], [255, 49, 0], [255, 58, 0], [255, 0, 0], [255, 8, 0], [255, 16, 0], [255, 25, 0], [255, 33, 0], [255, 41, 0], [255, 49, 0], [255, 58, 0], [255, 0, 0], [255, 8, 0], [255, 16, 0], [255, 25, 0], [255, 33, 0], [255, 41, 0], [255, 49, 0], [0, 0, 255]], 20, 1, 0)) }));
    // const value=new Uint8Array(encodeEvent({ opcode: INSTAX_EVENT.SUPPORT_FUNCTION_INFO, payload: [2]}));


    printer.sendPackets([value])
    // printer.sendImage([])
    // printer.sendCommand(INSTAX_EVENT.SUPPORT_FUNCTION_INFO, [2]);


    //    3 32 3 32 2 11 0 6 64 0 0; 800 800 523 6 16384
    // 0: 3 32 3 32 2 0 0 6 64 0 0; 800 800 512 6 16384

    //    11 95 9 5 0 0 0 0 0 0 0 ; 3 95 0 0 0 0 0 0 0 0 0
    // 1: 11 95 9 5 0 0 0 0 0 0 0


    //    147 21 0 --> + 1
    //    146 21 0 --> changed input
    //    146 20 0
    // 3: 145 20 0

    //    - 1   185 0 0 12 0 0 0 0 0 0 0;         57 0 0 12 0 0 0 0 0 0 0;
    //    + 10  186 0 0 12 0 0 0 0 0 0 0          58 0 0 12 0 0 0 0 0 0 0;
    //          176 0 0 12 0 0 0 0 0 0 0;         48 0 0 12 0 0 0 0 0 0 0
    // 2:  cha: 177 0 0 12 0 0 0 0 0 0 0; no cha: 49 0 0 12 0 0 0 0 0 0 0


    // printer.sendCommand(INSTAX_EVENT.SUPPORT_FUNCTION_INFO, [1]);

    // printer.sendCommand(INSTAX_EVENT.SUPPORT_FUNCTION_INFO, [2]);

    // printer.sendCommand(INSTAX_EVENT.SUPPORT_FUNCTION_INFO, [3]);
    // printer.sendCommand(INSTAX_EVENT.LED_PATTERN_SETTINGS, printer.color([[0, 188, 255], [0, 0, 0]], 15, 2, 0))
}





</script>
<style scoped>
.printer-dashboard {
    height: 100vh;
    width: 100vw;
    overflow: hidden;
    background-color: yellow;
    transition: background-color 200ms linear;
}
</style>