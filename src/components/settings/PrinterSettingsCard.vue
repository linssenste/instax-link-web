<template>
    <div class="menu-content bg-white rounded-xl elevation-5 mt-0 pa-4">
        <div class="menu-header font-weight-bold text-uppercase d-flex flex-row align-center">
            <span v-if="status.width==600">Instax Mini Link</span>
            <span v-else-if="status.width==800">Instax Square Link</span>
            <span v-else-if="status.width==1260">Instax Wide Link</span>
            <span v-else>Instax Printer</span>
            <v-spacer />
            <v-btn :ripple="false" icon variant="tonal" color="#505050" density="compact" v-on:click="closeMenu()">
                <v-icon size="x-small">mdi-close</v-icon>
            </v-btn>
        </div>
        <div class="ma-0 mt-4 d-flex flex-row align-start ml-4">
            <a v-if="status.width==600" href="https://instax.com/mini_link_2/en/" target="_blank"><img class="product-image"
                    width="60" src="@/assets/cameras/mini.webp" data-testid="product-image-connected" /></a>

            <a v-if="status.width==800" href="https://instax.com/square_link/en/" target="_blank"><img
                    v-if="status.width==800" class="product-image" width="80" src="@/assets/cameras/square.webp"
                    data-testid="product-image-connected" /></a>

            <a v-if="status.width==1260" href="https://instax.com/link_wide/en/" target="_blank"><img class="product-image"
                    width="90" src="@/assets/cameras/wide.webp" data-testid="product-image-connected" /></a>

            <div class="ml-8">

                <BatteryStatus class="mt-2" :status="status" />
                <ImagesLeft class="mt-2 mb-6" :isPrinting="isPrinting" :status="status" />

                <span class=" text-grey-darken-1 text-uppercase" style="font-size: 14px;">S.N.: </span>
                <span class="ml-2 text-uppercase font-weight-bold"
                    style="letter-spacing: .8px; font-family: monospace; user-select: all;">{{status.serialNumber}}</span>

            </div>
        </div>
        <!-- <v-divider class="mt-6 mb-4"></v-divider> -->


        <v-btn :disabled="isPrinting" v-on:click="openPrinterSupport()" color="primary" variant="tonal" rounded="pill"
            :ripple="false" class="mt-6 font-weight-bold" block><v-icon class="mr-2">mdi-help-circle</v-icon>FAQ</v-btn>

        <v-btn :disabled="isPrinting" v-on:click="disconnectPrinter()" :color="color" variant="tonal" rounded="pill"
            :ripple="false" class="mt-6 font-weight-bold" block><v-icon
                class="mr-2">mdi-bluetooth-off</v-icon>Disconnect</v-btn>


    </div>
</template>


<script setup lang="ts">
import ImagesLeft from './ImagesLeft.vue';
import BatteryStatus from './BatteryStatus.vue';
import { ref, watch } from 'vue';
import { onMounted } from 'vue';

const props=defineProps<{
    isPrinting: boolean;
    isConnected: boolean;
    status: any
    color: string;
}>();


const emit=defineEmits(['disconnect', 'close'])

function disconnectPrinter(): void {
    emit('disconnect')
}

function closeMenu(): void {
    emit('close')
}


function openPrinterSupport(): void {

    switch (props.status.width) {
        case 600:
            window.open('https://instax.com/mini_link/en/support/faq/', '_blank');
            break;
        case 800:
            window.open('https://instax.com/square_link/en/support/faq/', '_blank');
            break;
        case 1260:
            window.open('https://instax.com/link_wide/en/support/faq/', '_blank');
            break;
        default: break;

    }


}

props.isPrinting;

props.status;
</script>



<style scoped>
.menu-header {
    letter-spacing: 1px;
    font-size: 17px;
}

.product-image {
    transition: all 100ms ease-in;
}

.product-image:hover {
    transform: scale(1.05);
    transition: all 100ms ease-in;
}
</style>
