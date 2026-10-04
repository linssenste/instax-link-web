<template>
	<Teleport to="body">
		<!-- a sheet up from the bottom edge on a phone, a dialog settling into the
			 middle of the window everywhere else -->
		<Transition name="dialog">
			<div v-if="open" class="backdrop">

				<!-- clicking away is a pointer shortcut, so it is a real button but not
					 a second tab stop: Escape and the close button are the real paths.
					 A dialog that cannot be dismissed still needs the dim, so the scrim
					 stays but stops being a way out. -->
				<button v-if="dismissible" type="button" class="scrim" tabindex="-1" aria-hidden="true"
						v-on:click="close" />
				<div v-else class="scrim" aria-hidden="true" />

				<div ref="panelRef" class="panel" :class="{ compact }" tabindex="-1" role="dialog"
					 aria-modal="true" :data-testid="testid" :aria-labelledby="titleId">

					<!-- fixed bands: only the content between them scrolls, so the title
						 and the actions stay reachable however little room there is -->
					<header class="head">
						<h2 :id="titleId">{{ title }}</h2>
						<CloseButton v-if="dismissible" :label="`Close ${title}`" title="Close"
									 :testid="testid ? `${testid}-close` : undefined" v-on:click="close" />
					</header>

					<div class="content">
						<slot />
					</div>

					<footer v-if="$slots.footer" class="foot">
						<slot name="footer" />
					</footer>
				</div>
			</div>
		</Transition>
	</Teleport>
</template>

<script setup lang="ts">
import { nextTick, onBeforeUnmount, ref, useId, watch } from 'vue';
import CloseButton from './CloseButton.vue';

const props = withDefaults(defineProps<{
	open: boolean;
	title: string;
	testid?: string;
	/** a narrow panel, for a dialog that says something rather than offering somewhere to work */
	compact?: boolean;
	/**
	 * Whether there is a way out of it.
	 *
	 * False leaves the dialog with no close button, no Escape and no click away:
	 * for the cases where carrying on regardless would do harm, and one of the
	 * choices offered has to be made.
	 */
	dismissible?: boolean;
}>(), { dismissible: true });

const emit = defineEmits<{ (e: 'close'): void }>();

// a counter here would be one per instance, and every dialog would claim the same id
const titleId = `modal-dialog-title-${useId()}`;

const panelRef = ref<HTMLDivElement | null>(null);

function close(): void {
	emit('close');
}

function escapeEvent(event: KeyboardEvent): void {
	if (event.key === 'Escape' && props.dismissible) close();
}

watch(() => props.open, async (open) => {
	if (!open) {
		document.removeEventListener('keydown', escapeEvent);
		return;
	}

	document.addEventListener('keydown', escapeEvent);

	await nextTick();
	panelRef.value?.focus();
}, { immediate: true });

onBeforeUnmount(() => {
	document.removeEventListener('keydown', escapeEvent);
});
</script>

<style scoped>
.backdrop {
	position: fixed;
	inset: 0;
	z-index: 100000;
	display: flex;
	align-items: center;
	justify-content: center;
	padding: 20px;
	box-sizing: border-box;
}

/* The dim belongs to the scrim rather than the backdrop, so a sheet can slide
   without the dim going with it.
   A plain colour rather than a backdrop-filter: no browser animates a filter
   reliably, and a dim that eases everywhere beats a blur that jumps.
   height: auto is load bearing: every button in the app is 40px tall, and an
   explicit height against inset: 0 wins, leaving a 40px band across the top that
   both draws the dim and is the only place a click away lands. */
.scrim {
	position: absolute;
	inset: 0;
	z-index: 0;
	height: auto;
	padding: 0;
	border: none;
	border-radius: 0;
	cursor: default;
	background-color: rgba(0, 0, 0, .45);
}

/* the global button hover outranks a single class, and would paint the dim in the
   theme colour as soon as the pointer crossed it */
.scrim:hover {
	background-color: rgba(0, 0, 0, .45);
	box-shadow: none;
}

/* hidden rather than scrolling, so the head and foot are never carried out of reach */
.panel {
	position: relative;
	z-index: 1;
	width: 100%;
	max-width: 720px;
	max-height: 100%;
	overflow: hidden;
	display: flex;
	flex-direction: column;
	border-radius: 16px;
	/* the app paints its background as the theme colour at a fifth over white, so
	   the dialog mixes the same colour rather than sitting on it as a white sheet */
	background-color: color-mix(in srgb, rgb(var(--dynamic-bg-color)) 20%, #ffffff);
	box-shadow: 0 12px 40px rgba(0, 0, 0, .18);
	outline: none;
}

/* a short message reads badly across the full width: the eye has to travel back
   over half a panel of nothing to find the start of the next line */
.panel.compact {
	max-width: 400px;
}

.head {
	flex: none;
	display: flex;
	align-items: center;
	justify-content: space-between;
	padding: 18px 20px 6px;
}

.head h2 {
	margin: 0;
	font-size: 17px;
	font-weight: 500;
	letter-spacing: 1px;
	text-transform: uppercase;
}

/* min-height 0 lets whatever is inside take over the scrolling */
.content {
	flex: 1 1 auto;
	min-height: 0;
	display: flex;
	flex-direction: column;
}

/* over the content, carrying nothing of its own: the scrolling part draws the line,
   and only when there is something out of sight */
.foot {
	flex: none;
	position: relative;
	z-index: 1;
	display: flex;
	align-items: center;
	gap: 10px;
	padding: 12px 20px 18px;
}

/* transform and opacity only, so it survives the main thread rendering the preview */
.dialog-enter-active,
.dialog-leave-active {
	transition: opacity 220ms ease-out;
}

.dialog-leave-active {
	transition-duration: 160ms;
}

.dialog-enter-active .scrim,
.dialog-leave-active .scrim {
	transition: opacity 220ms ease-out;
}

.dialog-leave-active .scrim {
	transition-duration: 160ms;
}

.dialog-enter-from,
.dialog-leave-to {
	opacity: 0;
}

.dialog-enter-active .panel {
	transition: transform 260ms cubic-bezier(.22, .61, .36, 1);
}

.dialog-leave-active .panel {
	transition: transform 170ms ease-in;
}

/* settling into the middle of the window */
.dialog-enter-from .panel,
.dialog-leave-to .panel {
	transform: scale(.94);
}

@media (max-width: 620px) {
	.backdrop {
		padding: 0;
		align-items: flex-end;
	}

	/* the sheet slides and does not fade; only the dim behind it does */
	.dialog-enter-from,
	.dialog-leave-to {
		opacity: 1;
	}

	.dialog-enter-from .scrim,
	.dialog-leave-to .scrim {
		opacity: 0;
	}

	.dialog-enter-from .panel,
	.dialog-leave-to .panel {
		transform: translateY(100%);
	}

	.panel {
		max-width: none;
		border-bottom-left-radius: 0;
		border-bottom-right-radius: 0;
		height: 92dvh;
		max-height: 92dvh;
	}

	/* clear of the home indicator on a phone without a hardware button */
	.foot {
		padding-bottom: max(18px, env(safe-area-inset-bottom));
	}
}

@media (prefers-reduced-motion: reduce) {

	.dialog-enter-active,
	.dialog-leave-active,
	.dialog-enter-active .panel,
	.dialog-leave-active .panel,
	.dialog-enter-active .scrim,
	.dialog-leave-active .scrim {
		transition: none;
	}

	.dialog-enter-from .panel,
	.dialog-leave-to .panel {
		transform: none;
	}
}
</style>
