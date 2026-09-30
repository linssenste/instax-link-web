<template>
    <div>
        <button class="close-button" v-on:click="showOverlay = true">
        <span class="menu-icon" aria-hidden="true" />
    </button>
        <div v-if="showOverlay" class="overlay">

            <!-- a pointer shortcut, not a second tab stop: the close button is the
                 real way out -->
            <button type="button" class="scrim" tabindex="-1" aria-hidden="true"
                v-on:click="showOverlay = false" />

            <button type="button" v-on:click="showOverlay = false" class="close-button"
                aria-label="Close settings" title="Close settings">
                <span class="close-icon" aria-hidden="true" />
            </button>
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

import { type PrinterStateConfig } from '../../interfaces/PrinterStateConfig';
import { type QueueImage } from '../../interfaces/QueueImage';

import { ref } from 'vue';
const emit = defineEmits<{
    (e: 'type-change', value: string): void,
    (e: 'color-change', value: string): void
}>()

withDefaults(defineProps<{
    config: PrinterStateConfig
    queue?: QueueImage[]
}>(), { queue: () => [] });

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
        background-color: rgb(var(--dynamic-bg-color));
        opacity: .2;
        z-index: -1;
    }
}

/* Sits behind the controls, which are positioned siblings that come after it.
   height: auto overrides the app's 40px button height, which would otherwise leave
   only a band across the top clickable. */
.scrim {
    position: absolute;
    inset: 0;
    height: auto;
    padding: 0;
    border: none;
    border-radius: 0;
    background-color: transparent;
    box-shadow: none;
    cursor: default;
}

/* the global button hover outranks a single class and would paint it over */
.scrim:hover {
    background-color: transparent;
    box-shadow: none;
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


    .close-button:hover .close-icon {
        opacity: 1;
    }
}

/* a mask rather than an image: the icon ships with a placeholder fill that would
   vanish against the overlay */
.close-icon {
    position: absolute;
    top: 50%;
    left: 50%;
    width: 20px;
    height: 20px;
    margin: -10px 0 0 -10px;
    opacity: .75;
    background-color: #000000;
    -webkit-mask: url('@/assets/icons/controls/close.svg') center / contain no-repeat;
    mask: url('@/assets/icons/controls/close.svg') center / contain no-repeat;
}

/* a mask rather than an img: the icon ships with a grey placeholder fill, so it
   never took the theme colour the rest of the controls are in */
.menu-icon {
    display: block;
    width: 25px;
    height: 25px;
    background-color: rgb(var(--dynamic-bg-color));
    -webkit-mask: url('@/assets/icons/printer/menu.svg') center / contain no-repeat;
    mask: url('@/assets/icons/printer/menu.svg') center / contain no-repeat;
}
</style>