<template>
	<div class="status-card">
		<div class="image-status">

			<!-- image to be printed -->
			<img :src="element.thumbnail" draggable="false" height="90" alt="Queued polaroid" />

			<div class="image-status-info">

				<div class="status-text" data-testid="status-text">
					<span v-if="element.state > QUEUE_STATE.QUEUED && element.state < QUEUE_STATE.FAILED && isCanceling == true" class="status-label">Cancelling…</span>
					<span v-else-if="element.state == QUEUE_STATE.QUEUED" class="status-label">In queue</span>
					<span v-else-if="element.state == QUEUE_STATE.SENDING" class="status-label">Sending…</span>
					<span v-else-if="element.state == QUEUE_STATE.FAILED" class="status-label failed-text">Failed</span>
					<span v-else-if="element.state == QUEUE_STATE.PRINTING" class="status-label">Printing
						<span>{{ copyCount }}</span>
					</span>

					<!-- the dialog is dismissable, so the way back to printing has to live
						 on the card itself rather than only in the dialog. An icon rather
						 than a label: a word here widened the whole panel whenever a print
						 failed, since the card sizes the printer panel -->
					<LoadingButton v-if="element.state == QUEUE_STATE.FAILED" :icon="retryIcon" :iconSize="18"
								   class="queue-icon-button retry-button" data-testid="queue-retry-button"
								   aria-label="Try printing this image again"
								   title="Try printing this image again" v-on:click="emit('retry')" />

					<!-- download the framed keepsake, which is not what gets printed -->
					<LoadingButton :loading="preparingDownload" :icon="downloadIcon" :iconSize="18"
								   class="queue-icon-button" data-testid="queue-download-button"
								   aria-label="Download this polaroid" title="Download this polaroid"
								   v-on:click="downloadPolaroidEvent()" />

					<!-- remove/cancel button -->
					<CloseButton class="remove-button" :class="isCanceling ? 'disabled' : ''" tone="plain"
								 :size="34" testid="canceling-button" label="Cancel printing this image"
								 title="Cancel printing this image" v-on:click="cancelPrinting()" />
				</div>


				<!-- The caption is not printed, so it serves as the title here. Always
					 rendered rather than conditional: the row holds its height either
					 way, so a photo with a caption and one without are the same card
					 with different text in it. -->
				<div class="queue-caption" data-testid="queue-caption" :title="caption || undefined">
					{{ caption }}
				</div>

				<div v-if="canChooseCopies" class="print-quantity" data-testid="quantity-setter">

					<!-- decrease input -->
					<button type="button" data-testid="quantity-button-minus"
							v-on:click="modifyQuantity(element.quantity - 1)"
							:class="element.quantity <= minimumCopies ? 'disabled' : ''"
							class="quantity-icon-button" aria-label="Print one copy fewer" title="Print one copy fewer">
						<span class="quantity-mark minus" aria-hidden="true" />
					</button>


					<input data-testid="quantity-input-field" aria-label="Number of copies to print"
						   v-model="quantityInput" v-on:keyup.enter="verifyQuantityInput"
						   v-on:blur="verifyQuantityInput" class="quantity-input" type="number" pattern="\d*"
						   :min="minimumCopies" :max="10" />

					<!-- increase button -->
					<button type="button" data-testid="quantity-button-plus"
							v-on:click="modifyQuantity(element.quantity + 1)" :class="element.quantity >= 10 ? 'disabled' : ''"
							class="quantity-icon-button" aria-label="Print one more copy" title="Print one more copy">
						<span class="quantity-mark plus" aria-hidden="true" />
					</button>


				</div>
			</div>
		</div>


		<!-- Sending and printing, as two bars with a step between them. It stays on
			 show after a failure: which bar stopped short is what says whether the
			 printer ever received the image or had it and refused to print. -->
		<div v-if="element.state > QUEUE_STATE.QUEUED" class="printing-status-progress"
			 :class="{ failed: element.state == QUEUE_STATE.FAILED }" data-testid="printing-progress">

			<div class="progress-bar" data-testid="printing-progress-sending">
				<div class="progress" :style="`width: ${sendingProgress}%`" />
			</div>

			<div data-testid="printing-progress-step" class="progress-step"
				 :style="sendingProgress < 100 ? 'background-color: rgb(var(--light-grey-color))!important' : ''" />

			<div data-testid="printing-progress-printing" class="progress-bar">
				<!-- The creep is a keyframe animation rather than a width transition, and
					 it is keyed to the copy so each sheet restarts it from where the last
					 one finished. A transition towards a value set a copy ahead meant the
					 bar read as finished before the sheet appeared, and ran *backwards*
					 over fifteen seconds when a print failed. Without `running` the bar
					 is simply drawn at what has actually come out. -->
				<div v-if="phase === QUEUE_STATE.PRINTING" :key="`${copiesDone}-${element.quantity}`"
					 id="printProgress"
					 class="progress progress-print" :class="{ running: isPrinting }"
					 :style="sheetStyle" />
			</div>
		</div>

	</div>
