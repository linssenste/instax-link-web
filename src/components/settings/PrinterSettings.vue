<template>
    <div>


        <v-menu v-model="settingsMenu" :disabled="!isConnected" eager :offset="-100" :close-on-content-click="false"
            transition="none">
            <template v-slot:activator="{ props }">

                <PrinterCard v-bind="props" :mini="mini" v-on:connect="connectPrinter()" :status="deviceStatus"
                    :isConnected="isConnected" :isPrinting="isPrinting" :loading="initialLoad" />
            </template>


            <PrinterSettingsCard v-on:close="settingsMenu=false" v-on:disconnect="disconnectPrinter()"
                :status="deviceStatus" :color="color" :isConnected="isConnected" :isPrinting="isPrinting" />
        </v-menu>
    </div>
</template>

<script setup lang="ts">
import { INSTAX_OPCODES } from '@/plugins/printer/events';
import { watch } from 'vue';
import { ref } from 'vue';
import PrinterCard from './PrinterCard.vue';
import PrinterSettingsCard from './PrinterSettingsCard.vue';


const props=defineProps<{
    isPrinting: boolean;
    printer: any;
    isConnected: boolean;
    mini: boolean;
    color: string;
}>();

const emit=defineEmits(['connect', 'ready'])

const initialLoad=ref(false)
const timeoutHandle: any=ref(null) // Ref<(ReturnType<typeof setTimeout>|null)

const errorCounter=ref(0)
const settingsMenu=ref(false);

const deviceStatus=ref({
    isCharging: false,
    serialNumber: '',
    batteryLevel: null,
    width: 800,
    height: 800,

    imagesLeft: 0
})

function disconnectPrinter(): void {
    props.printer.disconnect();
    if (timeoutHandle.value!=null) {
        clearInterval(timeoutHandle.value)
    }
}


function connectPrinter(): void {

    emit('connect');
    errorCounter.value=0;
}


watch(initialLoad, () => {
    emit('ready', initialLoad.value)
})


watch(() => props.isConnected, () => {


    errorCounter.value=0;

    if (props.isConnected==false) {
        initialLoad.value=false;
        informationGetter()
    }
    else {
        initialLoad.value=true;

        setTimeout(() => {
            informationGetter()
        }, 1000);

    }
})


watch(() => props.isPrinting, async () => {
    if (props.isConnected==false||props.isPrinting==true) informationGetter()
    else {
        await props.printer.setColor([[255, 0, 255], [255, 0, 255]], 1, 255, 0)

        setTimeout(() => {
            informationGetter()
        }, 1000);
    }



})




async function informationGetter(): Promise<void> {




    if (timeoutHandle.value!=null) {
        clearInterval(timeoutHandle.value)
    }

    if (props.isConnected==false||props.isPrinting) return;


    if (props.isConnected==true&&props.isPrinting==false) {
        await getDeviceInformation(true);
        timeoutHandle.value=setInterval(() => getDeviceInformation(), 2500);
    }

}


async function getDeviceInformation(loadAll=false): Promise<void> {

    if (props.isConnected==false||props.isPrinting) return;

    await new Promise((r) => setTimeout(r, 250))
    try {
        let response=null;

        if (loadAll==true) {
            await new Promise((r) => setTimeout(r, 250))
            response=await props.printer.sendCommand(INSTAX_OPCODES.SUPPORT_FUNCTION_INFO, [0]);
            deviceStatus.value.width=response.width|800;
            deviceStatus.value.height=response.height|800;

            localStorage.setItem('instax-printer', JSON.stringify(deviceStatus.value))
        }


        response=await props.printer.sendCommand(INSTAX_OPCODES.SUPPORT_FUNCTION_INFO, [1]);
        deviceStatus.value.isCharging=response.isCharging>5;
        deviceStatus.value.batteryLevel=(response.battery||deviceStatus.value.batteryLevel);

        await new Promise((r) => setTimeout(r, 250))
        response=await props.printer.sendCommand(INSTAX_OPCODES.SUPPORT_FUNCTION_INFO, [2]);
        deviceStatus.value.imagesLeft=response.photosLeft;


        if (loadAll==true) {

            await new Promise((r) => setTimeout(r, 250))
            response=await props.printer.sendCommand(INSTAX_OPCODES.DEVICE_INFO_SERVICE, [2]);
            deviceStatus.value.serialNumber=response.serialNumber;




            localStorage.setItem('instax-printer', JSON.stringify(deviceStatus.value))
        }


        initialLoad.value=false;

        errorCounter.value=0;



    } catch (error) {
        errorCounter.value+=1

        if (errorCounter.value>4) {
            // location.reload()
            disconnectPrinter();


        }
        console.log(errorCounter.value)
    }


}





</script>
