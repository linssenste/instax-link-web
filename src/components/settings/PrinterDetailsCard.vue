<template>
    <div class="menu-content bg-white rounded-lg elevation-5 mt-0 pa-4" data-testid="menu-content">
        <div class="menu-header font-weight-bold text-uppercase d-flex flex-row align-center">
            <span v-if="status.width==600" data-testid="mini-link">Instax Mini Link</span>
            <span v-else-if="status.width==800" data-testid="square-link">Instax Square Link</span>
            <span v-else-if="status.width==1260" data-testid="wide-link">Instax Wide Link</span>
            <span v-else>Instax Printer</span>
            <v-spacer />
            <v-btn :ripple="false" icon variant="tonal" color="#505050" density="compact" v-on:click="closeMenu()"
                data-testid="close-button">
                <v-icon size="x-small">mdi-close</v-icon>
            </v-btn>
        </div>
        <div class="ma-0 mt-4 d-flex flex-row align-start ml-4">
            <a v-if="status.width==600" href="https://instax.com/mini_link_2/en/" target="_blank"
                data-testid="product-link">
                <img class="product-image" width="60" src="@/assets/cameras/mini.webp" data-testid="mini-image" />
            </a>
            <a v-if="status.width==800" href="https://instax.com/square_link/en/" target="_blank"
                data-testid="product-link">
                <img class="product-image" width="80" src="@/assets/cameras/square.webp" data-testid="square-image" />
            </a>
            <a v-if="status.width==1260" href="https://instax.com/link_wide/en/" target="_blank" data-testid="product-link">
                <img class="product-image" width="90" src="@/assets/cameras/wide.webp" data-testid="wide-image" />
            </a>
            <div class="ml-8">
                <ImagesLeft class="mt-2" :printerStatus="printerStatus" :status="status" />
                <BatteryStatus class="mt-3 mb-2" :status="status" />
                <PrinterStatusText data-testid="printer-status" class="mb-4 ml-1" :printerStatus="printerStatus"
                    :color="color" />
                <span class="text-grey-darken-1 text-uppercase" style="font-size: 14px;">S.N.: </span>
                <span class="ml-2 text-uppercase font-weight-bold" data-testid="serial-number"
                    style="letter-spacing: .8px; font-family: monospace; user-select: all;">{{status.serialNumber||
                        '-'}}</span>
            </div>
        </div>
        <v-btn :disabled="printerStatus==2||printerStatus==3" v-on:click="disconnectPrinter()" :color="color"
            variant="tonal" rounded="lg" :ripple="false" class="mt-8 font-weight-bold" block
            data-testid="disconnect-button">
            <v-icon class="mr-2">mdi-bluetooth-off</v-icon>Disconnect
        </v-btn>
    </div>
</template>

<script setup lang="ts">
import ImagesLeft from './ImagesLeft.vue';
import BatteryStatus from './BatteryStatus.vue';
import PrinterStatusText from './PrinterStatusText.vue';

const props=defineProps<{
    status: any
    color: string;
    printerStatus: number
}>();

const emit=defineEmits(['disconnect', 'close'])

function disconnectPrinter(): void {
    emit('disconnect')
}

function closeMenu(): void {
    emit('close')
}

props.printerStatus;

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

.menu-content {
    width: 350px
}
</style>
