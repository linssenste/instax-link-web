<template>
	<div class="app-area" id="app-area" :class="{ 'transparent-bg': embedMode != null }">

		<!-- top-right corner: connection, printer status and the print queue -->
		<!-- v-if rather than v-show: both layouts carry the whole print queue, and
			 with v-show both were built, so every queued photo was decoded twice and
			 each had two cards with their own independent state -->
		<PrinterConnection v-if="!isMobile" class="printer-panel" :queue="imageQueue" :config="config"
			v-on:retry="retryPrintEvent" v-on:cancel="cancelQueuedEvent"
			v-on:quantity-change="quantityChangeEvent" />

		<!-- bottom-left corner: theme color selector -->
		<ThemeColorSelector v-if="!isMobile && !embedMode" class="theme-colors"
			v-on:color-change="themeChangeEvent" />

		<!-- top-left corner: polaroid size selector (if no connection) (only square size in preview mode)-->
		<div v-if="!embedMode && !isMobile" class="printer-variant-settings">
			<PolaroidSizeSelector v-if="!config.connection" v-on:type-change="typeChangeEvent" connected="square" />

		</div>

		<PolaroidEditor class="editor" v-on:image="createdImageEvent" :config="config"
			:queueLength="imageQueue.length" v-on:render-failed="renderFailedEvent" />


		<MobileOverlay v-if="isMobile" :config="config" v-on:color-change="themeChangeEvent"
			v-on:type-change="typeChangeEvent" :queue="imageQueue" v-on:retry="retryPrintEvent"
			v-on:cancel="cancelQueuedEvent" v-on:quantity-change="quantityChangeEvent" />

		<!-- a print that never came out: the photo stays on the queue behind this -->
		<PrintErrorDialog :error="printError" v-on:close="printError = null" v-on:retry="retryPrintEvent"
			v-on:discard="discardFailedPrintEvent" />

		<!-- no way out of this one: printing a square photo on mini film is not
			 something to let through, so one of the two choices has to be made -->
		<FilmMismatchDialog :mismatch="filmMismatch" v-on:clear-queue="clearMismatchedQueueEvent"
			v-on:disconnect="disconnectBluetoothPrinter" />
	</div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, onUnmounted, watch } from 'vue';

import MobileOverlay from './components/layout/MobileOverlay.vue'
import ThemeColorSelector from './components/layout/ThemeColorSelector.vue'
import PolaroidSizeSelector from './components/layout/PolaroidSizeSelector.vue';

import PolaroidEditor from './components/polaroid/PolaroidEditor.vue';
import PrinterConnection from './components/printer/PrinterConnection.vue';
import { InstaxPrinter } from './api/instax';
import { isPrintError, InstaxPrintError, type PrintFailure } from './api/instax.errors';
import { QUEUE_STATE, MAX_QUEUE_LENGTH, queueId, seedQueueIds } from './interfaces/QueueImage';
import { loadQueue, saveQueue } from './queue/queue.storage';
import PrintErrorDialog from './components/printer/PrintErrorDialog.vue';
import FilmMismatchDialog from './components/printer/FilmMismatchDialog.vue';

import { type PrinterStateConfig, InstaxFilmVariant } from './interfaces/PrinterStateConfig';

import type { QueueImage } from './interfaces/QueueImage';
import { downloadDataUrl, polaroidFilename, queueThumbnail } from './cropper/cropper.download';
import { warmCompression } from './cropper/cropper.print';


// if window smaller 1000
const isMobile = ref<boolean>(window.innerWidth < 1000);