</template>


<script lang="ts" setup>
import { computed, onBeforeUnmount, ref, watch } from 'vue';
import { QUEUE_STATE, type QueueImage } from '../../interfaces/QueueImage';
import LoadingButton from '../controls/LoadingButton.vue';
import CloseButton from '../controls/CloseButton.vue';
import { PRINT_DURATION } from '../../api/instax';
import downloadIcon from '@/assets/icons/controls/download.svg';
import retryIcon from '@/assets/icons/controls/retry.svg';
import { downloadDataUrl, polaroidFilename, polaroidFromPrintImage } from '../../cropper/cropper.download';

const emit = defineEmits<{
	(e: 'cancel'): void;
	(e: 'quantity-change', quantity: number): void;
	(e: 'retry'): void;
}>()

const props = defineProps<{
	element: QueueImage;
}>();


const quantityInput = ref(props.element.quantity ?? 1);
const isCanceling = ref(false);
const preparingDownload = ref(false);

const caption = computed(() => props.element.caption?.trim() ?? '');

/**
 * Which of the two phases the bars should describe.
 *
 * For a failed photo that is the phase it got to, not FAILED itself - otherwise
 * the bars have nothing to say about where it stopped.
 */
const phase = computed(() => props.element.state === QUEUE_STATE.FAILED
	? (props.element.failedAt ?? QUEUE_STATE.SENDING)
	: props.element.state);

/** Full once the transfer is behind us, however the photo ended up. */
const sendingProgress = computed(() =>
	phase.value === QUEUE_STATE.SENDING ? props.element.progress : 100);

/**
 * Everything the printing bar needs, worked out together.
 *
 * Deliberately one computed rather than several. The elapsed time comes from
 * `Date.now()`, which is not reactive - so on its own it was only ever recomputed
 * when the sheet changed, and a change to the number of copies reissued the
 * animation with a stale elapsed value. Going from three copies back to one left
 * the bar at the start of a sheet that was half done. Reading the copies here
 * means this recomputes exactly when the bounds do, and the clock is read fresh
 * at that moment.
 */
const sheetStyle = computed(() => {
	const quantity = Math.max(1, props.element.quantity);
	const done = copiesDone.value;

	const from = (done / quantity) * 100;
	const to = (Math.min(done + 1, quantity) / quantity) * 100;

	const startedAt = props.element.copyStartedAt;
	const elapsed = startedAt != null && isPrinting.value
		? Math.min(Math.max(0, Date.now() - startedAt), PRINT_DURATION)
		: 0;

	return {
		minWidth: '10px',
		width: `${from}%`,
		'--sheet-from': `${from}%`,
		'--sheet-to': `${to}%`,
		'--sheet-duration': `${PRINT_DURATION}ms`,
		'--sheet-elapsed': `-${elapsed}ms`
	};
});

const copiesDone = computed(() => props.element.printedCopies ?? 0);

/** A sheet is only on its way while the photo is actually printing. */
const isPrinting = computed(() => props.element.state === QUEUE_STATE.PRINTING);

/**
 * Which copy of how many, counted from the printer rather than from the bar.
 *
 * Derived from the bar's own width, this read as finished the moment printing
 * began, because that width was aimed a copy ahead.
 */
const copyCount = computed(() => {
	const quantity = Math.max(1, props.element.quantity);
	const current = Math.min(copiesDone.value + 1, quantity);

	return `${current}/${quantity}`;
});

/** How long before the last sheet lands that the copies stop being adjustable. */
const COPIES_SETTLE_LEAD = 2500;

/**
 * True once the print is too far along for the count to be worth changing.
 *
 * The print command is issued once per copy, so the number can be changed right
 * up until the last one is on its way - which is why the controls stay up through
 * sending, printing and a failure, rather than disappearing the moment the image
 * went over. They only go once the final sheet is nearly out.
 */
const copiesSettled = ref(false);
let settleTimer: ReturnType<typeof setTimeout> | null = null;

