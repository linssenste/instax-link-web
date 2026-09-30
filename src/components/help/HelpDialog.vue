<template>
	<ModalDialog :open="open" title="About" testid="help-dialog" v-on:close="$emit('close')">

		<div class="body">

			<!-- two paragraphs in a div rather than nested in one another: a p cannot
				 hold a p, and the Vue parser rightly refuses it -->
			<div class="lead">
				<p>
					Control your INSTAX Link printer directly from your browser. Connect over
					Bluetooth with nothing to install, queue up as many photos as you like, and
					prepare the next one while the previous photo is still printing.
				</p>

				<p>Don’t have a printer? You can download the Polaroid instead.</p>
			</div>
			<section>
				<h3>Supported Printers</h3>
				<ul class="films">
					<li v-for="film in FILMS" :key="film.variant">
						<span class="film-head">
							<span class="film-name">instax {{ film.variant }}</span>
							<span class="film-size">{{ film.width }} × {{ film.height }}</span>
						</span>
						<span class="film-models">
							<template v-for="(model, index) in film.models" :key="model.name">
								<span v-if="index > 0" class="film-separator" aria-hidden="true">·</span>
								<a :href="model.href" target="_blank" rel="noreferrer"
									:title="`instax ${model.name} at instax.com`">{{ model.name }}</a>
							</template>
						</span>
					</li>
				</ul>

				<p class="note">
					Any printer announcing itself as <code>INSTAX</code> pairs; the film is read from
					the printer.
				</p>
			</section>

			<!-- folded away: the longest part, and the least often wanted -->
			<section class="keyboard">
				<button type="button" tabindex="-1" class="disclosure" data-testid="help-shortcuts-toggle"
					:aria-expanded="shortcutsOpen" aria-controls="help-shortcuts"
					v-on:click="shortcutsOpen = !shortcutsOpen">
					<h3>FYI: Keyboard Shortcuts</h3>

					<span class="chevron" :class="{ open: shortcutsOpen }" aria-hidden="true" />
				</button>

				<div id="help-shortcuts" class="panel" :class="{ open: shortcutsOpen }" data-testid="help-shortcuts">
					<dl class="shortcuts">
						<template v-for="shortcut in SHORTCUT_LIST" :key="shortcut.hint">
							<dt><kbd v-for="key in shortcut.keys" :key="key">{{ key }}</kbd></dt>
							<dd>{{ shortcut.description }}</dd>
						</template>
					</dl>
				</div>
			</section>

			<p class="disclaimer" data-testid="help-disclaimer">
				Just a little side project made for fun. Not affiliated with, endorsed by, or connected to INSTAX or
				FUJIFILM in any
				way. I just really like their devices.
			</p>

			<p class="sign-off">
				<a class="github" :href="GITHUB" target="_blank" rel="noreferrer" data-testid="help-github">
					<span class="github-mark" aria-hidden="true" />
					Check it out on GitHub
				</a>

			</p>
		</div>

		<template #footer>

			<LoadingButton label="Close" class="done" data-testid="help-done" v-on:click="$emit('close')" />
		</template>
	</ModalDialog>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import LoadingButton from '../controls/LoadingButton.vue';
import ModalDialog from '../controls/ModalDialog.vue';
import { InstaxFilmVariant } from '../../interfaces/PrinterStateConfig';
import { PRINT_RESOLUTION } from '../../polaroid/frame.geometry';
import { SHORTCUTS } from '../../polaroid/shortcuts';

defineProps<{ open: boolean }>();
defineEmits<{ (e: 'close'): void }>();

const shortcutsOpen = ref(false);

/**
 * Every Link printer Fujifilm has shipped, by the film it takes, each pointing at
 * its own page. The slugs are instax.com's own and were checked one by one.
 */
const model = (name: string, slug: string) =>
	({ name, href: `https://www.instax.com/${slug}/en/` });

const MODELS: Record<InstaxFilmVariant, ReturnType<typeof model>[]> = {
	[InstaxFilmVariant.MINI]: [
		model('mini Link', 'mini_link'),
		model('mini Link 2', 'mini_link_2'),
		model('mini Link 3', 'mini_link_3'),
		model('mini Link+', 'mini_link_plus')
	],
	[InstaxFilmVariant.SQUARE]: [model('SQUARE Link', 'square_link')],
	[InstaxFilmVariant.WIDE]: [
		model('Link WIDE', 'link_wide'),
		model('Link WIDE 2', 'link_wide_2')
	]
};

// sizes come from the app's own table, so this cannot drift from what it prints
const FILMS = Object.values(InstaxFilmVariant).map((variant) => ({
	variant,
	models: MODELS[variant],
	...PRINT_RESOLUTION[variant]
}));

// read from the same table the tooltips use, so the list is always complete
const SHORTCUT_LIST = Object.values(SHORTCUTS).map((shortcut) => ({
	...shortcut,
	keys: shortcut.hint.split(' ')
}));

const GITHUB = 'https://github.com/linssenste/instax-link-web';
</script>

<style scoped>
.body {
	flex: 1 1 auto;
	min-height: 0;
	overflow-y: auto;
	-webkit-overflow-scrolling: touch;
	scrollbar-width: thin;
	display: flex;
	flex-direction: column;
	gap: 18px;
	padding: 8px 20px;
}

h3 {
	margin: 0;
	font-size: 13px;
	font-weight: 500;
	letter-spacing: 1px;
	text-transform: uppercase;
	color: #00000066;
}

.lead {
	display: flex;
	flex-direction: column;
	gap: 8px;
	margin: 0;
	font-size: 14px;
	line-height: 1.5;
}

