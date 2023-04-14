<template>
    <div v-if="mini">
        <v-btn color="white" variant="tonal" icon :ripple="false">
            <v-icon v-if="isConnected" color="blue-darken-2">mdi-bluetooth</v-icon>
            <v-icon v-if="!isConnected" color="black">mdi-bluetooth-off</v-icon>
        </v-btn>
    </div>
    <div v-else class="activator rounded-xl d-flex flex-row align-center justify-start pl-0" color="primary">

        <img v-if="isConnected&&!loading&&status.width==600" class="product-image ml-6 mr-4 mt-2" width="50"
            src="@/assets/cameras/mini.webp" data-testid="product-image-connected" />

        <img v-else-if="isConnected&&!loading&&status.width==800" class="product-image ml-6 mr-4 mt-2" width="60"
            src="@/assets/cameras/square.webp" data-testid="product-image-connected" />

        <img v-else-if="isConnected&&!loading&&status.width==1260" class="product-image ml-6 mr-4 mt-2" width="72"
            src="@/assets/cameras/wide.webp" data-testid="product-image-connected" />


        <img v-else class="product-image ml-3 mr-3 mt-1" width="90"
            src="https://www.instaxus.com/wp-content/uploads/2022/11/220809-Instax-Square-Link-360_1000px.gif"
            data-testid="product-image-disconnected" />

        <div v-if="isConnected&&!loading" class="pl-4">
            <div class="title text-uppercase font-weight-bold">
                <span v-if="status.width==600">Instax Mini Link</span>
                <span v-else-if="status.width==800">Instax Square Link</span>
                <span v-else-if="status.width==1260">Instax Wide Link</span>
                <span v-else>Instax Printer</span>
            </div>

            <div class="d-flex flex-row align-center mt-1">
                <ImagesLeft :isPrinting="isPrinting" :status="status" data-testid="images-left" />
                <BatteryStatus class="ml-6" :status="status" data-testid="battery-status" />
            </div>
        </div>

        <div v-else>
            <v-btn :loading="loading" v-on:click="connectPrinter()" :ripple="false" variant="tonal" color="primary"
                class="rounded-pill pl-6 pr-6 font-weight-bold" data-testid="connect-button">
                <v-icon class="mr-2">mdi-bluetooth-connect</v-icon>Connect printer
            </v-btn>
        </div>

    </div>
</template>


<script setup lang="ts">
import ImagesLeft from './ImagesLeft.vue';
import BatteryStatus from './BatteryStatus.vue';

const props=defineProps<{
    isConnected: boolean;
    isPrinting: boolean;
    loading: boolean;
    status: any,
    mini: boolean
}>();

const emit=defineEmits(['connect'])

function connectPrinter(): void {
    emit('connect')
}

props.isConnected;
props.isPrinting;
props.loading;
props.status;
</script>


<style scoped>
.activator {
    width: 100%;
    height: 100px;
    min-width: 370px;
    background-color: #FFFFFFCC;
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
