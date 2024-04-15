<template>
	<div class="app-area">

		<!-- bottom-left corner: color selector -->
		<ThemeColorSelector class="theme-color-selector" v-on:color-change="themeChangeEvent" />

		<!-- bottom-right corner: project github link -->
		<ProjectLinks class="project-links" />

		<!-- top-left corner: polaroid size selector (if no connection) (only square size in preview mode)-->
		<div class="printer-variant-settings">
			<PolaroidSizeSelector v-if="!config.connection" v-on:type-change="typeChangeEvent" />
			<PrinterConnection :queue="imageQueue" :config="config" />
		</div>

		<PolaroidEditor v-on:image="createdImageEvent" :config="config" :queueLength="imageQueue.length" />

	</div>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue';

import ThemeColorSelector from './components/layout/ThemeColorSelector.vue'
import PolaroidSizeSelector from './components/layout/PolaroidSizeSelector.vue';

import PolaroidEditor from './components/polaroid/PolaroidEditor.vue';
import PrinterConnection from './components/printer/PrinterConnection.vue';

import { InstaxPrinter } from './api/instax';

import { type PrinterStateConfig, InstaxFilmVariant } from './interfaces/PrinterStateConfig';

import { QueueImage } from './interfaces/QueueImage';
import ProjectLinks from './components/layout/ProjectLinks.vue';


const config = ref<PrinterStateConfig>({
	type: InstaxFilmVariant.SQUARE,

	connection: false,
	connect: connectBluetoothPrinter,
	disconnect: disconnectBluetoothPrinter,
	status: undefined

})

// get hex value of current color theme
function getThemeColorHex(theme: string): string {
	return getComputedStyle(document.documentElement).getPropertyValue(`--${theme}-color`) ?? '#FFFFFF'
}

// update theme onto printer if changed
function themeChangeEvent(theme: string = 'dynamic-bg'): void {
	if (!config.value.connection || !printer) return;
	printer.setColor([getThemeColorHex(theme)], 1, 255);
}

// update film type (only if not automatically with printer)
function typeChangeEvent(filmType: InstaxFilmVariant): void {
	if (!config.value.connection || !printer) config.value.type = filmType
}



let isPrinting = false;

let timeoutHandle: ReturnType<typeof setInterval> | null = null
let printer: InstaxPrinter | null = null;
const imageQueue = ref<QueueImage[]>([])

onMounted(() => {

	window.addEventListener("beforeunload", (event) => {
		if ((printer != null && imageQueue.value.length > 0 || isPrinting)) event.returnValue = true;
	});

})

async function disconnectBluetoothPrinter(): Promise<void> {
	if (!printer) return;

	await printer.disconnect();


}
async function connectBluetoothPrinter(): Promise<void> {


	try {
		printer = new InstaxPrinter();

		const device = await printer.connect();
		if (!device) return; // cancelled connection

		config.value.connection = true;

		// listener on disconnect event
		device.addEventListener('gattserverdisconnected', clearConnection);


		await new Promise((r) => setTimeout(r, 150)) // await connection setup

		loadMetaData();

		setTimeout(async () => {
			themeChangeEvent();
		}, 1500);

	} catch (error) {
		clearConnection()
	}

}

function clearConnection(): void {
	printer = null;
	config.value.connection = false;
	config.value.status = undefined;

	if (timeoutHandle) clearInterval(timeoutHandle)
}

async function loadMetaData(): Promise<void> {

	if (!config.value.connection || !printer || isPrinting) return;
	if (timeoutHandle) clearInterval(timeoutHandle);


	await getPrinterMeta(true);
	console.log("SET QUEEUEUEUE")
	timeoutHandle = setInterval(async () => {
		await getPrinterMeta();
		printPolaroidQueue()
	}, 2000) as ReturnType<typeof setInterval>;

}

async function getPrinterMeta(includeType = false): Promise<void> {

	try {
		const type = config.value.status?.type;
		config.value.status = await printer.getInformation(includeType)
		if (includeType) config.value.type = config.value.status.type
		else {
			config.value.status.type = type;
		}


	} catch (error) {
		return
	}

}

