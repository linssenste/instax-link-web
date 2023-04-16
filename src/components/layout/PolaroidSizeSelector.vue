<template>
    <div class="d-flex flex-row align-center">

        <!-- Polaroid 600 -->
        <div :class="polaroidClass(600)" v-on:click="selectedWidth=600" data-testid="polaroid-600">
            <div class="inner-polaroid">
                <v-icon v-if="showBluetoothIcon(600)" class="icon-position" color="grey-darken-1" size="13">
                    mdi-bluetooth
                </v-icon>
            </div>
        </div>

        <!-- Polaroid 800 -->
        <div :class="polaroidClass(800)" v-on:click="selectedWidth=800" data-testid="polaroid-800">
            <div class="inner-polaroid">
                <v-icon v-if="showBluetoothIcon(800)" class="icon-position" color="grey-darken-1" size="13">
                    mdi-bluetooth
                </v-icon>
            </div>
        </div>

        <!-- Polaroid 1260 -->
        <div :class="polaroidClass(1260)" v-on:click="selectedWidth=1260" data-testid="polaroid-1260">
            <div class="inner-polaroid">
                <v-icon v-if="showBluetoothIcon(1260)" class="icon-position" color="grey-darken-1" size="13">
                    mdi-bluetooth
                </v-icon>
            </div>
        </div>

        <!-- Polaroid Size Info - only on desktop -->
        <div v-if="!mobile" class="ml-6  text-grey-darken-1 polaroid-size-info">
            <span class="text-uppercase font-weight-normal">Polaroid Size: </span>
            <span class=" font-weight-bold">
                {{selectedWidth}} x <span v-if="selectedWidth!=1260">800</span><span v-else>840</span></span>
        </div>

    </div>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue';
import { useDisplay } from 'vuetify/lib/framework.mjs';

const { mobile }=useDisplay()

const selectedWidth=ref(800);

const props=defineProps<{
    color: string;
    isConnected: boolean;
    config: {
        width: number,
        height: number
    },
}>();

const emit=defineEmits(['resize'])

watch(() => props.isConnected, () => {
    if (props.isConnected) selectedWidth.value=props.config.width;
})

watch(() => props.config, () => {
    if (props.isConnected) selectedWidth.value=props.config.width;
})

watch(selectedWidth, () => {
    emit('resize', { width: selectedWidth.value, height: selectedWidth.value==1260? 840:800 });
})


// Determines if Bluetooth icon should be shown
const showBluetoothIcon=(width: number) => props.isConnected&&props.config?.width===width;

// Constructs polaroid class list
const polaroidClass=(width: number) => {
    const baseClasses=`polaroid polaroid-${width} ml-${width===600? '0':'4'}`;
    const bgColorClass=`bg-${selectedWidth.value===width? props.color:'grey-darken-2'}`;
    const disabledClass=props.isConnected&&props.config?.width!==width? 'disabled':'';

    return [baseClasses, bgColorClass, disabledClass].join(' ');
}


props.isConnected;
props.config;
props.color;
</script>



<style scoped>
.polaroid {
    position: relative;
    padding-top: 3px;
    border-radius: 1px;
    cursor: pointer;
    transition: transform 0.3s;
}

.inner-polaroid {
    background-color: #f5f5f5;
    border-radius: 0;
}

.polaroid-600,
.polaroid-800,
.polaroid-1260 {
    height: 34px;
}

.polaroid-600 {
    width: 22px;
}

.polaroid-600 .inner-polaroid {
    width: 16px;
    height: 23px;
    margin-left: 3px;
}

.polaroid-800 {
    width: 29px;
}

.polaroid-800 .inner-polaroid {
    width: 23px;
    height: 23px;
    margin-left: 3px;
}

.polaroid-1260 {
    width: 38px;
}

.polaroid-1260 .inner-polaroid {
    width: 32px;
    height: 23px;
    margin-left: 3px;
}

.icon-position {
    position: absolute;
    top: 8px;
    left: 50%;
    transform: translateX(-50%);
}

.polaroid:hover {
    transform: scale(1.1);
}

.polaroid-size-info {
    font-size: 15px;
    letter-spacing: 1.5px;
}

.disabled {
    opacity: .3;
    pointer-events: none;
}
</style>