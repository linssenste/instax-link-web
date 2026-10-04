<template>
	<ModalDialog :open="error != null" title="An error occurred" testid="print-error-dialog" compact
				 v-on:close="$emit('close')">

		<div class="body">
			<p class="lead">{{ headline }}</p>

			<p class="advice">{{ advice }}</p>

			<!-- the printer's own words, because a fault this app has not learned to
				 name is still worth being able to report -->
			<p v-if="bytes" class="detail" data-testid="print-error-detail">{{ bytes }}</p>
		</div>

		<template #footer>
			<!-- closing this leaves the photo on the queue, so the only thing worth a
				 button is the one that does not: giving up on it -->
			<button type="button" class="discard" data-testid="print-error-discard"
					v-on:click="$emit('discard')">
				Remove image
			</button>
			<LoadingButton label="Try again" class="retry" data-testid="print-error-retry"
						   v-on:click="$emit('retry')" />
		</template>
	</ModalDialog>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import ModalDialog from '../controls/ModalDialog.vue';
import LoadingButton from '../controls/LoadingButton.vue';
import type { InstaxPrintError } from '../../api/instax.errors';

const props = defineProps<{ error: InstaxPrintError | null }>();

defineEmits<{ (e: 'close'): void; (e: 'retry'): void; (e: 'discard'): void }>();

/**
 * What happened, in the printer's terms.
 *
 * The counter and the pack can disagree - reseating a pack sets the count back
 * to a full one whether or not there is film in it - so an empty pack is the
 * first thing to suggest whenever the printer took the command and then did not
 * produce a photo.
 */
const headline = computed<string>(() => {
	switch (props.error?.reason) {
		case 'busy': return 'The printer is still getting ready.';
		case 'refused': return 'The printer turned the print down.';
		case 'reported': return 'The printer stopped part way through.';
		case 'not-printed': return 'The printer never used a sheet.';
		case 'silent': return 'The printer stopped answering.';
		default: return 'The print did not go through.';
	}
});

/** Each ends on where the photo now is, because that is the next thing asked. */
const advice = computed<string>(() => {
	switch (props.error?.reason) {
		case 'not-printed':
		case 'reported':
			return 'The pack is most likely empty. Reseating a pack sets the counter back to a full one, '
				+ 'so the printer can show shots it does not have. The photo stays on the queue.';
		case 'busy':
			return 'It has been setting the film pack up for a while now. Check the pack is seated '
				+ 'properly, then try again. The photo stays on the queue.';
		case 'refused':
			return 'Check that there is a film pack in the printer and that the cover is shut. '
				+ 'The photo stays on the queue.';
		case 'silent':
			return 'Check the printer is still on and in range, then reconnect. '
				+ 'The photo stays on the queue.';
		default:
			return 'Check the film pack and the printer, then try again. The photo stays on the queue.';
	}
});

const bytes = computed<string>(() => props.error?.bytes ?? '');
</script>

<style scoped lang="scss">
.body {
	display: flex;
	flex-direction: column;
	gap: 10px;
	padding: 0 20px 4px;
}

.lead {
	margin: 0;
	font-size: 15px;
	font-weight: 500;
	line-height: 1.35;
}

.advice {
	margin: 0;
	font-size: 13.5px;
	line-height: 1.5;
	opacity: .7;
}

.detail {
	margin: 2px 0 0;
	padding: 8px 10px;
	border-radius: 8px;
	background-color: rgba(var(--black-color), .05);
	color: rgba(var(--black-color), .55);
	font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
	font-size: 11px;
	line-height: 1.5;
	overflow-wrap: anywhere;
}

/* only the colour is its own: the shape, height and lettering come from the
   global button rule, which is what every other button in the app is wearing.
   margin-left pushes both buttons together to the end of the footer. */
.discard {
	min-width: 120px;
	margin-left: auto;
	background-color: rgba(var(--dynamic-bg-color), .12) !important;
	color: rgb(var(--dynamic-bg-color));
	box-shadow: none !important;
}

@media (hover: hover) and (pointer: fine) {
	.discard:hover {
		background-color: rgba(var(--dynamic-bg-color), .2) !important;
	}
}

.retry {
	min-width: 120px;
	color: #ffffff;
}
</style>
