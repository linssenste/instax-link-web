<template>
    <div>
        <button class="close-button" v-on:click="showOverlay = true">
        <img draggable="false" alt="settings icon"
                src="@/assets/icons/printer/menu.svg" width="25" height="25" />
    </button>
        <div v-if="showOverlay" class="overlay">

            <button v-on:click="showOverlay = false" class="close-button"><img draggable="false" alt="close icon"
                    src="@/assets/icons/controls/xmark.svg" width="20" height="20" /></button>
            <PolaroidSizeSelector v-if="!config.connection" class="polaroid-size-selector"
                v-on:type-change="typeChangeEvent" connected="square" />



            <div class="settings-area">
                <ThemeColorSelector v-on:color-change="themeChangeEvent" />
                <PrinterConnection class="connection-button" :queue="queue" :config="config" />
            </div>


        </div>
    </div>
</template>

<script setup lang="ts">
import ThemeColorSelector from './ThemeColorSelector.vue'
import PolaroidSizeSelector from './PolaroidSizeSelector.vue';
import PrinterConnection from '../printer/PrinterConnection.vue';

import { type PrinterStateConfig } from './interfaces/PrinterStateConfig';
import { QueueImage } from './interfaces/QueueImage';

import { ref } from 'vue';
const emit = defineEmits<{
    (e: 'type-change', value: string): void,
    (e: 'color-change', value: string): void
}>()

const props = withDefaults(defineProps<{
    config?: PrinterStateConfig
    queue?: QueueImage[]
}>(), {
    config: () => (null),
    queue: () => []
})
props.config;

const showOverlay = ref<boolean>(false)


function typeChangeEvent(value: string) {
    emit('type-change', value)
}

function themeChangeEvent(value: string) {
    emit('color-change', value)
}
</script>

<style scoped>
.overlay {
    position: fixed;
    top: 0;
    left: 0;
    z-index: 1000000;
    width: 100%;
    height: 100%;
    background-color: rgba(255, 255, 255, 0.7);
    backdrop-filter: blur(15px);
    -webkit-backdrop-filter: blur(15px);

    &::before {
        content: '';
        position: absolute;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background-color: var(--dynamic-bg-color);
        opacity: .2;
        z-index: -1;
    }
}

.settings-area {
    position: absolute;
    bottom: 25px;
    width: calc(100% - 50px);
    left: 50%;
    transform: translateX(-50%);

    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 40px;
}


.connection-button {
    position: relative;
    width: 100%;
}

.polaroid-size-selector {
    position: absolute;
    top: 70px;
    left: 50%;

    text-align: center !important;
    transform: translateX(-50%);
}


.close-button {
    position: absolute;
    top: 10px;
    right: 10px;
    background-color: transparent;
    opacity: .75;
    width: 60px;
    height: 60px;
    border-radius: 50%;
    cursor: pointer;
    transition: all 150ms linear;
}

@media (hover: hover) and (pointer: fine) {


    .close-button:hover {
        opacity: 1;
        transform: scale(1.15);
        box-shadow: none;

    }


    .close-button:hover img {
        opacity: 1;
    }
}

.close-button img {
    opacity: .75;


    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);

    -moz-user-select: none;
    -webkit-user-select: none;
    user-select: none;
}
</style>