<template>
    <div oncontextmenu="return false" class="app-area" id="app-area" data-testid="app-area">
        <PolaroidSizeSelector class="polaroid-selector" :color="themeColor" :isConnected="printerStatus>=1" :config="config"
            v-on:resize="resizePolaroidEvent($event)" data-testid="polaroid-size-selector" />

        <ThemeColorSelector class="theme-color-selector" v-on:color-change="changedThemeColor($event)"
            data-testid="theme-color-selector" />

        <PrinterSettings v-on:ready="printerStatus=1" class="printer-connector" :hasBluetoothAccess="hasBluetoothAccess"
            v-on:update="config=$event" :color="themeColor" style="z-index: 100" v-on:connect="connectPrinter()"
            :printer="printer" :printerStatus="printerStatus" data-testid="printer-settings" />

        <div class="app-content">
            <slot name="default" :color="themeColor" :printerStatus="printerStatus" :print="print" :config="config" />
        </div>
    </div>
</template>



<script setup lang="ts">
import { ref, watch, onMounted } from 'vue'
import PolaroidSizeSelector from '@/components/layout/PolaroidSizeSelector.vue';
import ThemeColorSelector from '@/components/layout/ThemeColorSelector.vue'
import PrinterSettings from '@/components/settings/PrinterSettings.vue';
import { InstaxPrinter } from '@/plugins/printer/instax';
import { nextTick } from 'vue';

interface PRINTER_CONFIG {
    width: number,
    height: number
}


const config=ref<PRINTER_CONFIG>({
    width: 800,
    height: 800
})

watch(config, () => {
    emit('config-update', config)
}, { deep: true })

const emit=defineEmits(['config-update', 'color-update'])

const hasBluetoothAccess=ref<boolean>(false)
onMounted(() => {
    hasBluetoothAccess.value=!!('bluetooth' in navigator);
})

// export interface PRINT_PROGRESS {
//     status: number;
//     printed: number;
//     transfered: number;
// }
async function print(imageUrl: string, numberImages: any, callback: (progress: any) => void, abortController: AbortController): Promise<void> {


    await nextTick();

    let abortedPrinting=false;

    printerStatus.value=2; // STATUS SENDING DATA

    abortController.signal.addEventListener('abort', () => {

        abortedPrinting=true;
        if (printerStatus.value===2) {
            setTimeout(() => {
                printerStatus.value=1; // STATUS ABORTING

            }, 2000);
        }

        printerStatus.value=4; // STATUS ABORTING

    })

    await new Promise((r) => setTimeout(r, 1000))


    await printer.value.sendImage(imageUrl, true, async (status: number) => {

        callback({ status: printerStatus.value, printed: 0, transfered: status })

    }, abortController.signal);



    if (abortedPrinting==false) {

        printerStatus.value=3; // STATUS PRINTING
        await nextTick();

        const totalPrints=Math.round(numberImages.value);
        callback({ status: printerStatus.value, printed: 0, total: totalPrints, transfered: 100 })

        await printer.value.printImage(totalPrints, (imageId: any) => {
            // if (printingCount.value>=1) toggleConfetti.value=!toggleConfetti.value;

            callback({ status: printerStatus.value, ...imageId, transfered: 100 })

            if (abortedPrinting===true) {
                printerStatus.value=1;
                return;
            }
        }, abortController.signal)


        await new Promise((r) => setTimeout(r, 500))
        await nextTick();
        printerStatus.value=1; // STATUS ABORTING

    }







}

const themeColor=ref<string>('pink');
watch(themeColor, () => {

    emit('color-update', themeColor.value)
}, { immediate: true })

const printer=ref<any>(null);
const printerStatus=ref<number>(-1);

async function connectPrinter(): Promise<void> {

    try {

        printer.value=new InstaxPrinter();
        const device=await printer.value.connect();

        printerStatus.value=0

        device.addEventListener('gattserverdisconnected', () => {

            printerStatus.value=-1;
            printer.value=null;

        });

    } catch (error) {
        printerStatus.value=-1;
        printer.value=null;
    }

}
function changedThemeColor(color: string): void {
    const doc=document.getElementById('app-area');

    if (doc!=null) {
        doc.classList.remove(`bg-${themeColor.value}-lighten-5`)
        doc.classList.add(`bg-${color}-lighten-5`)
        themeColor.value=color
    }

}

// handle resize event from polaroid selector (forwarding)
function resizePolaroidEvent(targetSize: PRINTER_CONFIG): void {
    emit('config-update', { ...config.value, width: targetSize.width, height: targetSize.height })
}

</script>


<style scoped>
.app-area {
    position: fixed;
    height: 100%;
    width: 100%;
    overflow: hidden;
    overflow-x: hidden !important;
    overflow-y: hidden !important;

    cursor: default !important;
    user-select: none;
    -webkit-user-select: none;

    transition: background-color 200ms linear;
}


.app-content {
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);

}


.printer-connector {
    position: fixed;
    top: 15px;
    right: 15px
}

.polaroid-selector {
    position: fixed;
    top: 22px;
    left: 15px
}


.theme-color-selector {
    position: fixed;
    bottom: 15px;
    left: 15px
}
</style>