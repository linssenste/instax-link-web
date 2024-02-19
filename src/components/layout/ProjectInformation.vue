<template>
	<div id="project-info">
	<div v-if="showOverlay" class="info-overlay" id="info-overlay">

		<div class="container">

			<div class="info-center-column">
				<h1>Create digital polaroids</h1>

				Lorem ipsum dolor sit amet, consetetur sadipscing elitr, sed diam nonumy eirmod tempor invidunt ut labore et
				dolore magna aliquyam erat, sed diam voluptua. At vero eos et accusam et justo duo dolores et ea rebum. Stet
				clita kasd gubergren, no sea takimata sanctus est Lorem ipsum dolor sit amet. Lorem ipsum dolor sit amet,
				consetetur sadipscing elitr, sed diam nonumy eirmod tempor invidunt ut labore et dolore magna aliquyam erat,
				sed diam voluptua. At vero eos et accusam et justo duo dolores et ea rebum. Stet clita kasd gubergren, no
				sea takimata sanctus est Lorem ipsum dolor sit amet.
				<div class="example-polaroids">
					<img src="@/assets/example.png" draggable="false" width="272" />
					<img src="@/assets/example.png" draggable="false" width="272" />
				</div>

				<h1>...or just print them</h1>
				Lorem ipsum dolor sit amet, consetetur sadipscing elitr, sed diam nonumy eirmod tempor invidunt ut labore et
				dolore magna aliquyam erat, sed diam voluptua. At vero eos et accusam et justo duo dolores et ea rebum. Stet
				clita kasd gubergren, no sea takimata sanctus est Lorem ipsum dolor sit amet. Lorem ipsum dolor sit amet,
				consetetur sadipscing elitr, sed diam nonumy eirmod tempor invidunt ut labore et dolore magna aliquyam erat,
				sed diam voluptua. At vero eos et accusam et justo duo dolores et ea rebum. Stet clita kasd gubergren, no
				sea takimata sanctus est Lorem ipsum dolor sit amet.

				<iframe width="560" style="border-radius: 8px; margin-top: 30px;" height="315"
						src="https://www.youtube.com/embed/dQw4w9WgXcQ?si=1BMEH-6JO2bsI2R-" title="YouTube video player"
						frameborder="0"
						allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
						allowfullscreen></iframe>
			</div>

		</div>


		<button class="close-button" data-testid="clos-overlay-button" title="Close info overlay"
				@click="toggleOverlay()"><img src="@/assets/icons/controls/xmark.svg" width="16" /></button>

	</div>

	<!-- info button to open fixed overlay -->
	<button @click="toggleOverlay()"
			style="color: var(--dynamic-bg-color)!important; background-color: rgba(250, 250, 250, .8); padding-right: 30px; border-radius: 20px; padding-left: 30px; margin-right: 16px; display: flex; flex-direction: row; align-items: center; justify-content: center; gap: 8px">
		<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="18">
			<path fill="var(--dynamic-bg-color)"
				  d="M256 512A256 256 0 1 0 256 0a256 256 0 1 0 0 512zM169.8 165.3c7.9-22.3 29.1-37.3 52.8-37.3h58.3c34.9 0 63.1 28.3 63.1 63.1c0 22.6-12.1 43.5-31.7 54.8L280 264.4c-.2 13-10.9 23.6-24 23.6c-13.3 0-24-10.7-24-24V250.5c0-8.6 4.6-16.5 12.1-20.8l44.3-25.4c4.7-2.7 7.6-7.7 7.6-13.1c0-8.4-6.8-15.1-15.1-15.1H222.6c-3.4 0-6.4 2.1-7.5 5.3l-.4 1.2c-4.4 12.5-18.2 19-30.6 14.6s-19-18.2-14.6-30.6l.4-1.2zM224 352a32 32 0 1 1 64 0 32 32 0 1 1 -64 0z" />
		</svg>
		INFOS
	</button>

</div>


</template>
  
<script lang="ts" setup>
import { ref } from 'vue';


const showOverlay = ref(false);

async function toggleOverlay(): Promise<void> {

	if (showOverlay.value == true) {
		const doc = document.getElementById('info-overlay');

		doc.classList.remove('fade-in')
		await new Promise((r) => setTimeout(r, 150));
		showOverlay.value = false

	} else {
		showOverlay.value = true
		await new Promise((r) => setTimeout(r, 5));
		const doc = document.getElementById('info-overlay');

		doc.classList.add('fade-in')

	}

}


</script>
<style scoped>
#project-info {
	position: relative;
}
.info-overlay {
	z-index: 1000000 !important;
	position: fixed;
	width: 100vw;
	height: 100vh;
	top: 0px;
	left: 0px;
	background: rgba(255, 255, 255, 0.5);
	-moz-backdrop-filter: blur(20px);
	-webkit-backdrop-filter: blur(20px);
	backdrop-filter: blur(20px);
	text-align: center;
	opacity: 0;
	/* Set initial opacity to 0 */
	transition: all 150ms ease-in-out;
	/* Adjust the transition duration */
}

.info-overlay.fade-in {
	opacity: 1;
}

.container {
	overflow: scroll;
	width: 100%;
	display: flex;
	flex-direction: column;
	align-items: center;
	max-height: 100%;
	height: 100%;
}

.info-center-column {
	width: 560px;
	max-width: 100%;
	line-height: 22px;
	letter-spacing: .75px;
	text-align: justify;
	padding-bottom: 100px;
	padding-top: 0px;
}

.example-polaroids {
	position: relative;
	margin-top: 24px;
	margin-bottom: 20px;
	display: flex;
	flex-direction: row;
	align-items: center;
	justify-content: space-between;
}

.close-button {
	position: fixed;
	top: 25px;
	right: 25px;
	background-color: #ffffffaa;
	width: 40px;
	height: 40px;
	border-radius: 50%;
}

.close-button:hover {
	background-color: #ffffff;
}

.close-button img {
	position: absolute;
	top: 50%;
	left: 50%;
	transform: translate(-50%, -50%);
}

</style>
  