.lead p {
	margin: 0;
}

.note {
	margin: 10px 0 0;
	font-size: 12px;
	line-height: 1.4;
	color: #00000066;
}

code {
	font-size: 11px;
	padding: 1px 5px;
	border-radius: 4px;
	background-color: rgba(var(--dynamic-bg-color), .12);
}

.films {
	margin: 8px 0 0;
	padding: 0;
	list-style: none;
	display: flex;
	flex-direction: column;
	gap: 10px;
}

.film-head {
	display: flex;
	align-items: baseline;
	justify-content: space-between;
	gap: 12px;
}

/* the same face and size the connected printer wears its own name in */
.film-name {
	font-family: 'Keedy Sans';
	font-size: 21px;
	line-height: 1.1;
}

.film-size {
	font-size: 12px;
	color: #00000066;
	font-variant-numeric: tabular-nums;
	white-space: nowrap;
}

.film-models {
	display: flex;
	flex-wrap: wrap;
	gap: 0 6px;
	margin-top: 1px;
	font-size: 12px;
	color: #000000aa;
}

.film-models a {
	color: inherit;
	text-decoration: none;
	transition: color 120ms ease-out;
}

.film-separator {
	color: #00000044;
}

.film-models a:focus-visible {
	outline: 2px solid rgb(var(--dynamic-bg-color));
	outline-offset: 2px;
	border-radius: 2px;
}

@media (hover: hover) and (pointer: fine) {
	.film-models a:hover {
		color: rgb(var(--dynamic-bg-color));
	}
}

.keyboard {
	border-top: 1px solid #00000012;
	border-bottom: 1px solid #00000012;
	padding: 4px 0;
}

/* a row, not a button to look at: the chrome comes off entirely */
.disclosure {
	display: flex;
	align-items: center;
	gap: 8px;
	width: 100%;
	height: auto;
	padding: 8px 0;
	border: none;
	border-radius: 0;
	opacity: 1;
	background-color: transparent !important;
	box-shadow: none !important;
	text-transform: none;
	letter-spacing: normal;
	cursor: pointer;
}



.chevron {
	width: 20px;
	height: 20px;
	margin-left: auto;
	flex: none;
	background-color: #00000066;
	transition: transform 200ms ease-out;
	-webkit-mask: url('@/assets/icons/controls/chevron.svg') center / contain no-repeat;
	mask: url('@/assets/icons/controls/chevron.svg') center / contain no-repeat;
}

.chevron.open {
	transform: rotate(-180deg);
}

.disclosure:focus-visible {
	outline: 2px solid rgb(var(--dynamic-bg-color));
	outline-offset: 2px;
}

/* A grid row from nothing to its content's height: the one way to ease open
   something whose height is not known, without picking a number that would be
   wrong for a longer list. */
.panel {
	display: grid;
	grid-template-rows: 0fr;
	opacity: 0;
	transition: grid-template-rows 220ms ease-out, opacity 160ms ease-out;
}

.panel.open {
	grid-template-rows: 1fr;
	opacity: 1;
}

.panel>.shortcuts {
	overflow: hidden;
	min-height: 0;
}

.shortcuts {
	margin: 0;
	display: grid;
	grid-template-columns: auto 1fr;
	gap: 5px 14px;
	align-items: baseline;
	font-size: 13px;
}

/* two pairs across where there is room: the keys are short and the descriptions
   are one line each, so a single column leaves half the dialog empty */
@media (min-width: 560px) {
	.shortcuts {
		grid-template-columns: auto 1fr auto 1fr;
		column-gap: 22px;
	}
}

/* the gap belongs inside, or it would show while the panel is shut */
.panel.open>.shortcuts {
	padding-bottom: 10px;
}

dt {
	display: flex;
	gap: 4px;
	justify-content: flex-end;
}

dd {
	margin: 0;
	color: #000000aa;
}

kbd {
	font-family: inherit;
	font-size: 11px;
	line-height: 18px;
	min-width: 18px;
	padding: 0 5px;
	text-align: center;
	border-radius: 4px;
	background-color: rgba(var(--dynamic-bg-color), .12);
	box-shadow: inset 0 -1px 0 rgba(0, 0, 0, .08);
}

/* the mark and its label on one line, at the foot of the dialog */
.sign-off {
	display: flex;
	flex-direction: column;
	align-items: flex-start;
	gap: 2px;
	margin: 0;
}

/* the display face the printer names wear, so the two read as one voice */
.github {
	display: inline-flex;
	align-items: center;
	gap: 7px;
	font-family: 'Keedy Sans';
	font-size: 16px;
	color: rgb(var(--dynamic-bg-color));
	text-decoration: none;
}

.github-mark {
	width: 16px;
	height: 16px;
	flex: none;
	background-color: currentColor;
	-webkit-mask: url('@/assets/icons/github-icon.svg') center / contain no-repeat;
	mask: url('@/assets/icons/github-icon.svg') center / contain no-repeat;
}

.github:focus-visible {
	outline: 2px solid rgb(var(--dynamic-bg-color));
	outline-offset: 3px;
	border-radius: 2px;
}

@media (hover: hover) and (pointer: fine) {
	.github:hover {
		text-decoration: underline;
	}
}


.disclaimer {
	margin: 0;
	font-size: 13px;
	line-height: 1.4;
	color: #000000;
}

.done {
	min-width: 120px;
	margin-left: auto;
	color: #ffffff;
}

@media (prefers-reduced-motion: reduce) {

	.chevron,
	.panel {
		transition: none;
	}
}
</style>
