<template>
    <v-app theme="myCustomLightTheme">
        <v-main class="app">
            <PrinterAppTemplate v-on:color-update="themeColor=$event" v-on:config-update="config=$event">
                <template v-slot:default="{ state }">

                    {{themeColor}} - {{config}} -{{state}}
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
    overflow: auto !important;
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
