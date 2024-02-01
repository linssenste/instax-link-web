<template>
	<div class="app-area">

		<!-- bottom-left corner: color selector -->
		<ThemeColorSelector class="theme-color-selector" v-on:color-change="themeUpdateEvent" />

		<!-- bottom-right corner: project related links/information -->
		<ProjectLinks class="project-links-section" />

		<!-- top-left corner: polaroid size selector (if no connection) -->
		<div class="instax-variant-settings">
			<PolaroidSizeSelector v-if="!config.connection" :config="config" v-on:resize="config = $event" />
			<PrinterSettings :status="printerStatus" :queue="imageQueue" :hasBluetoothAccess="true" :config="config" />
		</div>

		<PolaroidEditor v-on:image="printPolaroid" :config="config" />

	</div>
</template>

<script setup lang="ts">
import { ref, watch, watchEffect } from 'vue';

import ThemeColorSelector from './components/layout/ThemeColorSelector.vue'
import ProjectLinks from './components/layout/ProjectLinks.vue';
import PolaroidSizeSelector from './components/layout/PolaroidSizeSelector.vue';

import PolaroidEditor from './components/polaroid/PolaroidEditor.vue';
import PrinterSettings from './components/printer/PrinterSettings.vue';

import { InstaxPrinter } from './plugins/printer/instax';
import { INSTAX_OPCODES } from './plugins/printer/events';

import type { STATE_CONFIG, PRINTER_STATUS, PRINTING_IMAGE_QUEUE } from './types/config.types';

const config = ref<STATE_CONFIG>({
	width: 800,
	height: 800,

	theme: 'pink',
	connection: false,
	connect: connectPrinterEvent,
	disconnect: disconnectPrinter
})

function themeUpdateEvent(theme: string): void {
	config.value.theme = theme;

	if (!config.value.connection || !printer) return;
	printer.setColor([getInvertedBGR(theme)], 1, 255)
}

// set background theme color
watchEffect(() => {
	document.documentElement.style.setProperty('--dynamic-bg-color', `var(--${config.value.theme}-color)`);
});




let isPrinting = false;
const initialPrinterStatus: PRINTER_STATUS = {
	battery: {
		charging: false,
		level: null
	},
	polaroids: {
		width: 600,
		height: 800,
		stack: null,
	},
	serialNumber: '',
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


				// make blinking effect on printer
				const themeArray = getInvertedBGR(config.value.theme);
				(printer as any).setColor([themeArray, [0, 0, 0]], 25, 3)


				setTimeout(async () => {
					themeUpdateEvent(config.value.theme);
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

		let response = await printer.sendCommand(INSTAX_OPCODES.SUPPORT_FUNCTION_INFO, [0]) as any;
		printerStatus.value.polaroids.width = 800//parseInt(String(response.width != 600 && response.width != 800 && response.width != 1240 ? 800 : response.width)) as (600 | 800 | 1240);
		printerStatus.value.polaroids.height = parseInt(String(response.height != 800 && response.height != 840 ? 800 : response.height)) as (800 | 840);

		config.value.width = printerStatus.value.polaroids.width; 
		config.value.height = printerStatus.value.polaroids.height;

		response = await printer.sendCommand(INSTAX_OPCODES.SUPPORT_FUNCTION_INFO, [1]) as any;

		printerStatus.value.battery.charging = response.isCharging > 5;
		printerStatus.value.battery.level = (response.battery ?? printerStatus.value.battery.level);

		response = await printer.sendCommand(INSTAX_OPCODES.SUPPORT_FUNCTION_INFO, [2]) as any;
		printerStatus.value.polaroids.stack = (response.photosLeft ?? printerStatus.value.polaroids.stack);

		response = await printer.sendCommand(INSTAX_OPCODES.DEVICE_INFO_SERVICE, [2]) as any;
		printerStatus.value.serialNumber = response.serialNumber;


	} catch (error) {
		return
	}

}


function getInvertedBGR(color: string): number[] {
	switch (color) {
		case 'blue':
			return [255, 131, 65]; // BGR values for blue-color
		case 'pink':
			return [255, 112, 248]; // BGR values for pink-color
		case 'orange':
			return [0, 156, 254]; // BGR values for orange-color
		case 'yellow':
			return [0, 234, 254]; // BGR values for yellow-color
		case 'green':
			return [52, 156, 0]; // BGR values for green-color
		case 'red':
			return [90, 90, 255]; // BGR values for red-color
		default:
			return [0, 0, 0]; // Default to black if color is not found
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


	if (oldValue.polaroids.stack == 0 && newValue.polaroids.stack == 10) {
		console.log("NEW STACK!!!")
		printPolaroidQueue()
	}
}, { deep: true })

watch(imageQueue, async () => {
	if (isPrinting) return;

	printPolaroidQueue()
}, { deep: true });

async function printPolaroidQueue(): Promise<void> {


	if ((printerStatus.value.polaroids.stack != null && printerStatus.value.polaroids.stack <= 0) || imageQueue.value.length == 0 || imageQueue.value[0] == null) return;
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
				}  else return;


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