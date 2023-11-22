<template>

	<div class="app-area">
		<div class="background" :style="themeStyling"/>
		<PolaroidSizeSelector :color="themeColor" :isConnected="false" :config="config" v-on:resize="config = $event"/>
		<ThemeColorSelector class="theme-selector" v-on:color-change="themeColor = $event"/>

		<a oncontextmenu="return false" href="https://github.com/linssenste/instax-link-web" class="github-link" target="_blank">
		<img  alt="link to github page of this project" draggable="false" src="@/assets/icons/github-icon.webp" width="30" height="30"/>

</a>
	</div>
</template>

<script setup lang="ts">
import ThemeColorSelector from '@/components/layout/ThemeColorSelector.vue'
// import PrinterAppTemplate from '@/components/layout/PrinterAppTemplate.vue'
import { computed, ref } from 'vue';
import PolaroidSizeSelector from './components/layout/PolaroidSizeSelector.vue';

const config=ref({
    width: 800,
    height: 800
})

const themeColor=ref<string>('pink');

const themeStyling = computed(() => {
	return {
		backgroundColor: `var(--${themeColor.value}-color)`
	}
})

</script>





<style lang="scss">
.github-link {
	position: absolute;
	right: 15px; 
	bottom: 12px;
	cursor: pointer;
	transition: all 150ms ease-in-out;
	user-select: none;

}
.github-link:hover {
	transform: scale(1.1);
}
.app-area {
	width: 100%; 
	height: 100vh; 
	overflow: hidden;
}

.background {
	background-color: var(--green-color);
	opacity: .1;
	position: absolute;
	top: 0px;
	z-index: -1;
	left: 0px;
	height: 100%; 
	width: 100%;
}

.theme-selector {
	position: absolute;
	bottom: 20px;
	left: 25px
}


</style>