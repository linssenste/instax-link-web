<template>
	<div class="app-area"> 

		<!-- bottom-left corner: color selector -->
		<ThemeColorSelector class="theme-color-selector" v-on:color-change="config.theme = $event" />

		<!-- bottom-right corner: project related links/information -->
		<ProjectLinks class="project-links-section"/>

		<!-- top-left corner: polaroid size selector (if no connection) -->
		<PolaroidSizeSelector class="polaroid-size-selection" :config="config" v-on:resize="config = $event" />
		

		<PolaroidEditor v-on:image="printingQueue.push($event)" v-on:connect="connectPrinterEvent" :config="config" />

	</div>
</template>

<script setup lang="ts">

import ThemeColorSelector from './components/layout/ThemeColorSelector.vue'
import ProjectLinks from './components/layout/ProjectLinks.vue';
import PolaroidSizeSelector from './components/layout/PolaroidSizeSelector.vue';
import PolaroidEditor from './components/polaroid/PolaroidEditor.vue';

import { ref, watchEffect } from 'vue';

export interface THEME_STATE_CONFIG {
  width: number; 
  height: number; 
  theme: string;
  connection: boolean
}

const config = ref<THEME_STATE_CONFIG>({
	width: 800,
	height: 800,
	theme: 'pink',
	connection: false
})

// set background theme color
watchEffect(() => {
    document.documentElement.style.setProperty('--dynamic-bg-color', `var(--${config.value.theme}-color)`);
});


function connectPrinterEvent(): void {
	console.log("CONNECT")
}

const printingQueue: any = ref([])



</script>

<style scoped lang="scss" >
.app-area {
    position: fixed;
    width: 100%;
    height: 100%;
    overflow: hidden;
    user-select: none;

    &::before {
        content: '';
        position: absolute;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background-color: var(--dynamic-bg-color);
        opacity: 0.15;
        z-index: -1; 
    }
}



.polaroid-size-selection {
	position: absolute;
	top: 25px; 
	left: 25px;
}
.project-links-section {
	position: absolute;
	bottom: 18px; 
	right: 25px;
	z-index: 10!important;
}

.theme-color-selector {
	position: absolute;
	bottom: 25px;
	left: 25px;
	z-index: 10!important;
}
</style>