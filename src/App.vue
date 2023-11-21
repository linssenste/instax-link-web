<template>

	<div class="app-area">
		<div class="background" :style="themeStyling"/>
		sdjklfm
		<ThemeColorSelector v-on:color-change="themeColor = $event"/>
	</div>
</template>

<script setup lang="ts">
import ThemeColorSelector from '@/components/layout/ThemeColorSelector.vue'
// import PrinterAppTemplate from '@/components/layout/PrinterAppTemplate.vue'
import { computed, ref } from 'vue';

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


</style>