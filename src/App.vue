<template>
    <v-app theme="myCustomLightTheme">
        <v-main class="creator-area" id="dashboard-area">


            <printer-settings :color="currentColor" style="z-index: 100" :mini="route.name!=='instax-creator'"
                v-on:ready="validatedConnectionEstablished=!$event" v-on:connect="connectPrinter" :deviceId="deviceId"
                class="settings" :isConnected="isConnected" :printer="printer" :isPrinting="isPrinting" />


            <div style="position: relative; width: 100%; height: 100%; ">
                <router-view v-on:count="printImageCount=$event" v-on:connect="connectPrinter" v-on:print="saveImage"
                    v-on:cancel="cancelPrinting" style="z-index: 50" :color="currentColor"
                    :isConnected="isConnected&&validatedConnectionEstablished" :isPrinting="isPrinting"
                    :aborting="abortedPrinting" :printProgress="printStatus" :printingCount="printingCount" />


            </div>




            <PageBackgroundSelector style="z-index: 100" class="color-selector" v-on:change="changedBackground($event)" />


            <PageLegalLinks style="z-index: 100" class="legal-links" />
        </v-main>

    </v-app>
</template>

<script setup lang="ts">
import PrinterSettings from '@/components/settings/PrinterSettings.vue';
import PageBackgroundSelector from '@/components/legal/PageBackgroundSelector.vue'
import PageLegalLinks from '@/components/legal/PageLegalLinks.vue'

import { ref } from 'vue';
import { InstaxPrinter } from './plugins/printer/instax';
import { nextTick } from 'vue';
import { useRoute } from 'vue-router';

const printer=ref<any>(null);

const route=useRoute();
const isConnected=ref<boolean>(false);
const validatedConnectionEstablished=ref(false)

const isPrinting=ref(false);
const printStatus=ref(0);

const abortedPrinting=ref(false);
const abortController=ref<AbortController|null>(null);


const deviceId=ref<string|null>(null)

const currentColor=ref('white')

const printImageCount=ref(1)
const printingCount=ref(0)
function changedBackground(color: string): void {
    const doc=document.getElementById('dashboard-area');

    if (doc!=null) {
        doc.classList.remove(`bg-${currentColor.value}-lighten-5`)
        doc.classList.add(`bg-${color}-lighten-5`)
        currentColor.value=color
    }

}



async function cancelPrinting(): Promise<void> {

    if (abortController.value) {
        abortedPrinting.value=true;


        abortController.value.abort();



    }
}



async function saveImage(imageUrl: string): Promise<void> {


    isPrinting.value=true;
    printStatus.value=0;

    abortController.value=null;


    await nextTick();

    abortController.value=new AbortController();




    try {

        await new Promise((r) => setTimeout(r, 500))

        await printer.value.sendImage(imageUrl, true, async (status: number) => {

            printStatus.value=status;

            if (status==-1) {

                await nextTick();
                setTimeout(() => {
                    abortedPrinting.value=false;
                    isPrinting.value=false;
                }, 250);

            }
        }, abortController.value.signal);



        if (abortedPrinting.value==false) {
            await printer.value.printImage(printImageCount.value, (imageId: number) => {
                console.log("IMAGE", imageId);
                printingCount.value=imageId+1;
            }, abortController.value.signal)
        }

        await new Promise((r) => setTimeout(r, 500))
        isPrinting.value=false;
        printImageCount.value=1;
        printingCount.value=0;

        abortedPrinting.value=false;
    } catch (err: any) {
        if (err!=null&&err.name==='AbortError') {
            console.log('Printing has been cancelled');
        } else {
            throw err;
        }
    } finally {
        abortController.value=null;
        isPrinting.value=false;
    }
}

async function connectPrinter(): Promise<void> {

    try {
        printer.value=new InstaxPrinter();

        const device=await printer.value.connect();

        if (device!=null) {

            isConnected.value=true
            deviceId.value=device.id

        }

        device.addEventListener('gattserverdisconnected', () => {

            isConnected.value=false;
            deviceId.value=null;
            printer.value=null
        });


    } catch (error) {
        isConnected.value=false;
    }

}





</script>

<style scoped>
.creator-area {
    position: fixed;
    height: 100%;
    width: 100%;
    user-select: none;
    overflow: hidden;
    -webkit-user-select: none;
}

.settings {
    position: absolute;
    top: 20px;
    right: 20px;
}


.image-creator {
    position: absolute;
    bottom: 100px;
}

.color-selector {
    position: absolute;
    bottom: 15px;
    right: 25px
}


.legal-links {
    position: absolute;
    bottom: 15px;
    left: 20px
}
</style>


<style>
@import url('https://fonts.googleapis.com/css?family=Inter');

html,
body {
    overflow: hidden !important;
    font-family: 'Inter', sans-serif;
}
</style>


<style lang="scss">
/* For Webkit, Blink, and Edge browsers */
::-webkit-scrollbar {
    width: 11px;
    padding-right: 2px !important;
    height: 14px;
    background-color: transparent;
}

::-webkit-scrollbar-track {

    margin-top: 2px;
    margin-bottom: 2px;
    margin-right: 5px !important;
    background-color: transparent;
}

::-webkit-scrollbar-thumb {
    background: #c0c0c0;
    margin-top: 10px;
    border-radius: 10px;
    border: 1px solid #FFFFFF;
}

::-webkit-scrollbar-thumb:hover {
    background: #a0a0a0;
}

/* For Mozilla Firefox */
* {

    margin-right: 5px;
    scrollbar-width: thin;
    scrollbar-color: #c0c0c0 transparent;
}

.hide-scrollbar {
    overflow-y: scroll;
    -ms-overflow-style: none !important;
    /* IE and Edge */
    scrollbar-width: none !important;
    /* Firefox */
}

.hide-scrollbar::-webkit-scrollbar {
    display: none !important;
}

/* Custom scrollbar styles for Internet Explorer are not supported */
</style>