const config = ref<PrinterStateConfig>({
	type: InstaxFilmVariant.SQUARE,
	connection: false,
	fault: false,
	preparing: false,
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

	// a fault owns the light until a command goes through, so a theme change while
	// something is wrong must not quietly say everything is fine again
	if (printError.value != null) return;

	// and not in the middle of an image. The light is cosmetic; the printer has to
	// answer this command, and that answer arriving between a packet and its
	// acknowledgement is how a transfer came to fail on a reconnect - the 1.5s
	// timer after connecting now lands while the queue is already sending
	if (isPrinting) return;

	printer.setColor([getThemeColorHex(theme)], 1, LED_REPEAT_FOREVER);
}

/**
 * Put the printer's own light into a fault state, and take it back out again.
 *
 * The light is the only feedback there is when nobody is looking at the screen,
 * so it holds the fault until something goes right rather than until the dialog
 * is dismissed.
 */
function signalFault(): void {
	config.value.fault = true;

	if (!config.value.connection || !printer) return;

	// the literal rather than --yellow-color: a fault is not themed, and reading it
	// from the stylesheet means falling back to white - which says "all clear" -
	// wherever that value has not resolved
	printer.setColor([FAULT_COLOUR], FAULT_PULSE_SPEED, LED_REPEAT_FOREVER);
}

function signalClear(): void {
	config.value.fault = false;
	themeChangeEvent();
}

// update film type (only if not automatically with printer)
function typeChangeEvent(filmType: InstaxFilmVariant): void {
	if (!config.value.connection || !printer) {
		config.value.type = filmType
	}
}


let isPrinting = false;

/**
 * How long the printer's status is allowed to go unread while idle.
 *
 * Every tick is two BLE round trips, so this is radio time and printer battery as
 * much as freshness. A second is responsive without being wasteful; below that
 * the traffic stops buying anything, since the shot count only moves when
 * something prints and that is read straight afterwards anyway.
 */
const POLL_INTERVAL = 1000;

/** `repeat` value the printer reads as "keep going". */
const LED_REPEAT_FOREVER = 255;

/** Slower than the resting pulse, so a fault reads differently across a room. */
const FAULT_PULSE_SPEED = 8;

/** Matches --yellow-color; kept as a literal because a fault is not themed. */
const FAULT_COLOUR = '#ffb601';

/** How long a finished photo stays on the queue before it is cleared away. */
const FINISHED_CARD_LINGER = 500;

/**
 * How long the printer may say it is getting ready before that is a problem.
 *
 * Setting a pack up takes a few seconds. Waiting indefinitely would mean a photo
 * retrying once a second for ever with nothing said about it.
 */
const PREPARING_PATIENCE = 30_000;

/** When the printer first said it was not ready, so patience can run out. */
let preparingSince: number | null = null;

/** Identifies the most recent status setup, so an older one cannot install a poll. */
let metaGeneration = 0;

let timeoutHandle: ReturnType<typeof setInterval> | null = null
let printer: InstaxPrinter | null = null;

/** the print that did not come out, and what the printer said about it */
const printError = ref<InstaxPrintError | null>(null);

/**
 * The shot count when the print failed.
 *
 * A failed photo waits rather than retrying on a loop, but it should not have to
 * wait for a click once the thing that was wrong has been put right. An increase
 * here is the one signal for that which cannot be mistaken for anything else: a
 * fresh pack sets the counter back up, and nothing else does.
 *
 * This used to compare the printer's whole state-byte fingerprint. Those bytes do
 * change when it faults - which is how the idea arose - but bytes 1 and 2 of them
 * are a 16-bit reading that drifts on its own, so the fingerprint differed on
 * virtually every poll and the photo was reprinted the moment the dialog closed.
 */
let countAtFailure: number | null = null;
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

	// back on screen, so read the printer at once rather than waiting a tick
	document.addEventListener('visibilitychange', visibilityEvent);

	// the worker is a module of its own; fetching and compiling it is work the
	// first print should not be waiting on
	warmCompression();

	void restoreQueue();

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
	document.removeEventListener('visibilitychange', visibilityEvent);
	if (timeoutHandle) clearInterval(timeoutHandle);
	if (printer) printer.disconnect();
})

function resize(): void  {
		isMobile.value = window.innerWidth < 1000;
	}

function visibilityEvent(): void {
	if (document.hidden || isPrinting) return;

	void getPrinterMeta();
}