watch(
	() => [props.element.state, props.element.printedCopies ?? 0, props.element.quantity] as const,
	([state, printed, quantity]) => {
		if (settleTimer != null) clearTimeout(settleTimer);
		copiesSettled.value = false;

		// only while the last copy of all is actually running
		if (state !== QUEUE_STATE.PRINTING || printed < quantity - 1) return;

		settleTimer = setTimeout(
			() => { copiesSettled.value = true },
			Math.max(0, PRINT_DURATION - COPIES_SETTLE_LEAD)
		);
	},
	{ immediate: true }
);

onBeforeUnmount(() => {
	if (settleTimer != null) clearTimeout(settleTimer);
});

const canChooseCopies = computed(() => !copiesSettled.value);

/**
 * The fewest copies that can still be asked for.
 *
 * Sheets that have come out cannot be unmade, and nor can the one on its way - so
 * five copies with the second printing can only come down to two.
 */
const minimumCopies = computed(() => {
	const printed = props.element.printedCopies ?? 0;

	return props.element.state === QUEUE_STATE.PRINTING
		? Math.max(1, printed + 1)
		: Math.max(1, printed);
});

// the queue only keeps the photo that went to the printer, so the frame, caption
// and film filter are applied now rather than rendered twice up front
async function downloadPolaroidEvent(): Promise<void> {
	if (preparingDownload.value) return;

	preparingDownload.value = true;
	try {
		const polaroid = await polaroidFromPrintImage(props.element.type, caption.value, props.element.base64);
		downloadDataUrl(polaroid, polaroidFilename(caption.value));
	} catch (error) {
		console.error('> could not build the polaroid for download', error);
	} finally {
		preparingDownload.value = false;
	}
}


watch(quantityInput, () => modifyQuantity(quantityInput.value));

watch(() => props.element.quantity, () => {
	let quanValue = props.element.quantity;
	if (quanValue > 10) quanValue = 10;
	// else if (quanValue <= 0) quanValue = 1;

	quantityInput.value = quanValue;
})

function verifyQuantityInput(): void {
	if (quantityInput.value <= minimumCopies.value) quantityInput.value = minimumCopies.value
	if (quantityInput.value > 10) quantityInput.value = 10;

	(document.activeElement as HTMLInputElement)?.blur()
}
function cancelPrinting(): void {
	isCanceling.value = true;
	emit('cancel')
}

function modifyQuantity(value: number): void {
	emit('quantity-change', value)
}
</script>


<style scoped>
/* one label, one size, whatever the state: this used to be set smaller than the
   others, so the row changed height as a photo moved through the queue */
.status-label {
	flex: 1 1 auto;
	min-width: 0;
	overflow: hidden;
	text-overflow: ellipsis;
	white-space: nowrap;
}

.failed-text {
	color: rgb(var(--error-color));
	font-weight: 500;
}

/* the dialog can be dismissed, and then this is the only way back to printing.
   It carries no colour of its own: it is the download button's twin, so it takes
   .queue-icon-button whole and only sits a little clear of it */
.retry-button {
	margin-right: 4px;
}

/* a failed photo is not in flight, so its bars sit back rather than reading as
   something still happening */
.printing-status-progress.failed {
	opacity: .55;
}

.progress-bar {
	background-color: rgb(var(--light-grey-color));
	width: calc(100%/2);
	height: 10px;

	border-radius: 5px
}

.progress {

	/* background-color: red; */
	border-radius: 5px;
	min-width: 10px;
	height: 10px;
	position: relative;
	overflow: hidden;
	background-color: rgb(var(--dynamic-bg-color));

}

.progress-print {
	background-color: rgb(var(--dynamic-bg-color)) !important;
}

/* Only while a sheet is actually coming out: a stopped bar is drawn at the figure
   it reached and stays there.

   The negative delay picks the animation up part way, which is how the creep
   survives a change to the number of copies: the keyframes are reissued with new
   bounds, and this puts the playhead back where the sheet actually is. */
.progress-print.running {
	animation: print-sheet var(--sheet-duration, 15s) linear var(--sheet-elapsed, 0ms) forwards;
}

@keyframes print-sheet {
	from {
		width: var(--sheet-from, 0%);
	}

	to {
		width: var(--sheet-to, 100%);
	}
}

@media (prefers-reduced-motion: reduce) {
	.progress-print.running {
		animation: none;
	}
}


.progress-step {

	background-color: rgb(var(--dynamic-bg-color));

	width: 12px !important;
	height: 10px !important;
	margin-left: 5px;
	border-radius: 50%;
	margin-right: 5px;
}

.print-quantity {
	display: flex;
	flex-direction: row;
	align-items: center;
}


.quantity-icon-button {
	position: relative;
	width: 34px;
	height: 34px;
	border-radius: 50%;
	background-color: rgb(var(--dynamic-bg-color));
	opacity: .75;
	transition: opacity 150ms ease-in-out;
}

