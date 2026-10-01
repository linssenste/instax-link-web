<template>
	<div class="app-area" id="app-area" :class="{ 'transparent-bg': embedMode != null }">

		<!-- top-right corner: connection, printer status and the print queue -->
		<PrinterConnection v-show="!isMobile" class="printer-panel" :queue="imageQueue" :config="config"
			v-on:retry="retryPrintEvent" v-on:cancel="cancelQueuedEvent"
			v-on:quantity-change="quantityChangeEvent" />

		<!-- bottom-left corner: theme color selector -->
		<ThemeColorSelector v-show="!isMobile" v-if="!embedMode" class="theme-colors"
			v-on:color-change="themeChangeEvent" />

		<!-- top-left corner: polaroid size selector (if no connection) (only square size in preview mode)-->
		<div v-if="!embedMode && !isMobile" class="printer-variant-settings">
			<PolaroidSizeSelector v-if="!config.connection" v-on:type-change="typeChangeEvent" connected="square" />

		</div>

		<PolaroidEditor class="editor" v-on:image="createdImageEvent" :config="config"
			:queueLength="imageQueue.length" v-on:render-failed="renderFailedEvent" />


		<MobileOverlay v-show="isMobile" :config="config" v-on:color-change="themeChangeEvent"
			v-on:type-change="typeChangeEvent" :queue="imageQueue" v-on:retry="retryPrintEvent"
			v-on:cancel="cancelQueuedEvent" v-on:quantity-change="quantityChangeEvent" />

		<!-- a print that never came out: the photo stays on the queue behind this -->
		<PrintErrorDialog :error="printError" v-on:close="printError = null" v-on:retry="retryPrintEvent"
			v-on:discard="discardFailedPrintEvent" />
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
import { isPrintError, InstaxPrintError, type PrintFailure } from './api/instax.errors';
import { QUEUE_STATE, MAX_QUEUE_LENGTH, queueId } from './interfaces/QueueImage';
import PrintErrorDialog from './components/printer/PrintErrorDialog.vue';

import { type PrinterStateConfig, InstaxFilmVariant } from './interfaces/PrinterStateConfig';

import type { QueueImage } from './interfaces/QueueImage';
import { downloadDataUrl, polaroidFilename } from './cropper/cropper.download';
import { warmCompression } from './cropper/cropper.print';


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
function typeChangeEvent(filmType: InstaxFilmVariant): void {
	if (!config.value.connection || !printer) {
		config.value.type = filmType
	}
}


let isPrinting = false;

let timeoutHandle: ReturnType<typeof setInterval> | null = null
let printer: InstaxPrinter | null = null;

/** the print that did not come out, and what the printer said about it */
const printError = ref<InstaxPrintError | null>(null);

/**
 * What the printer's film looked like when the print failed.
 *
 * A failed photo waits rather than retrying on a loop, but it should not have to
 * wait for a click when the thing that was wrong has visibly been put right. This
 * is the reading to compare against: when it changes, a pack has been in or out.
 */
