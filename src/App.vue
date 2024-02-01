<template>
	<div class="app-area">

		<!-- bottom-left corner: color selector -->
		<ThemeColorSelector class="theme-color-selector" v-on:color-change="themeUpdateEvent" />

		<!-- bottom-right corner: project related links/information -->
		<ProjectLinks class="project-links-section" />

		<!-- top-left corner: polaroid size selector (if no connection) -->
		<div class="instax-variant-settings">
			<PolaroidSizeSelector v-if="!config.connection" v-on:resize="config.type = $event" />
			<PrinterSettings :status="printerStatus" :queue="imageQueue" :hasBluetoothAccess="true" :config="config" />
		</div>

		<PolaroidEditor v-on:image="printPolaroid" :config="config" />

	</div>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue';

import ThemeColorSelector from './components/layout/ThemeColorSelector.vue'
import ProjectLinks from './components/layout/ProjectLinks.vue';
import PolaroidSizeSelector from './components/layout/PolaroidSizeSelector.vue';

import PolaroidEditor from './components/polaroid/PolaroidEditor.vue';
import PrinterSettings from './components/printer/PrinterSettings.vue';

import { InstaxPrinter } from './plugins/printer/instax';

import { type STATE_CONFIG, type PRINTER_STATUS, type PRINTING_IMAGE_QUEUE, FilmSize } from './types/config.types';


const config = ref<STATE_CONFIG>({
	type: FilmSize.SQUARE,

	connection: false,
	connect: connectPrinterEvent,
	disconnect: disconnectPrinter
})


function getThemeColorHex(theme: string): string {
	return getComputedStyle(document.documentElement).getPropertyValue(`--${theme}-color`) ?? '#FFFFFF'
}


function themeUpdateEvent(theme: string = 'dynamic-bg'): void {
	

	if (!config.value.connection || !printer) return;


	printer.setColor([getThemeColorHex(theme)], 1, 255);
}




let isPrinting = false;
const initialPrinterStatus: PRINTER_STATUS = {

	type: null,
	battery: {
		charging: false,
		level: null
	},

	polaroidCount: null,
}

const printerStatus = ref(initialPrinterStatus)


let timeoutHandle: ReturnType<typeof setInterval> | null = null
let printer: InstaxPrinter | null = null;

async function disconnectPrinter(): Promise<void> {

	if (printer) {
		await printer.disconnect();
		printerStatus.value = initialPrinterStatus;
	}
}
async function connectPrinterEvent(): Promise<void> {

	try {

		printer = new InstaxPrinter();
		const device = await printer.connect();

		if (device) {
			config.value.connection = true;

			setTimeout(async () => {

				loadMetaData();
				setTimeout(async () => {
					themeUpdateEvent();
				}, 1500);
			}, 250);



			//  on disconnect
			device.addEventListener('gattserverdisconnected', clearConnection);
		}

	} catch (error) {
		clearConnection()
	}

}

function clearConnection(): void {
	printer = null;
	config.value.connection = false;

	if (timeoutHandle) clearInterval(timeoutHandle)
}

async function loadMetaData(): Promise<void> {

	if (!config.value.connection || !printer) return;

	await getPrinterMeta();

	if (timeoutHandle) clearInterval(timeoutHandle);
	timeoutHandle = setInterval(() => getPrinterMeta(), 2000) as ReturnType<typeof setInterval>;

}

async function getPrinterMeta(): Promise<void> {
	if (!printer || isPrinting) return;

	if (timeoutHandle && (!printer || config.value.connection == false)) {
		clearInterval(timeoutHandle);
		return;
	}

	try {

		printerStatus.value = await printer.getInformation(false)

		config.value.type = FilmSize.SQUARE; 

	} catch (error) {
		return
	}

}


const imageQueue = ref<PRINTING_IMAGE_QUEUE[]>([])

function printPolaroid(imageData: string) {

	if (config.value.connection != true) {
		setTimeout(() => {
			var a = document.createElement("a");
			a.href = imageData
			a.download = "Polaroid.png"; //File name Here
			a.click(); //Downloaded file

		}, 250);
	} else {
		imageQueue.value.push({ base64: imageData, quantity: 1, state: 0, progress: 0, abortController: null })
	}

}

watch(printerStatus, (newValue, oldValue) => {

	if (oldValue.polaroidCount == 0 && newValue.polaroidCount == 10) {
		printPolaroidQueue()
	}

}, { deep: true })

watch(imageQueue, async () => {
	if (!isPrinting) printPolaroidQueue()
}, { deep: true });


async function printPolaroidQueue(): Promise<void> {

	if ((printerStatus.value.polaroidCount != null && printerStatus.value.polaroidCount <= 0) || imageQueue.value.length == 0 || imageQueue.value[0] == null) return;
	if (imageQueue.value[0].state == 0) {

		try {
			isPrinting = true

			if (timeoutHandle) clearInterval(timeoutHandle);
			imageQueue.value[0].state = 1
			imageQueue.value[0].abortController = new AbortController();

			await sendImage(imageQueue.value[0].base64, (progress) => {

				if (imageQueue.value[0].abortController == null || imageQueue.value[0].abortController.signal.aborted == true && progress == -1) {

					imageQueue.value.shift()
					return;

				}
				imageQueue.value[0].progress = progress * 100;



			}, imageQueue.value[0].abortController)


			imageQueue.value[0].state = 2;
			imageQueue.value[0].progress = 0

			await new Promise((r) => setTimeout(r, 500))

			const quantity = imageQueue.value[0].quantity ?? 1

			imageQueue.value[0].progress = ((1) / quantity) * 100

			await printImages(quantity, async (progress) => {


				if (progress < quantity) {
					imageQueue.value[0].progress = ((progress + 1) / quantity) * 100
				} else return;

			}, imageQueue.value[0].abortController)

		} catch (error) {
			console.log("S", error);
		}

		imageQueue.value.shift()

		isPrinting = false
		if (timeoutHandle) clearInterval(timeoutHandle);

		loadMetaData();
	}

}



async function sendImage(imageUrl: string, callback: (progress: any) => void, abortController: AbortController): Promise<void> {

	if (!printer) return;

	await new Promise((r) => setTimeout(r, 500))

	await printer.sendImage(imageUrl, true, async (status: number) => {
		callback(status)
	}, abortController.signal);
}



async function printImages(quantity: number, callback: (progress: any) => void, abortController: AbortController): Promise<void> {
	if (!printer) return;

	await new Promise((r) => setTimeout(r, 250))

	await printer.printImage(quantity, (printed: number) => {
		callback(printed)
	}, abortController.signal)
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


.project-links-section {
	position: absolute;
	bottom: 18px;
	right: 25px;
	z-index: 10 !important;
}

.theme-color-selector {
	position: absolute;
	bottom: 25px;
	left: 25px;
	z-index: 10 !important;
}

.polaroid img {
	display: block;
	width: 100%;
	height: auto;
}

.polaroid::after {
	content: "";
	position: absolute;
	top: 0;
	left: 0;
	right: 0;
	bottom: 0;
	background: linear-gradient(45deg, #fff, rgba(255, 255, 255, 0));
	pointer-events: none;
}

.polaroid::before {
	content: "";
	position: absolute;
	top: 10px;
	left: 10px;
	right: 10px;
	bottom: 10px;
	border: 1px solid rgba(0, 0, 0, 0.1);
	border-radius: 5px;
	pointer-events: none;
}


.instax-variant-settings {
	position: absolute;
	display: flex;
	flex-direction: row;
	align-items: center;
	top: 25px;
	left: 25px;
	gap: 20px
}
</style>