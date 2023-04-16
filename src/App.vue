<template>
    <v-app theme="instaxTheme">
        <v-main class="app">
            <PrinterAppTemplate v-on:color-update="themeColor=$event" v-on:config-update="config=$event">
                <template v-slot:default="{ printerStatus, print, color }">
                    <router-view :color="color" :config="config" :printerStatus="printerStatus" :print="print" />
                </template>

            </PrinterAppTemplate>
        </v-main>
    </v-app>
</template>

<script setup lang="ts">

import PrinterAppTemplate from '@/components/layout/PrinterAppTemplate.vue'
import { ref } from 'vue';

const config=ref({
    width: 800,
    height: 800
})

const themeColor=ref<string>('pink');


</script>

<style lang="scss">
.app {
    overflow: hidden !important;
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