let filmStateAtFailure: string | null = null;
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

	// the worker is a module of its own; fetching and compiling it is work the
	// first print should not be waiting on
	warmCompression();

	// the failure dialog needs an empty film pack to show itself, which is a poor
	// way to look at its styling, so while developing it can just be asked for
	if (import.meta.env.DEV) {
		(window as unknown as { printError: (reason?: PrintFailure | null, status?: number) => void })
			.printError = (reason = 'not-printed', status = 0x09) => {
				printError.value = reason == null
					? null
					: new InstaxPrintError(reason, 'Simulated failure', status, [0x01, 0xff]);
			};

		console.log(
			"> printError('not-printed' | 'reported' | 'refused' | 'silent') shows the print failure dialog,"
			+ ' printError(null) hides it'
		);
	}

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

		// a handle on the live printer while developing, so the protocol can be
		// questioned from the console without wiring a control into the UI
		if (import.meta.env.DEV) (window as unknown as { instax: unknown }).instax = printer;

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
		resumeOnNewFilm();
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
		if (imageQueue.value.length >= MAX_QUEUE_LENGTH) return;

		imageQueue.value.push({
			id: queueId(),
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


/**
 * Send and print the photo at the head of the queue.
 *
 * The photo is held by identity rather than by position throughout. The queue is
 * mutated from the front, so `imageQueue[0]` after an await is not necessarily the
 * photo this run started on - it is whichever one has since slid into the slot -
 * and acting on that is how a cancel mid-print used to take the wrong photo off.
 */
async function printPolaroidQueue(): Promise<void> {
	if (printer == null) return;

	const status = config.value.status;
	if (status == null || status.polaroidCount == null || status.polaroidCount <= 0) return;

	const photo = imageQueue.value[0];
	if (photo == null || photo.state !== QUEUE_STATE.QUEUED) return;

	const connectedPrinter = printer;

	/** The photo is only still ours to touch while it is at the head of the queue. */
	const stillQueued = (): boolean => imageQueue.value[0]?.id === photo.id;

	try {
		isPrinting = true

		if (timeoutHandle) clearInterval(timeoutHandle);
		photo.state = QUEUE_STATE.SENDING
		const controller = new AbortController();
		photo.abortController = controller;

		await connectedPrinter.sendImage(photo.base64, true, config.value.type, async (progress: number) => {
			if (!stillQueued()) return;
			if (controller.signal.aborted && progress == -1) return;

			photo.progress = progress * 100;
		}, controller.signal);

		if (!controller.signal.aborted && stillQueued()) {

			// finished sending --> starting print progress (now printed images are the progress)
			photo.state = QUEUE_STATE.PRINTING;
			photo.progress = 0

			await new Promise((r) => setTimeout(r, 1000));

			await getPrinterMeta(); // update printer information once
			await new Promise((r) => setTimeout(r, 250));

			// a quantity of 0 or '' used to transfer the image, print nothing, raise
			// nothing and then drop the photo off the queue as though it had printed
			const quantity = printableQuantity(photo.quantity);
			photo.quantity = quantity;
			photo.progress = (1 / quantity) * 100; // initialize progress to start transition

			// begin printing commands
			await connectedPrinter.printImage(quantity, (printedImages: number) => {
				if (!stillQueued()) return;

				if (printedImages < quantity) {
					photo.progress = (((printedImages + 1) / quantity) * 100)
				}
			}, controller.signal)

		}

	} catch (error) {
		// a print that did not come out is the printer's answer, not a glitch to
		// retry through: sending it again only makes it blink again, and dropping
		// the photo off the queue would make the user build it a second time.
		//
		// Anything else that goes wrong is treated the same way. It used to fall
		// through to finishUpPrinting below, which took the photo off the queue with
		// nothing said at all - so a printer switched off mid-print simply ate it.
		const failure = isPrintError(error)
			? error
			: new InstaxPrintError('silent', 'The print could not be completed');

		console.error('> print failed', failure.detail, error);
		printError.value = failure;

		// FAILED, not QUEUED: the poller below picks up anything queued, and
		// would send this straight back to the printer that just refused it
		if (stillQueued()) {
			photo.state = QUEUE_STATE.FAILED;
			photo.progress = 0;
			photo.abortController = null;
		}

		filmStateAtFailure = config.value.status?.filmState ?? null;

		isPrinting = false;
		if (timeoutHandle) clearInterval(timeoutHandle);
		loadMetaData();
		return;
	}

	finishUpPrinting(photo.id)
}

/**
 * The photo could not be rendered, so there is nothing to queue.
 *
 * This used to be a console line and a spinner that simply stopped, which from
 * the outside is the same as the button not working.
 */
function renderFailedEvent(): void {
	printError.value = new InstaxPrintError('silent', 'The photo could not be prepared for printing');
}

/** At least one copy, at most ten, whatever the field currently holds. */
function printableQuantity(value: unknown): number {
	const count = Math.floor(Number(value));
	if (!Number.isFinite(count) || count < 1) return 1;
	return Math.min(count, 10);
}

/** Take a photo off the queue, wherever it has got to by now. */
function removeFromQueue(id: number): void {
	const at = imageQueue.value.findIndex((queued) => queued.id === id);
	if (at >= 0) imageQueue.value.splice(at, 1);
}

/** The card's × button: stop the print if it is running, then drop the photo. */
function cancelQueuedEvent(id: number): void {
	const photo = imageQueue.value.find((queued) => queued.id === id);
	if (photo == null) return;

	// aborting a transfer lets sendImage wind the printer down cleanly; the photo
	// is then removed by the run that owned it
	if (photo.state === QUEUE_STATE.SENDING || photo.state === QUEUE_STATE.PRINTING) {
		photo.abortController?.abort();
		return;
	}

	if (printError.value != null && imageQueue.value[0]?.id === id) printError.value = null;
	removeFromQueue(id);
}

/** Keep the copies the card asks for inside what the printer will accept. */
function quantityChangeEvent(id: number, quantity: number): void {
	const photo = imageQueue.value.find((queued) => queued.id === id);
	if (photo != null) photo.quantity = printableQuantity(quantity);
}

/**
 * Pick a failed photo back up once the film has visibly been dealt with.
 *
 * Only on a change: the reading is compared, never interpreted, so putting a pack
 * in and taking it out again counts as much as loading a fresh one. If the print
 * fails a second time it simply lands back here against the new reading, so this
 * cannot become the reprint loop it exists to avoid.
 */
function resumeOnNewFilm(): void {
	const pending = imageQueue.value[0];
	if (pending == null || pending.state !== QUEUE_STATE.FAILED) return;

	const status = config.value.status;
	if (status == null || status.filmState == null) return;
	if (status.filmState === filmStateAtFailure) return;
	if ((status.polaroidCount ?? 0) <= 0) return;

	filmStateAtFailure = status.filmState;
	printError.value = null;
	pending.state = QUEUE_STATE.QUEUED;
	pending.progress = 0;
}

/** Put the photo that failed back through, once the film has been seen to. */
async function retryPrintEvent(): Promise<void> {
	const pending = imageQueue.value[0];
	if (pending == null || pending.state !== QUEUE_STATE.FAILED) {
		printError.value = null;
		return;
	}

	await getPrinterMeta();

	// printPolaroidQueue turns straight back round when the printer says it has
	// nothing to print on, and a retry that quietly does nothing would leave the
	// photo sitting in the queue with no sign of why
	if ((config.value.status?.polaroidCount ?? 0) <= 0) {
		printError.value = new InstaxPrintError('refused', 'The printer is reporting no film left');
		return;
	}

	printError.value = null;
	pending.state = QUEUE_STATE.QUEUED;
	pending.progress = 0;

	await printPolaroidQueue();
}

/** Give up on the photo that failed and take it off the queue. */
function discardFailedPrintEvent(): void {
	printError.value = null;

	const failed = imageQueue.value[0];
	if (failed?.state === QUEUE_STATE.FAILED) removeFromQueue(failed.id);
}

async function finishUpPrinting(id: number) {
	await new Promise((r) => setTimeout(r, 500));

	// by identity: an unconditional shift() here would take whichever photo had
	// moved up in the meantime, not the one that just printed
	removeFromQueue(id);

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
		opacity: .25;
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
	top: var(--panel-inset);
	right: var(--panel-inset);
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
