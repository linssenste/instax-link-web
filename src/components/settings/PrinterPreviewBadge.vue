<template>
    <div v-if="printerStatus<1">
        <v-btn :loading="printerStatus===0" v-on:click="connectPrinter()" color="blue-darken-2" variant="tonal" icon
            :ripple="false" data-testid="connect-button">
            <v-icon color="blue-darken-2">mdi-bluetooth</v-icon>
        </v-btn>
    </div>
    <div v-else class="activator rounded-lg   pl-0" color="primary">

        <div class="pl-4" style="position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); width: 100%; ">

            <div class="title text-uppercase " style="width: 100%">
                <span class="text-grey-darken-1 mr-1">DEVICE: </span>
                <span v-if="status.width==600" class="font-weight-bold">Instax Mini Link</span>
                <span v-else-if="status.width==800" class="font-weight-bold">Instax Square Link</span>
                <span v-else-if="status.width==1260" class="font-weight-bold">Instax Wide Link</span>
                <span v-else class="font-weight-bold">Unknown Printer</span>
            </div>

            <div class="d-flex flex-row align-center mt-1">
                <PrinterStatusText data-testid="printer-status" class="ml-1" :printerStatus="printerStatus"
                    :color="color" />
                <ImagesLeft :status="status" data-testid="images-left" />
                <BatteryStatus class="ml-6" :status="status" data-testid="battery-status" />
            </div>
        </div>


    </div>
</template>


<script setup lang="ts">
import ImagesLeft from './ImagesLeft.vue';
import BatteryStatus from './BatteryStatus.vue';
import PrinterStatusText from './PrinterStatusText.vue';

const props=defineProps<{
    status: any,
    printerStatus: number,
    color: string
}>();

const emit=defineEmits(['connect'])

function connectPrinter(): void {
    emit('connect')
}

props.status;
props.printerStatus;
</script>


<style scoped>
.activator {
    position: relative;
    width: 330px;
    height: 80px;
    background-color: #FFFFFF99;
    transition: all 200ms linear;
    cursor: pointer;
}

.activator:hover {

    background-color: #FFFFFFFF;
    transition: all 200ms linear;
}

.title {
    color: black !important;
    letter-spacing: 0.8px;
    margin-left: 2px
}

.product-image {
    transition: all 100ms ease-in;
}

.product-image:hover {
    transform: scale(1.05);
    transition: all 100ms ease-in;
}
</style>
