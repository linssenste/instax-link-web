<template>
    <div>
        <div v-if="!hasBluetoothAccess" class="pr-3 no-bluetooth-access" data-testid="no-bluetooth-access">
            <div class="text-uppercase text-red font-weight-bold d-flex flex-row align-center">
                <v-icon color="red" class="mr-2" size="small">mdi-bluetooth-off</v-icon>NO
                Bluetooth access
            </div>
            <a data-testid="no-bluetooth-access-help"
                href="https://developer.mozilla.org/en-US/docs/Web/API/Web_Bluetooth_API#browser_compatibility"
                target="_blank" class="text-grey-darken-1 ml-7 api-browser-support">
                API Browser Support</a>
        </div>
        <v-menu v-else v-model="settingsMenu" :disabled="printerStatus===-1" eager :offset="-100"
            :close-on-content-click="false" transition="fade-transition">
            <template v-slot:activator="{ props }">
                <PrinterPreviewBadge :color="color" v-bind="props" v-on:connect="connectPrinter()" :status="deviceStatus"
                    :printerStatus="printerStatus" :loading="initialLoad" />
            </template>
            <PrinterDetailsCard v-on:close="settingsMenu=false" v-on:disconnect="disconnectPrinter()" :status="deviceStatus"
                :color="color" :printerStatus="printerStatus" />
        </v-menu>
    </div>
</template>

<script setup lang="ts">
import { INSTAX_OPCODES } from '@/plugins/printer/events';
import { watch } from 'vue';
import { ref } from 'vue';
import PrinterPreviewBadge from './PrinterPreviewBadge.vue';
import PrinterDetailsCard from './PrinterDetailsCard.vue';
import { nextTick } from 'vue';


const props=defineProps<{
    printerStatus: number,
    printer: any;
    color: string;
    hasBluetoothAccess: Boolean
}>();

const emit=defineEmits(['connect', 'ready', 'update'])

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
    settingsMenu.value=false;
    if (timeoutHandle.value!=null) {
        clearInterval(timeoutHandle.value)
    }

    if (props.printer!=null) props.printer.disconnect();

}


function connectPrinter(): void {

    if (props.hasBluetoothAccess==true) emit('connect');
    errorCounter.value=0;
}




watch(() => props.printerStatus, () => {

    errorCounter.value=0;

    if (props.printerStatus==-1) {
        initialLoad.value=false;
        informationGetter();
        emit('update', { width: deviceStatus.value.width, height: deviceStatus.value.height })
    }
    else {
        initialLoad.value=true;

        setTimeout(() => {
            informationGetter()
        }, 500);

    }
})




async function informationGetter(): Promise<void> {


    if (timeoutHandle.value!=null) {
        clearInterval(timeoutHandle.value)
        await nextTick();
        timeoutHandle.value=null;
    }

    if (!(props.printerStatus===-1||(props.printerStatus==2||props.printerStatus==3||props.printerStatus==4))) {

        await getDeviceInformation(true);
        timeoutHandle.value=setInterval(() => getDeviceInformation(), 2500);
    }

}


async function getDeviceInformation(loadAll=false): Promise<void> {

    if (timeoutHandle.value==null||props.printerStatus===-1||(props.printerStatus==2||props.printerStatus==3||props.printerStatus==4)) return;

    try {
        let response=null;


        response=await props.printer.sendCommand(INSTAX_OPCODES.SUPPORT_FUNCTION_INFO, [0]);
        deviceStatus.value.width=parseInt(String(response.width!=600&&response.width!=800&&response.width!=1240? 800:response.width));
        deviceStatus.value.height=parseInt(String(response.height!=800&&response.height!=840? 800:response.height));

        console.log("WIDTH:", response)
        localStorage.setItem('instax-printer', JSON.stringify(deviceStatus.value))



        response=await props.printer.sendCommand(INSTAX_OPCODES.SUPPORT_FUNCTION_INFO, [1]);
        deviceStatus.value.isCharging=response.isCharging>5;
        deviceStatus.value.batteryLevel=(response.battery||deviceStatus.value.batteryLevel);

        response=await props.printer.sendCommand(INSTAX_OPCODES.SUPPORT_FUNCTION_INFO, [2]);
        deviceStatus.value.imagesLeft=response.photosLeft;


        response=await props.printer.sendCommand(INSTAX_OPCODES.DEVICE_INFO_SERVICE, [2]);
        deviceStatus.value.serialNumber=response.serialNumber;







        localStorage.setItem('instax-printer', JSON.stringify(deviceStatus.value))


        emit('update', deviceStatus.value)
        await nextTick();

        if (initialLoad.value===true) {

            emit('ready')

            initialLoad.value=false;
        }

        errorCounter.value=0;





    } catch (error) {

        if (loadAll==true&&errorCounter.value==0) getDeviceInformation(true)

        errorCounter.value+=1

        if (errorCounter.value>4) {
            // location.reload()
            disconnectPrinter();
        }

    }


}





</script>

<style scoped>
.no-bluetooth-access {
    margin-top: 10px;
    letter-spacing: 1px;
    font-size: 15px;
}

.api-browser-support {
    font-size: 14px;
}
</style>