function unload(event: BeforeUnloadEvent): void {
	if ((printer != null && imageQueue.value.length > 0 || isPrinting)) {
		event.returnValue = true;
	}
}


async function disconnectBluetoothPrinter(): Promise<void> {
	if (!printer) return;

	await printer.disconnect();

	// not left to the gattserverdisconnected event: if the teardown threw before
	// the link was dropped that event never arrives, and the app would go on
	// showing a connected printer with a live poll
	clearConnection();
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

	// a fault belongs to the printer that reported it: once that printer is gone
	// the report is stale, and leaving it up means the only thing on screen is a
	// dialog about a printer that is no longer there
	printError.value = null;
	config.value.fault = false;
	config.value.preparing = false;
	preparingSince = null;

	// Nothing in the queue is at fault when the printer goes away, so no photo is
	// left marked failed - a failed head blocks everything behind it, and on
	// reconnect the queue would sit there doing nothing. They go back to waiting
	// their turn instead, and heldByPrinter is dropped because the next printer
	// will not be holding anything.
	for (const photo of imageQueue.value) {
		if (photo.state === QUEUE_STATE.QUEUED) continue;

		photo.state = QUEUE_STATE.QUEUED;
		photo.progress = 0;
		photo.printedCopies = 0;
		photo.failedAt = null;
		photo.heldByPrinter = false;
		photo.abortController = null;
	}

	countAtFailure = null;

	// an interrupted run unwinds on its own, but the flag must not outlast the
	// connection or the next one would never start polling
	isPrinting = false;

	if (timeoutHandle) clearInterval(timeoutHandle)
}

/**
 * Read the printer and put the status poll back on.
 *
 * `printNow` is what makes a reconnect start printing straight away rather than
 * on the first tick. It has to be refusable: a printer that answers "not ready"
 * leaves the photo waiting and comes back through here, and kicking the queue
 * again from inside would retry immediately, fail the same way, and spin without
 * ever yielding to the poll.
 */
async function loadMetaData(printNow = true): Promise<void> {

	if (!config.value.connection || !printer || isPrinting) return;
	if (timeoutHandle) clearInterval(timeoutHandle);

	// Two overlapping calls both cleared the same handle and both started an
	// interval, and only the later handle was kept - so the earlier one polled the
	// printer for the life of the page with nothing able to stop it.
	const generation = ++metaGeneration;

	await getPrinterMeta(true);

	// a newer call, or a print that started while this was in flight, owns the
	// poll now
	if (generation !== metaGeneration || isPrinting) return;

	timeoutHandle = setInterval(async () => {
		// nothing to read for: a hidden tab is not looking at the status, and the
		// radio time comes out of the printer's battery
		if (document.hidden) return;

		await getPrinterMeta();
		resumeOnNewFilm();
		printPolaroidQueue()
	}, POLL_INTERVAL);

	// anything already waiting goes now rather than on the first tick: a queue
	// built up while the printer was away should start as soon as one is back
	if (printNow) void printPolaroidQueue();
}

async function getPrinterMeta(includeType = false): Promise<void> {

	if (!printer) return;

	try {
		const previous = config.value.status;
		const status = await printer.getInformation(includeType);

		if (includeType && status.type != null) config.value.type = status.type;

		// A command the printer does not answer comes back as null rather than
		// throwing, so a partial read used to overwrite a perfectly good status with
		// blanks - and the card falls back to "Connecting...." the moment the battery
		// level or the shot count is missing. Each field now keeps what it had until
		// the printer actually says otherwise.
		config.value.status = {
			type: status.type ?? previous?.type ?? null,
			battery: {
				// charging is only meaningful alongside a level it was read with
				charging: status.battery.level != null
					? status.battery.charging
					: (previous?.battery.charging ?? false),
				level: status.battery.level ?? previous?.battery.level ?? null
			},
			polaroidCount: status.polaroidCount ?? previous?.polaroidCount ?? null,
			filmState: status.filmState ?? previous?.filmState ?? null
		};

		if (import.meta.env.DEV) {
			const current = config.value.status;
			console.log(
				`> status connection=${config.value.connection} type=${config.value.type}`
				+ ` battery=${current.battery.level} count=${current.polaroidCount}`
				+ ` fault=${config.value.fault}`
			);
		}
	} catch (error) {
		// the card falls back to "Connecting...." whenever the status is missing, and
		// a swallowed read is the only way it can go missing while still connected
		console.error('> could not read the printer status', error);
		return
	}

}