/* The handwriting belongs on the polaroid, not in a list: here the caption is a
   title, and reads as one in the app's own face.

   The line is kept whether or not there is anything on it, so the cards in a
   queue line up rather than each being as tall as its own text. */
.queue-caption {
	max-width: 100%;
	width: 100%;
	min-height: 17px;
	line-height: 17px;
	overflow: hidden;
	text-overflow: ellipsis;
	white-space: nowrap;
	font-size: 14px;
	font-weight: 500;
	color: rgb(var(--black-color));
}

.queue-icon-button {
	width: 32px;
	height: 32px;
	min-width: 32px;
	padding: 0;
	flex: none;
	border-radius: 50%;
	margin-right: 4px;
	color: white;
}

/* a little more to aim at where there is no mouse */
@media (pointer: coarse) {

	.queue-icon-button,
	.quantity-icon-button,
	.remove-button {
		width: 38px;
		height: 38px;
		min-width: 38px;
	}
}

.queue-icon-button:focus-visible,
.quantity-icon-button:focus-visible,
.remove-button:focus-visible {
	outline: 2px solid rgb(var(--dynamic-bg-color));
	outline-offset: 2px;
}

/* masked rather than an <img>: both icons ship with a grey placeholder fill,
   which is what left them looking washed out on a button in the theme colour */
.quantity-mark {
	position: absolute;
	top: 50%;
	left: 50%;
	width: 16px;
	height: 16px;
	transform: translate(-50%, -50%);
	background-color: #ffffff;
	opacity: .9;
}

.quantity-mark.minus {
	-webkit-mask: url('@/assets/icons/printer/minus.svg') center / contain no-repeat;
	mask: url('@/assets/icons/printer/minus.svg') center / contain no-repeat;
}

.quantity-mark.plus {
	-webkit-mask: url('@/assets/icons/printer/plus.svg') center / contain no-repeat;
	mask: url('@/assets/icons/printer/plus.svg') center / contain no-repeat;
}


.disabled {
	opacity: .3 !important;
	cursor: not-allowed !important;
	pointer-events: none;
}

.quantity-icon-button:hover .quantity-mark {
	opacity: 1;
}

.quantity-icon-button:hover {
	opacity: 1;
	box-shadow: 0px 0px 5px rgba(0, 0, 0, .05);

}

.quantity-input {
	height: 32px;
	outline: none;
	border: none;
	font-size: 15px;
	text-align: CENTER;
	width: 40px;
	border-radius: 5px;
	margin-left: 5px;
	margin-right: 5px;
	background-color: rgb(var(--light-grey-color));
	opacity: .75;
	transition: opacity 150ms ease-in-out;
}

.quantity-input:focus-visible {
	outline: 2px solid rgb(var(--dynamic-bg-color));
	outline-offset: -2px;
}

.quantity-input:hover {
	opacity: 1;
}

input::-webkit-outer-spin-button,
input::-webkit-inner-spin-button {
	/* display: none; <- Crashes Chrome on hover */
	-webkit-appearance: none;
	margin: 0;
	/* <-- Apparently some margin are still there even though it's hidden */
}

/* input[type=number] {
	: textfield;
} */


.status-card {
	position: relative;
	background-color: #fafafacc;
	border-radius: 10px;
	padding: 10px;
	margin-top: 15px;
	transition: all 150ms ease-in-out;
}

.status-card:hover {
	background-color: #fafafacc;
}

.image-status {
	display: flex;
	flex-direction: row;
	align-items: start;
	gap: 20px
}

.image-status img {
	border-radius: 8px;
}

.image-status-info {
	width: calc(100% - 60px);
	/* without this a long caption grows the column rather than being cut short:
	   a flex item's default min-width is its content */
	min-width: 0;
	display: flex;
	flex-direction: column;
	align-items: start;
	justify-content: start;
	/* min rather than a fixed height: the column holds a caption, the controls and
	   the copy counter, which together need more than 80px. Pinned to it, the
	   counter spilled out of the box - fine on its own, but once the progress bar
	   appeared below it the two sat on top of each other and the counter looked as
	   though it had disappeared the moment a photo started sending. */
	min-height: 80px;
	gap: 12px;
	position: relative;
}

.status-text {
	color: #a0a0a0;
	display: flex;
	flex-direction: row;
	align-items: center;
	width: 100%;
	justify-content: space-between;
}

.remove-button {
	flex: none;
}



.printing-status-progress {
	position: relative;
	width: 100%;
	display: flex;
	flex-direction: row;
	margin-top: 10px;
}
</style>