interface ImageData {
	src: string,
	download: boolean
}

function createdImageEvent(imageData: ImageData) {

	// download image if no printer is connected (image + polaroid frame are exported)
	if (imageData.download == false && config.value.connection == true) {

		// add to image queue
		imageQueue.value.push({ base64: imageData.src, quantity: 1, state: 0, progress: 0 })
	} else {
		const a = document.createElement("a");
		a.href = imageData.src
		a.download = "Polaroid.png"; //File name Here
		a.click(); //Downloaded file
	}
}


// process (send + print) first image in queue
async function printPolaroidQueue(isRetry = false): Promise<void> {

	if (config.value.status == null || config.value.status.polaroidCount == null || config.value.status.polaroidCount <= 0 || imageQueue.value.length == 0 || imageQueue.value[0] == null) return;
	if (imageQueue.value[0].state == 0) {

		try {
			isPrinting = true

			if (timeoutHandle) clearInterval(timeoutHandle);
			imageQueue.value[0].state = 1
			imageQueue.value[0].abortController = new AbortController();

			console.log(imageQueue.value[0].base64);

			await printer.sendImage(imageQueue.value[0].base64, true, config.value.type, async (progress: number) => {
				if (imageQueue.value[0] == null) return;
				if (imageQueue.value[0].abortController != null && (imageQueue.value[0].abortController.signal.aborted == true && progress == -1)) {
					console.log("AFTER COM")
					return;
				}

				imageQueue.value[0].progress = progress * 100;

			}, imageQueue.value[0].abortController.signal);


			if (imageQueue.value[0].abortController.signal == null || !imageQueue.value[0].abortController.signal.aborted) {

				// finished sending --> starting print progress (now printed images are the progress)
				imageQueue.value[0].state = 2;
				imageQueue.value[0].progress = 0


				await new Promise((r) => setTimeout(r, 1000));

				await getPrinterMeta(); // update printer information once 
				await new Promise((r) => setTimeout(r, 250));

				const quantity = imageQueue.value[0].quantity ?? 1; // total images
				imageQueue.value[0].progress = (1 / quantity) * 100; // initialize progress to start transition

				console.log("PRINTING???")

				// begin printing commands
				await printer.printImage(quantity, (printedImages: number) => {

					if (printedImages < quantity) {
						imageQueue.value[0].progress = (((printedImages + 1) / quantity) * 100)
					} else return;

				}, imageQueue.value[0].abortController.signal)

			}

		} catch (error) {
			if (!isRetry && !imageQueue.value[0].abortController.signal) return printPolaroidQueue(true);
		}

		finishUpPrinting()

	}

}

async function finishUpPrinting() {
	await new Promise((r) => setTimeout(r, 500));

	imageQueue.value.shift(); // remove element from queue

	isPrinting = false;
	if (timeoutHandle) clearInterval(timeoutHandle);

	loadMetaData();
}


</script>


<style scoped lang="scss" >
.app-area {
	position: fixed;
	width: 100vw;
	height: 100%;
	overflow: hidden;


	-moz-user-select: none;
	-webkit-user-select: none;
	user-select: none;


	&::before {
		content: '';
		position: absolute;
		top: 0;
		left: 0;
		width: 100%;
		height: 100%;
		background-color: var(--dynamic-bg-color);
		opacity: 0.2;
		z-index: -1;
	}
}

.project-links {
	position: absolute;
	bottom: 18px;
	right: 25px;
}

.github-link:hover {
	transform: scale(1.1);
}


.theme-color-selector {
	position: absolute;
	top: 25px;
	right: 25px;
}



.printer-variant-settings {
	position: absolute;
	display: flex;
	flex-direction: row;
	align-items: center;
	top: 25px;
	left: 25px;
	gap: 15px;

}


@media only screen and (max-width: 600px) {

	.printer-variant-settings,
	.project-links {

		display: none !important;
	}


}
</style>