/**
 * The queue holding photos this printer cannot print.
 *
 * Derived rather than recorded, so it clears itself the moment the cause is gone -
 * clear the queue or disconnect and there is nothing left to answer.
 *
 * A photo is rendered for the film size the editor was set to, which follows the
 * printer while one is connected, so this only arises for photos that outlived a
 * session: queued while disconnected, or restored from the last one.
 */
const filmMismatch = computed(() => {
	if (!config.value.connection) return null;

	const printerType = config.value.status?.type ?? null;
	if (printerType == null) return null;

	const wrong = imageQueue.value.filter((photo) => photo.type !== printerType);
	if (wrong.length === 0) return null;

	return { printer: printerType, queued: wrong[0].type, count: imageQueue.value.length };
});

/** Give up the photos that do not fit, which leaves the printer free to work. */
function clearMismatchedQueueEvent(): void {
	imageQueue.value = [];
	printError.value = null;
}

/**
 * Bring back whatever was still waiting when the page was last closed.
 *
 * A reload loses the Bluetooth connection - the browser will only hand one back
 * after a fresh click - so the photos come back waiting, and the panel shows them
 * as the count under the connect button until a printer is there to take them.
 */
async function restoreQueue(): Promise<void> {
	const saved = await loadQueue();
	if (saved.length === 0 || imageQueue.value.length > 0) return;

	// numbering continues above them, or a new photo would collide with a restored
	// one and everything that works by identity would confuse the two
	seedQueueIds(Math.max(...saved.map((photo) => photo.id)));

	imageQueue.value = saved;
}

/**
 * What the queue holds, as far as keeping it is concerned.
 *
 * Progress and state are deliberately absent: they change constantly while a
 * photo prints and none of it is worth writing to disk, so watching them would
 * mean a write every few milliseconds for nothing.
 */
const queueSignature = computed(() => imageQueue.value
	.map((photo) => `${photo.id}:${photo.quantity}:${photo.printedCopies ?? 0}:${photo.thumbnail.length}`)
	.join('|'));

watch(queueSignature, () => { void saveQueue(imageQueue.value); });

interface RenderedImage {
	src: string,
	download: boolean,
	caption: string,
	type: InstaxFilmVariant
}

