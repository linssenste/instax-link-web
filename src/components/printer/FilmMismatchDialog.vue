<template>
	<ModalDialog :open="mismatch != null" title="Wrong film" testid="film-mismatch-dialog" compact
				 :dismissible="false">

		<div class="body">
			<p class="lead">
				This printer takes {{ filmName(mismatch?.printer) }} film, and the queue is holding
				{{ filmName(mismatch?.queued) }}.
			</p>

			<p class="advice">
				Nothing can be printed until that is settled: a photo made for one film size does not
				fit another.
			</p>
		</div>

		<template #footer>
			<button type="button" class="disconnect" data-testid="film-mismatch-disconnect"
					v-on:click="$emit('disconnect')">
				Disconnect
			</button>
			<LoadingButton :label="clearLabel" class="clear" data-testid="film-mismatch-clear"
						   v-on:click="$emit('clear-queue')" />
		</template>
	</ModalDialog>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import ModalDialog from '../controls/ModalDialog.vue';
import LoadingButton from '../controls/LoadingButton.vue';
import { InstaxFilmVariant } from '../../interfaces/PrinterStateConfig';

const props = defineProps<{
	/** the two film sizes that disagree, or null while they do not */
	mismatch: { printer: InstaxFilmVariant; queued: InstaxFilmVariant; count: number } | null;
}>();

defineEmits<{ (e: 'clear-queue'): void; (e: 'disconnect'): void }>();

const FILM_NAMES: Record<InstaxFilmVariant, string> = {
	[InstaxFilmVariant.MINI]: 'mini',
	[InstaxFilmVariant.SQUARE]: 'square',
	[InstaxFilmVariant.WIDE]: 'wide'
};

const filmName = (variant?: InstaxFilmVariant): string =>
	variant != null ? FILM_NAMES[variant] : '';

/** Says how much is being given up, so it is not an unlabelled destructive button. */
const clearLabel = computed(() => props.mismatch == null || props.mismatch.count === 1
	? 'Clear 1 photo'
	: `Clear ${props.mismatch.count} photos`);
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

/* the quieter of the two: it changes nothing, it only steps back */
.disconnect {
	min-width: 120px;
	margin-left: auto;
	background-color: rgba(var(--dynamic-bg-color), .12) !important;
	color: rgb(var(--dynamic-bg-color));
	box-shadow: none !important;
}

@media (hover: hover) and (pointer: fine) {
	.disconnect:hover {
		background-color: rgba(var(--dynamic-bg-color), .2) !important;
	}
}

.clear {
	min-width: 140px;
	color: #ffffff;
}
</style>
