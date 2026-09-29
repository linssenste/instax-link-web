<template>
	<div class="app-area" id="app-area" :class="{ 'transparent-bg': embedMode != null }">

		<!-- top-right corner: connection, printer status and the print queue -->
		<PrinterConnection v-show="!isMobile" class="printer-panel" :queue="imageQueue" :config="config" />

		<!-- bottom-left corner: theme color selector -->
		<ThemeColorSelector v-show="!isMobile" v-if="!embedMode" class="theme-colors"
			v-on:color-change="themeChangeEvent" />

		<!-- top-left corner: polaroid size selector (if no connection) (only square size in preview mode)-->
		<div v-if="!embedMode && !isMobile" class="printer-variant-settings">
			<PolaroidSizeSelector v-if="!config.connection" v-on:type-change="typeChangeEvent" connected="square" />

		</div>

		<PolaroidEditor class="editor" v-on:image="createdImageEvent" :config="config" :queueLength="imageQueue.length" />


		<MobileOverlay v-show="isMobile" :config="config" v-on:color-change="themeChangeEvent"
			v-on:type-change="typeChangeEvent" :queue="imageQueue" />
	</div>
</template>

<script setup lang="ts">
import { onMounted, ref, onUnmounted } from 'vue';

import MobileOverlay from './components/layout/MobileOverlay.vue'
import ThemeColorSelector from './components/layout/ThemeColorSelector.vue'
import PolaroidSizeSelector from './components/layout/PolaroidSizeSelector.vue';

import PolaroidEditor from './components/polaroid/PolaroidEditor.vue';
import PrinterConnection from './components/printer/PrinterConnection.vue';
import { InstaxPrinter } from './api/instax';

import { type PrinterStateConfig, InstaxFilmVariant } from './interfaces/PrinterStateConfig';

import type { QueueImage } from './interfaces/QueueImage';
import { downloadDataUrl, polaroidFilename } from './cropper/cropper.download';


// if window smaller 1000
const isMobile = ref<boolean>(window.innerWidth < 1000);


const config = ref<PrinterStateConfig>({
	type: InstaxFilmVariant.SQUARE,
	connection: false,
	connect: connectBluetoothPrinter,
	disconnect: disconnectBluetoothPrinter,
	status: undefined

})

// theme colors are stored as "r, g, b" triplets so they can be used inside
// rgb()/rgba() in CSS; the printer protocol expects a hex string
function getThemeColorHex(theme: string): string {
	const value = getComputedStyle(document.documentElement).getPropertyValue(`--${theme}-color`)?.trim();
	if (!value) return '#FFFFFF';
	if (value.startsWith('#')) return value;

	const channels = value.split(',').map((channel) => Number(channel.trim()));
	if (channels.length !== 3 || channels.some((channel) => !Number.isFinite(channel))) return '#FFFFFF';

	return `#${channels.map((channel) => channel.toString(16).padStart(2, '0')).join('')}`;
}

// update theme onto printer if changed
function themeChangeEvent(theme: string = 'dynamic-bg'): void {
	if (!config.value.connection || !printer) return;
	printer.setColor([getThemeColorHex(theme)], 1, 255);
}

// update film type (only if not automatically with printer)
function typeChangeEvent(filmType: string): void {
	if (!config.value.connection || !printer) {
		config.value.type = filmType as InstaxFilmVariant
	}
}


let isPrinting = false;

let timeoutHandle: ReturnType<typeof setInterval> | null = null
let printer: InstaxPrinter | null = null;
const imageQueue = ref<QueueImage[]>([])

const embedMode = ref<string | null>(null)
onMounted(() => {

	const urlParams = new URLSearchParams(window.location.search);
	embedMode.value = urlParams.get('embed') ?? null;
	const appArea = document.getElementById('app-area');

	if (embedMode.value && appArea) {
		document.documentElement.style.setProperty('--dynamic-bg-color', `var(--${embedMode.value}-color)`);
		appArea.classList.add('transparent-bg');
	}
	window.addEventListener("beforeunload", unload);
	window.addEventListener('resize', resize);

})

onUnmounted(() => {
	window.removeEventListener("beforeunload", unload);
	window.removeEventListener('resize', resize);
	if (timeoutHandle) clearInterval(timeoutHandle);
	if (printer) printer.disconnect();
})

function resize(): void  {
		isMobile.value = window.innerWidth < 1000;
	}

function unload(event: BeforeUnloadEvent): void {
	if ((printer != null && imageQueue.value.length > 0 || isPrinting)) {
		event.returnValue = true;
	}
}