function createdImageEvent(imageData: RenderedImage) {

	// queue for printing; the caption is not printed, so it is kept as the title
	if (imageData.download == false && config.value.connection == true) {
		// The same photo again is another copy of it, not a second queue entry. The
		// print image is a deterministic render of the editor, so an identical one
		// means nothing was changed - and a card per press, each printing one copy,
		// is not what pressing print twice means.
		// Any state, not only waiting ones: the print command is issued per copy, so
		// a photo that is already sending or printing can still take another - which
		// is the common case, since the queue starts the moment something is on it.
		const same = imageQueue.value.find((queued) => queued.base64 === imageData.src
			&& queued.type === imageData.type
			&& (queued.caption ?? '') === (imageData.caption ?? ''));

		if (same != null && same.quantity < 10) {
			same.quantity = printableQuantity(same.quantity + 1);
			return;
		}

		if (imageQueue.value.length >= MAX_QUEUE_LENGTH) return;

		const photo: QueueImage = {
			id: queueId(),
			base64: imageData.src,
			// the print image until a small copy exists, so the card shows at once
			thumbnail: imageData.src,
			quantity: 1,
			state: QUEUE_STATE.QUEUED,
			progress: 0,
			type: imageData.type,
			caption: imageData.caption
		};

		imageQueue.value.push(photo);

		// swapped in when it is ready. Deliberately not awaited: the queue must not
		// wait on a decode, and one that never finishes must cost a card its small
		// copy rather than cost the user their photo
		void queueThumbnail(imageData.src).then((thumbnail) => {
			photo.thumbnail = thumbnail;
		});
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

	// the queue is for another film size, and the dialog is waiting on an answer:
	// sending one of these to this printer is the thing being prevented
	if (filmMismatch.value != null) return;

	const status = config.value.status;
	if (status == null || status.polaroidCount == null || status.polaroidCount <= 0) return;

	const photo = imageQueue.value[0];
	if (photo == null || photo.state !== QUEUE_STATE.QUEUED) return;

	const connectedPrinter = printer;

	/** The photo is only still ours to touch while it is at the head of the queue. */
	const stillQueued = (): boolean => imageQueue.value[0]?.id === photo.id;

	// the printer kept the image from the last attempt, so a print that failed
	// after the transfer is retried as a print rather than as a whole transfer
	const resumedAtPrint = photo.heldByPrinter === true;

	try {
		isPrinting = true

		if (timeoutHandle) clearInterval(timeoutHandle);
		const controller = new AbortController();
		photo.abortController = controller;

		if (!resumedAtPrint) {
			photo.state = QUEUE_STATE.SENDING

			await connectedPrinter.sendImage(photo.base64, true, config.value.type, async (progress: number) => {
				if (!stillQueued()) return;
				if (controller.signal.aborted && progress == -1) return;

				photo.progress = progress * 100;
			}, controller.signal);
		}

		if (!controller.signal.aborted && stillQueued()) {

			// the printer has the image now, so a failed print does not need it sent
			// a second time
			photo.heldByPrinter = true;

			// finished sending --> the copies that come out are the progress now
			photo.state = QUEUE_STATE.PRINTING;
			photo.progress = 0
			photo.printedCopies = 0
			photo.copyStartedAt = Date.now()

			// a quantity of 0 or '' used to transfer the image, print nothing, raise
			// nothing and then drop the photo off the queue as though it had printed
			const quantity = printableQuantity(photo.quantity);
			photo.quantity = quantity;

			// progress is what has actually come out, nothing more. It used to be set
			// a copy ahead so a CSS transition had somewhere to creep, which made it
			// lie twice over: the bar read as finished the moment printing began, and
			// on a failure it animated *backwards* to the real figure. The creep is
			// the card's business now, not this one's.
			// the count is read per sheet, so asking for another copy while this is
			// running actually prints one
			await connectedPrinter.printImage(() => photo.quantity, (printedImages: number) => {
				if (!stillQueued()) return;

				photo.printedCopies = printedImages;
				photo.progress = (printedImages / Math.max(1, photo.quantity)) * 100;

				// whichever sheet is next starts now
				photo.copyStartedAt = Date.now();
			}, controller.signal)

			// read back after the fact rather than before: the count is wanted for
			// the panel, and nothing in the print depends on it
			await getPrinterMeta();
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

		// The printer setting a fresh pack up is not something to raise a dialog
		// about: it reports the pack's full count before it has finished, so the
		// first attempt after inserting one lands here. The photo goes back to
		// waiting and the next poll tries again, a second later.
		if (failure.reason === 'busy' && stillQueued() && config.value.connection) {
			if (preparingSince == null) preparingSince = Date.now();

			if (Date.now() - preparingSince < PREPARING_PATIENCE) {
				config.value.preparing = true;
				photo.state = QUEUE_STATE.QUEUED;
				photo.progress = 0;
				photo.abortController = null;

				isPrinting = false;
				if (timeoutHandle) clearInterval(timeoutHandle);

				// the next poll tries again, a second from now - retrying from here
				// would fail the same way without ever letting the clock move
				loadMetaData(false);
				return;
			}

			// long enough that something else is wrong after all
			console.warn('> the printer has been getting ready for too long');
		}

		config.value.preparing = false;
		preparingSince = null;

		console.error('> print failed', failure.detail, error);

		// not reported if the printer has already gone: a transfer fails *because*
		// the link dropped, and that report arrives after clearConnection has run -
		// so clearing the error there is not enough on its own. The connection panel
		// already says the printer is gone, which is the more useful message
		// one at a time. A failure often brings a second along behind it, and two
		// stacked dialogs about the same print are worse than one
		if (config.value.connection && printError.value == null) printError.value = failure;

		signalFault();

		// FAILED, not QUEUED: the poller below picks up anything queued, and
		// would send this straight back to the printer that just refused it
		if (stillQueued()) {
			// the phase and its progress are both kept: zeroing them threw away the
			// one thing that says whether the printer ever got the image
			photo.failedAt = photo.state;

			photo.state = QUEUE_STATE.FAILED;
			photo.abortController = null;

			// a resumed print that failed again may mean the printer no longer has
			// the image, so the attempt after this one starts over with the transfer
			if (resumedAtPrint) photo.heldByPrinter = false;
		}

		// Read the printer again before taking the baseline. Its state bytes change
		// when it faults, and the reading held here is from before the print was
		// attempted - so the baseline was guaranteed stale, the very next poll looked
		// like a pack change, and closing the dialog let the photo be picked straight
		// back up and fail again.
		// read the printer again before taking the baseline, so it is the count as it
		// stands after the failure rather than the one from before the print
		await getPrinterMeta();
		countAtFailure = config.value.status?.polaroidCount ?? null;

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
function printableQuantity(value: unknown, floor = 1): number {
	const count = Math.floor(Number(value));
	const lowest = Math.max(1, floor);

	if (!Number.isFinite(count) || count < lowest) return lowest;
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

/**
 * Keep the copies the card asks for inside what the printer will accept.
 *
 * The floor is what has already come out, plus the one on its way: those sheets
 * exist and asking for fewer than that cannot unmake them.
 */
function quantityChangeEvent(id: number, quantity: number): void {
	const photo = imageQueue.value.find((queued) => queued.id === id);
	if (photo == null) return;

	const printed = photo.printedCopies ?? 0;
	const floor = photo.state === QUEUE_STATE.PRINTING ? printed + 1 : printed;

	photo.quantity = printableQuantity(quantity, floor);
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
	// not while the user is being shown the failure: picking the photo back up
	// behind an open dialog is how a second one came to appear on top of it
	if (printError.value != null) return;

	const pending = imageQueue.value[0];
	if (pending == null || pending.state !== QUEUE_STATE.FAILED) return;

	const count = config.value.status?.polaroidCount;
	if (count == null || count <= 0) return;

	// an increase only, and only against the count read after the failure
	if (countAtFailure == null || count <= countAtFailure) return;

	countAtFailure = count;
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
	// long enough to see the bar reach the end, and no longer
	await new Promise((r) => setTimeout(r, FINISHED_CARD_LINGER));

	// by identity: an unconditional shift() here would take whichever photo had
	// moved up in the meantime, not the one that just printed
	removeFromQueue(id);

	isPrinting = false;
	if (timeoutHandle) clearInterval(timeoutHandle);

	// a photo came out, so the printer's light goes back to the theme colour
	printError.value = null;
	config.value.preparing = false;
	preparingSince = null;
	signalClear();

	// Hand straight on to the next photo instead of waiting to be polled. This
	// used to fall back to the 2s interval - and the interval re-read the printer
	// before looking at the queue - so the next photo sat showing IN QUEUE for
	// well over two seconds after the finished one vanished. printPolaroidQueue
	// claims the photo synchronously, so by the time this returns the card already
	// reads SENDING.
	void printPolaroidQueue();

	// nothing took it on, so the poll goes back to being the status refresh
	if (!isPrinting) loadMetaData();
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
