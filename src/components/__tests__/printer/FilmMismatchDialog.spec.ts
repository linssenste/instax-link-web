import { mount } from '@vue/test-utils';
import { describe, it, expect } from 'vitest';

import FilmMismatchDialog from '../../../components/printer/FilmMismatchDialog.vue';
import { InstaxFilmVariant } from '../../../interfaces/PrinterStateConfig';

const dialog = (mismatch: { printer: InstaxFilmVariant; queued: InstaxFilmVariant; count: number } | null) =>
	mount(FilmMismatchDialog, {
		props: { mismatch },
		attachTo: document.body,
		global: { stubs: { teleport: true } }
	});

const square = InstaxFilmVariant.SQUARE;
const mini = InstaxFilmVariant.MINI;

describe('FilmMismatchDialog', () => {
	it('stays out of the way while the film sizes agree', () => {
		expect(dialog(null).find('[data-testid="film-mismatch-dialog"]').exists()).toBe(false);
	});

	it('names both sizes, so it is clear what disagrees', () => {
		const text = dialog({ printer: mini, queued: square, count: 3 }).text();

		expect(text).toContain('mini');
		expect(text).toContain('square');
	});

	it('cannot be dismissed, because one of the choices has to be made', () => {
		// carrying on regardless would send a square photo to a mini printer
		const wrapper = dialog({ printer: mini, queued: square, count: 3 });

		expect(wrapper.find('[data-testid="film-mismatch-dialog-close"]').exists()).toBe(false);
		expect(wrapper.find('button.scrim').exists()).toBe(false);
	});

	it('still dims what is behind it', () => {
		expect(dialog({ printer: mini, queued: square, count: 1 }).find('.scrim').exists()).toBe(true);
	});

	it('says how many photos clearing gives up', () => {
		expect(dialog({ printer: mini, queued: square, count: 3 })
			.find('[data-testid="film-mismatch-clear"]').text()).toContain('3 photos');
	});

	it('counts a single photo in the singular', () => {
		expect(dialog({ printer: mini, queued: square, count: 1 })
			.find('[data-testid="film-mismatch-clear"]').text()).toContain('1 photo');
	});

	it('offers giving up the queue', async () => {
		const wrapper = dialog({ printer: mini, queued: square, count: 2 });

		await wrapper.find('[data-testid="film-mismatch-clear"]').trigger('click');

		expect(wrapper.emitted('clear-queue')).toHaveLength(1);
	});

	it('offers stepping back from the printer instead', async () => {
		const wrapper = dialog({ printer: mini, queued: square, count: 2 });

		await wrapper.find('[data-testid="film-mismatch-disconnect"]').trigger('click');

		expect(wrapper.emitted('disconnect')).toHaveLength(1);
	});
});