async function disconnectBluetoothPrinter(): Promise<void> {
	if (!printer) return;

	await printer.disconnect();


}
async function connectBluetoothPrinter(): Promise<void> {


	try {
		printer = new InstaxPrinter();

		const device = await printer.connect();
		if (!device || device === true) return; // cancelled connection

		config.value.connection = true;

		// listener on disconnect event
		device.addEventListener('gattserverdisconnected', clearConnection);


		await new Promise((r) => setTimeout(r, 150)) // await connection setup

		loadMetaData();

		setTimeout(async () => {
			themeChangeEvent();
		}, 1500);

	} catch {
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
	timeoutHandle = setInterval(async () => {
		await getPrinterMeta();
		printPolaroidQueue()
	}, 2000) as ReturnType<typeof setInterval>;

}

async function getPrinterMeta(includeType = false): Promise<void> {

	if (!printer) return;

	try {
		const type = config.value.status?.type ?? null;
		const status = await printer.getInformation(includeType)
		config.value.status = status;

		if (includeType && status.type != null) config.value.type = status.type
		else status.type = type;


	} catch {
		return
	}

}

interface RenderedImage {
	src: string,
	download: boolean,
	caption: string,
	type: InstaxFilmVariant
}

function createdImageEvent(imageData: RenderedImage) {

	// queue for printing; the caption is not printed, so it is kept as the title
	if (imageData.download == false && config.value.connection == true) {
		imageQueue.value.push({
			base64: imageData.src,
			quantity: 1,
			state: 0,
			progress: 0,
			type: imageData.type,
			caption: imageData.caption
		})
	} else {
		downloadDataUrl(imageData.src, polaroidFilename(imageData.caption));
	}
}


// process (send + print) first image in queue
async function printPolaroidQueue(isRetry = false): Promise<void> {

	if (printer == null || config.value.status == null || config.value.status.polaroidCount == null || config.value.status.polaroidCount <= 0 || imageQueue.value.length == 0 || imageQueue.value[0] == null) return;
	const connectedPrinter = printer;

	if (imageQueue.value[0].state == 0) {

		try {
			isPrinting = true

			if (timeoutHandle) clearInterval(timeoutHandle);
			imageQueue.value[0].state = 1
			imageQueue.value[0].abortController = new AbortController();

			await connectedPrinter.sendImage(imageQueue.value[0].base64, true, config.value.type, async (progress: number) => {
				if (imageQueue.value[0] == null) return;
				if (imageQueue.value[0].abortController != null && (imageQueue.value[0].abortController.signal.aborted == true && progress == -1)) {
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

				// begin printing commands
				await connectedPrinter.printImage(quantity, (printedImages: number) => {

					if (printedImages < quantity) {
						imageQueue.value[0].progress = (((printedImages + 1) / quantity) * 100)
					} else return;

				}, imageQueue.value[0].abortController.signal)

			}

		} catch {
			if (!isRetry && !imageQueue.value[0]?.abortController?.signal) return printPolaroidQueue(true);
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

<style scoped lang="scss">
.app-area {
	position: fixed;
	width: 100vw;
	height: 100%;
	overflow: hidden;
	display: flex;
	flex-direction: column;
	align-items: center;

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
		background-color: rgb(var(--dynamic-bg-color));
		opacity: .2;
		z-index: -1;
	}
}

.transparent-bg {
	background-color: transparent !important;

	&::before {
		content: '';

		background-color: transparent;

	}
}

/* bottom left, clear of the print queue that grows down the right hand side */
.theme-colors {
	position: absolute;
	bottom: 18px;
	left: 25px;
	z-index: 1;
}

.github-link:hover {
	transform: scale(1.1);
}

.printer-panel {
	position: absolute;
	top: 25px;
	right: 25px;
	z-index: 1;
}

.printer-variant-settings {
	position: absolute;
	display: flex;
	flex-direction: row;
	align-items: center;
	top: 25px;
	left: 25px;
	gap: 15px;
	z-index: 1;
}
/* the corner controls above sit at z-index 1; the editor stays below them

   the editor is the only scroll container: it fills the fixed app area and
   scrolls when the polaroid plus its settings panel do not fit. min-height: 0
   is what allows a flex item to shrink below its content and actually scroll */
.editor {
	display: flex;
	flex-direction: column;
	flex: 1;
	min-height: 0;
	width: 100%;
	overflow-y: auto;
	overflow-x: hidden;
}

@media only screen and (max-width: 600px) {

	.printer-variant-settings,
	.theme-colors {
		display: none !important;
	}
}
</style>
