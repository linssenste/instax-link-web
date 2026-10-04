import { mount, flushPromises } from '@vue/test-utils';
import { nextTick, reactive } from 'vue';
import { describe, it, expect, beforeEach, vi } from 'vitest';

import { cssOf } from '../css';
// the download module pulls in Konva, which needs a real canvas
vi.mock('konva', async () => ({ default: (await import('../polaroid/konva.mock')).konvaMock }));

// rebuilding the keepsake needs a real canvas, so the renderer is stood in for
const { polaroidFromPrintImage, downloadDataUrl } = vi.hoisted(() => ({
	polaroidFromPrintImage: vi.fn(async () => 'data:image/png;base64,keepsake'),
	downloadDataUrl: vi.fn()
}));

vi.mock('../../../cropper/cropper.download', async (importOriginal) => ({
	...(await importOriginal<typeof import('../../../cropper/cropper.download')>()),
	polaroidFromPrintImage,
	downloadDataUrl
}));

import QueueElement from '../../../components/printer/QueueElement.vue';
import { PRINT_DURATION } from '../../../api/instax';
import { InstaxFilmVariant } from '../../../interfaces/PrinterStateConfig';

describe('QueueElement Component', () => {
	let wrapper;
	const mockElement = {
		id: 1,
		base64: 'data:image/png;base64,testbase64',
		thumbnail: 'data:image/png;base64,testbase64',
		// queued: the copies can only be chosen before the image goes over
		state: 0, // 0: In Queue, 1: Sending, 2: Printing, 3: Failed
		progress: 50,
		quantity: 5,
		type: InstaxFilmVariant.SQUARE
	};

	beforeEach(() => {
		polaroidFromPrintImage.mockClear();
		polaroidFromPrintImage.mockResolvedValue('data:image/png;base64,keepsake');
		downloadDataUrl.mockClear();

		wrapper = mount(QueueElement, {
			props: { element: mockElement }
		});
	});

	describe('Component Rendering', () => {
		it('renders correctly with initial props', () => {
			expect(wrapper.find('[data-testid="status-text"]').text()).toContain('In queue');
			// the card shows its own small copy, not the print image
			expect(wrapper.find('img').attributes('src')).toBe(mockElement.thumbnail);
		});

		it('updates status text based on element state', async () => {
			await wrapper.setProps({ element: { ...mockElement, state: 2 } });
			expect(wrapper.find('[data-testid="status-text"]').text()).toContain('Printing');
		});
	});

	describe('User Interactions', () => {
		it('calls cancelPrinting method when cancel button is clicked', async () => {
			const cancelSpy = vi.spyOn(wrapper.vm, 'cancelPrinting');
			await wrapper.find('[data-testid="canceling-button"]').trigger('click');
			expect(cancelSpy).toHaveBeenCalled();
		});

		it('modifies quantity correctly when plus button is clicked', async () => {
			const initialQuantity = mockElement.quantity;
			await wrapper.find('[data-testid="quantity-button-plus"]').trigger('click');
			expect(wrapper.emitted('quantity-change')[0]).toEqual([initialQuantity + 1]);
		});

		it('modifies quantity correctly when minus button is clicked', async () => {
			const initialQuantity = mockElement.quantity;
			await wrapper.find('[data-testid="quantity-button-minus"]').trigger('click');
			expect(wrapper.emitted('quantity-change')[0]).toEqual([initialQuantity - 1]);
		});
	});

	describe('Caption as the title', () => {
		it('shows the caption when the image has one', async () => {
			await wrapper.setProps({ element: { ...mockElement, caption: 'holiday 98' } });

			expect(wrapper.find('[data-testid="queue-caption"]').text()).toBe('holiday 98');
		});

		it('keeps the line even with nothing on it', () => {
			// the row holds its height either way, so the cards in a queue line up
			// rather than each being as tall as its own text
			const line = wrapper.find('[data-testid="queue-caption"]');

			expect(line.exists()).toBe(true);
			expect(line.text()).toBe('');
		});

		it('ignores a caption that is only whitespace', async () => {
			await wrapper.setProps({ element: { ...mockElement, caption: '   ' } });

			expect(wrapper.find('[data-testid="queue-caption"]').text()).toBe('');
		});

		it('carries no tooltip when there is nothing to spell out', async () => {
			expect(wrapper.find('[data-testid="queue-caption"]').attributes('title')).toBeUndefined();

			await wrapper.setProps({ element: { ...mockElement, caption: 'holiday 98' } });
			expect(wrapper.find('[data-testid="queue-caption"]').attributes('title')).toBe('holiday 98');
		});

		it('reserves the line in the stylesheet, not by what is in it', () => {
			const css = cssOf('src/components/printer/QueueElement.vue')('.queue-caption');

			expect(css).toContain('min-height');
		});

		it('sits under the status row rather than above it', () => {
			// asked for: the status and its controls read first, the title beneath
			const html = wrapper.html();

			expect(html.indexOf('status-text')).toBeLessThan(html.indexOf('queue-caption'));
		});
	});

	describe('Downloading a queued polaroid', () => {
		it('offers a download for every queued image', () => {
			const download = wrapper.find('[data-testid="queue-download-button"]');

			expect(download.exists()).toBe(true);
			expect(download.attributes('aria-label')).toBe('Download this polaroid');
		});

		it('rebuilds the keepsake from the queued print image and hands it over', async () => {
			await wrapper.setProps({ element: { ...mockElement, caption: 'holiday 98' } });

			await wrapper.find('[data-testid="queue-download-button"]').trigger('click');
			await flushPromises();

			expect(polaroidFromPrintImage).toHaveBeenCalledWith(
				InstaxFilmVariant.SQUARE, 'holiday 98', mockElement.base64
			);
			// the caption names the file too
			expect(downloadDataUrl).toHaveBeenCalledWith('data:image/png;base64,keepsake', 'holiday-98.png');
		});

		it('shows a spinner only while the rebuild runs', async () => {
			let finish: (value: string) => void = () => { };
			polaroidFromPrintImage.mockReturnValueOnce(new Promise((resolve) => { finish = resolve }));

			await wrapper.find('[data-testid="queue-download-button"]').trigger('click');
			expect(wrapper.find('[data-testid="queue-download-button"] .button-spinner').exists()).toBe(true);

			finish('data:image/png;base64,keepsake');
			await flushPromises();

			expect(wrapper.find('[data-testid="queue-download-button"] .button-spinner').exists()).toBe(false);
		});

		it('does not start a second rebuild while one is running', async () => {
			polaroidFromPrintImage.mockReturnValueOnce(new Promise(() => { /* never settles */ }));

			await wrapper.find('[data-testid="queue-download-button"]').trigger('click');
			await wrapper.find('[data-testid="queue-download-button"] ').trigger('click');

			expect(polaroidFromPrintImage).toHaveBeenCalledTimes(1);
		});

		it('recovers when the rebuild fails', async () => {
			polaroidFromPrintImage.mockRejectedValueOnce(new Error('bad image'));
			const logged = vi.spyOn(console, 'error').mockImplementation(() => { });

			await wrapper.find('[data-testid="queue-download-button"]').trigger('click');
			await flushPromises();

			expect(downloadDataUrl).not.toHaveBeenCalled();
			expect(wrapper.find('[data-testid="queue-download-button"] .button-spinner').exists()).toBe(false);
			logged.mockRestore();
		});
	});

	describe('Event Emission', () => {
		it('emits cancel event when cancelPrinting is invoked', async () => {
			await wrapper.vm.cancelPrinting();
			expect(wrapper.emitted('cancel')).toBeTruthy();
		});

		it('emits quantity-change event with correct value when modifyQuantity is called', async () => {
			const quantity = 3;
			await wrapper.vm.modifyQuantity(quantity);
			expect(wrapper.emitted('quantity-change')[0]).toEqual([quantity]);
		});
	});

	describe('Progress Bar', () => {
		it('shows correct progress for sending state', async () => {
			await wrapper.setProps({ element: { ...mockElement, state: 1 } });
			const progressBar = wrapper.find('[data-testid="printing-progress-sending"] .progress');
			expect(progressBar.attributes('style')).toContain(`width: ${mockElement.progress}%`);
		});

		it('shows correct progress for printing state', async () => {
			// taken from the copies that have come out, not from the stored progress:
			// that went stale the moment the number of copies changed
			await wrapper.setProps({
				element: { ...mockElement, state: 2, quantity: 4, printedCopies: 2 }
			});

			const progressBar = wrapper.find('[data-testid="printing-progress-printing"] .progress-print');
			expect(progressBar.attributes('style')).toContain('width: 50%');
		});
	});


	describe('Quantity Input Validation', () => {
		it('adjusts quantity input when out of bounds', async () => {
			await wrapper.find('[data-testid="quantity-input-field"]').setValue(11);
			await wrapper.find('[data-testid="quantity-input-field"]').trigger('blur');
			expect(wrapper.vm.quantityInput).toBe(10);

			await wrapper.find('[data-testid="quantity-input-field"]').setValue(0);
			await wrapper.find('[data-testid="quantity-input-field"]').trigger('blur');
			expect(wrapper.vm.quantityInput).toBe(1);
		});

	});

	describe('choosing the copies', () => {
		const inState = (state: number, overrides = {}) => mount(QueueElement, {
			props: {
				element: {
					id: 11, base64: 'x', thumbnail: 'x', state, progress: 0, quantity: 2,
					type: InstaxFilmVariant.SQUARE, ...overrides
				}
			}
		});

		it('can be chosen while the photo is still waiting', () => {
			expect(inState(0).find('[data-testid="quantity-setter"]').exists()).toBe(true);
		});

		it('stays available while the image is going over', () => {
			// the print command is issued once per copy, so the number is still
			// changeable long after the transfer: hiding it then was wrong
			expect(inState(1).find('[data-testid="quantity-setter"]').exists()).toBe(true);
		});

		it('stays available while it is printing', () => {
			expect(inState(2).find('[data-testid="quantity-setter"]').exists()).toBe(true);
		});

		it('stays available after a failure, held image or not', () => {
			expect(inState(3, { heldByPrinter: true }).find('[data-testid="quantity-setter"]').exists())
				.toBe(true);
			expect(inState(3, { heldByPrinter: false }).find('[data-testid="quantity-setter"]').exists())
				.toBe(true);
		});

		it('goes once the last sheet is nearly out', async () => {
			vi.useFakeTimers();

			try {
				// on the final copy of two, with one already printed
				const wrapper = inState(2, { quantity: 2, printedCopies: 1 });
				expect(wrapper.find('[data-testid="quantity-setter"]').exists()).toBe(true);

				await vi.advanceTimersByTimeAsync(PRINT_DURATION - 2000);
				await flushPromises();

				expect(wrapper.find('[data-testid="quantity-setter"]').exists()).toBe(false);
			} finally {
				vi.useRealTimers();
			}
		});

		it('stays while there are copies still to come after this one', async () => {
			vi.useFakeTimers();

			try {
				const wrapper = inState(2, { quantity: 5, printedCopies: 1 });

				await vi.advanceTimersByTimeAsync(PRINT_DURATION * 2);
				await flushPromises();

				expect(wrapper.find('[data-testid="quantity-setter"]').exists()).toBe(true);
			} finally {
				vi.useRealTimers();
			}
		});

		it('cannot be taken below the sheets that already exist', () => {
			// five asked for, second one printing: the floor is two
			const wrapper = inState(2, { quantity: 5, printedCopies: 1 });
			const minus = wrapper.find('[data-testid="quantity-button-minus"]');

			expect(wrapper.find('[data-testid="quantity-input-field"]').attributes('min')).toBe('2');
			expect(minus.classes()).not.toContain('disabled');
		});

		it('blocks the minus once it is at that floor', () => {
			const wrapper = inState(2, { quantity: 2, printedCopies: 1 });

			expect(wrapper.find('[data-testid="quantity-button-minus"]').classes()).toContain('disabled');
		});

		it('draws its marks in white, not the placeholder grey they ship with', () => {
			// both icons carry fill="#e3e3e3", so an <img> of them looked washed out on
			// a button in the theme colour
			const css = cssOf('src/components/printer/QueueElement.vue');

			expect(css('.quantity-mark')).toContain('background-color: #ffffff');
			expect(css('.quantity-mark.minus')).toContain('mask');
			expect(css('.quantity-mark.plus')).toContain('mask');
		});

		it('keeps the marks out of the accessible name', () => {
			const wrapper = inState(0);

			for (const mark of wrapper.findAll('.quantity-mark')) {
				expect(mark.attributes('aria-hidden')).toBe('true');
			}
			// the buttons carry the names instead
			expect(wrapper.find('[data-testid="quantity-button-plus"]').attributes('aria-label')).toBeTruthy();
			expect(wrapper.find('[data-testid="quantity-button-minus"]').attributes('aria-label')).toBeTruthy();
		});

		it('has a floor of one while nothing has printed', () => {
			expect(inState(0).find('[data-testid="quantity-input-field"]').attributes('min')).toBe('1');
		});

		it('is given room rather than being left to spill out of the card', () => {
			// the column was pinned to 80px while holding a caption, the controls and
			// the counter: the counter spilled out, and once the progress bar appeared
			// below it the two overlapped and it looked as though it had gone
			const css = cssOf('src/components/printer/QueueElement.vue')('.image-status-info');

			expect(css).toContain('min-height');
			expect(css).not.toMatch(/\n\theight:\s*\d+px/);
		});
	});

	describe('the copy counter', () => {
		const printing = (overrides = {}) => mount(QueueElement, {
			props: {
				element: {
					id: 12, base64: 'x', thumbnail: 'x', state: 2, progress: 0, quantity: 5,
					type: InstaxFilmVariant.SQUARE, ...overrides
				}
			}
		});

		it('counts the copy being printed, not the one the bar is aiming at', () => {
			// progress runs a copy ahead so the bar has somewhere to creep; derived
			// from that, the counter read 1/1 the instant printing began
			expect(printing({ printedCopies: 0, progress: 20 }).find('[data-testid="status-text"]').text())
				.toContain('1/5');
		});

		it('moves on as copies come out', () => {
			expect(printing({ printedCopies: 2, progress: 60 }).find('[data-testid="status-text"]').text())
				.toContain('3/5');
		});

		it('does not count past the copies asked for', () => {
			expect(printing({ printedCopies: 5, progress: 100 }).find('[data-testid="status-text"]').text())
				.toContain('5/5');
		});

		it('reads 1/1 for a single copy', () => {
			expect(printing({ quantity: 1, printedCopies: 0 }).find('[data-testid="status-text"]').text())
				.toContain('1/1');
		});
	});

	describe('the printing bar', () => {
		const printing = (overrides = {}) => mount(QueueElement, {
			props: {
				element: {
					id: 9, base64: 'data:image/png;base64,x', thumbnail: 'data:image/png;base64,x',
					state: 2, progress: 0, quantity: 1, type: InstaxFilmVariant.SQUARE, ...overrides
				}
			}
		});

		it('is already there at zero width when printing starts', () => {
			const bar = printing({ progress: 0 }).find('[data-testid="printing-progress-printing"] .progress');

			expect(bar.exists()).toBe(true);
			expect(bar.attributes('style')).toContain('width: 0%');
		});

		it('creeps across the copy now coming out, for as long as a sheet takes', () => {
			// a width transition towards a value set a copy ahead read as finished
			// before the sheet appeared; an animation bounded by the copy cannot
			const bar = printing({ quantity: 4, printedCopies: 1, progress: 25 })
				.find('[data-testid="printing-progress-printing"] .progress');
			const style = bar.attributes('style') ?? '';

			expect(bar.classes()).toContain('running');
			expect(style).toContain('--sheet-from: 25%');
			expect(style).toContain('--sheet-to: 50%');
			expect(style).toContain(`--sheet-duration: ${PRINT_DURATION}ms`);
		});

		it('redraws the timeline when more copies are asked for', () => {
			// two copies take twice as long, so the bar has to go back: keyed on the
			// quantity as well as the copy, a running creep kept its old bounds
			const one = printing({ quantity: 1, printedCopies: 0 });
			const two = printing({ quantity: 2, printedCopies: 0 });

			expect(one.find('[data-testid="printing-progress-printing"] .progress').attributes('style'))
				.toContain('--sheet-to: 100%');
			expect(two.find('[data-testid="printing-progress-printing"] .progress').attributes('style'))
				.toContain('--sheet-to: 50%');
		});

		it('restarts for each copy rather than running once across them all', () => {
			// keyed to the copy: without that the animation would play once and the
			// later sheets would have nothing showing for them
			const first = printing({ quantity: 3, printedCopies: 0 });
			const second = printing({ quantity: 3, printedCopies: 1 });

			expect(first.find('[data-testid="printing-progress-printing"] .progress').attributes('style'))
				.toContain('--sheet-to: 33.33');
			expect(second.find('[data-testid="printing-progress-printing"] .progress').attributes('style'))
				.toContain('--sheet-to: 66.66');
		});

		it('stops dead where it got to when the print fails', () => {
			// the width used to be walked back from the copy it was aiming for, and
			// the transition animated that decrease - so the bar crept *backwards*
			const bar = printing({ state: 3, failedAt: 2, printedCopies: 1, quantity: 4 })
				.find('[data-testid="printing-progress-printing"] .progress');

			expect(bar.classes()).not.toContain('running');
			expect(bar.attributes('style')).toContain('width: 25%');
		});

		it('grows with the copies that have come out', () => {
			const bar = printing({ quantity: 5, printedCopies: 2 })
				.find('[data-testid="printing-progress-printing"] .progress');

			expect(bar.attributes('style')).toContain('width: 40%');
		});

		it('picks the sheet up where it is, rather than starting it again', () => {
			// asking for a second copy reissues the keyframes with new bounds; without
			// a negative delay to place the playhead, nudging the count up and back
			// left the bar at the beginning of a sheet that was half done
			const started = Date.now() - 6000;
			const bar = printing({ quantity: 1, printedCopies: 0, copyStartedAt: started })
				.find('[data-testid="printing-progress-printing"] .progress');
			const style = bar.attributes('style') ?? '';

			const elapsed = Number(/--sheet-elapsed:\s*-(\d+)ms/.exec(style)?.[1]);
			expect(elapsed).toBeGreaterThanOrEqual(5900);
			expect(elapsed).toBeLessThanOrEqual(6200);
		});

		/**
		 * The app mutates the queued photo in place - `photo.quantity = 3` - so the
		 * card must cope with one field changing on the same object. Replacing the
		 * whole prop invalidates every computed and hides the bug this guards.
		 */
		const printingLive = (overrides: Record<string, unknown>) => {
			const element = reactive({
				id: 12, base64: 'x', thumbnail: 'x', state: 2, progress: 0,
				quantity: 1, type: InstaxFilmVariant.SQUARE, ...overrides
			});

			const wrapper = mount(QueueElement, { props: { element } });
			const style = () => wrapper.find('[data-testid="printing-progress-printing"] .progress')
				.attributes('style') ?? '';

			return { element, style };
		};

		const elapsedIn = (style: string) =>
			Number(/--sheet-elapsed:\s*-(\d+)ms/.exec(style)?.[1]);

		it('refits itself when the copies are taken back down', async () => {
			// Three copies back to one, six seconds into the sheet. The elapsed time
			// comes from Date.now(), which is not reactive: computed apart from the
			// bounds it was cached at the start of the sheet - near zero - so changing
			// the count reissued the animation from the beginning of a half-done sheet.
			// The clock has to move *after* mounting for that to show.
			vi.useFakeTimers();

			try {
				const startedAt = Date.now();
				const { element, style } = printingLive({
					quantity: 3, printedCopies: 0, copyStartedAt: startedAt
				});

				expect(style()).toContain('--sheet-to: 33.33');
				expect(elapsedIn(style())).toBe(0);

				vi.advanceTimersByTime(6000);
				element.quantity = 1;
				await nextTick();

				expect(style()).toContain('--sheet-to: 100%');
				expect(elapsedIn(style())).toBe(6000);
			} finally {
				vi.useRealTimers();
			}
		});

		it('refits itself when more copies are asked for', async () => {
			vi.useFakeTimers();

			try {
				const { element, style } = printingLive({
					quantity: 1, printedCopies: 0, copyStartedAt: Date.now()
				});

				expect(style()).toContain('--sheet-to: 100%');

				vi.advanceTimersByTime(3000);
				element.quantity = 2;
				await nextTick();

				expect(style()).toContain('--sheet-to: 50%');
				expect(elapsedIn(style())).toBe(3000);
			} finally {
				vi.useRealTimers();
			}
		});

		it('does not claim more elapsed than a sheet takes', () => {
			const bar = printing({ quantity: 1, printedCopies: 0, copyStartedAt: Date.now() - 999_999 })
				.find('[data-testid="printing-progress-printing"] .progress');

			expect(bar.attributes('style')).toContain(`--sheet-elapsed: -${PRINT_DURATION}ms`);
		});

		it('starts from the beginning when no sheet is under way', () => {
			const bar = printing({ quantity: 1, printedCopies: 0 })
				.find('[data-testid="printing-progress-printing"] .progress');

			expect(bar.attributes('style')).toContain('--sheet-elapsed: -0ms');
		});

		it('is not there before the transfer is finished', () => {
			const bar = mount(QueueElement, {
				props: {
					element: {
						id: 10, base64: 'x', thumbnail: 'x', state: 1, progress: 50,
						quantity: 1, type: InstaxFilmVariant.SQUARE
					}
				}
			}).find('[data-testid="printing-progress-printing"] .progress');

			expect(bar.exists()).toBe(false);
		});
	});

	describe('a print that failed', () => {
		const failed = (overrides = {}) => mount(QueueElement, {
			props: {
				element: {
					id: 2,
					base64: 'data:image/png;base64,testbase64',
					thumbnail: 'data:image/png;base64,testbase64',
					state: 3, progress: 0, quantity: 2,
					type: InstaxFilmVariant.SQUARE, ...overrides
				}
			}
		});

		it('says so, rather than looking like it is still queued', () => {
			const text = failed().find('[data-testid="status-text"]').text();

			expect(text).toContain('Failed');
			// short enough to sit in the row beside the controls
			expect(text.length).toBeLessThan(12);
		});

		it('keeps the progress bar, because it says where the photo got to', () => {
			// hidden on failure, there was no way to tell a photo the printer never
			// received from one it received and refused to print
			expect(failed().find('[data-testid="printing-progress"]').exists()).toBe(true);
		});

		it('leaves the transfer bar short when it failed while sending', () => {
			const wrapper = failed({ failedAt: 1, progress: 40 });
			const sending = wrapper.find('[data-testid="printing-progress-sending"] .progress');

			expect(sending.attributes('style')).toContain('width: 40%');
			// nothing was printed, so the second bar has nothing to show
			expect(wrapper.find('[data-testid="printing-progress-printing"] .progress').exists()).toBe(false);
		});

		it('fills the transfer bar when it got as far as printing', () => {
			// the printer had the image: that is a different fault, and the bars are
			// what distinguish them
			const wrapper = failed({ failedAt: 2, quantity: 4, printedCopies: 1 });

			expect(wrapper.find('[data-testid="printing-progress-sending"] .progress').attributes('style'))
				.toContain('width: 100%');
			expect(wrapper.find('[data-testid="printing-progress-printing"] .progress').attributes('style'))
				.toContain('width: 25%');
		});

		it('marks the step between the bars only once the transfer is done', () => {
			const grey = 'rgb(var(--light-grey-color))';

			expect(failed({ failedAt: 1, progress: 40 })
				.find('[data-testid="printing-progress-step"]').attributes('style')).toContain(grey);
			expect(failed({ failedAt: 2, progress: 25 })
				.find('[data-testid="printing-progress-step"]').attributes('style') ?? '').not.toContain(grey);
		});

		it('reads as settled rather than still running', () => {
			expect(failed().find('[data-testid="printing-progress"]').classes()).toContain('failed');
		});

		it('still lets the copies be changed before another go', () => {
			expect(failed().find('[data-testid="quantity-setter"]').exists()).toBe(true);
		});

		it('offers a way back to printing on the card itself', async () => {
			// the dialog can be dismissed, and then this is the only route left
			const wrapper = failed();

			await wrapper.find('[data-testid="queue-retry-button"]').trigger('click');

			expect(wrapper.emitted('retry')).toHaveLength(1);
		});

		it('carries no text, so a failure cannot widen the panel', () => {
			// the card sizes the printer panel, so a labelled button here made the
			// whole panel jump wider the moment a print failed
			const retry = failed().find('[data-testid="queue-retry-button"]');

			expect(retry.text()).toBe('');
		});

		it('is still named for anyone who cannot see the icon', () => {
			const retry = failed().find('[data-testid="queue-retry-button"]');

			expect(retry.attributes('aria-label')).toBeTruthy();
			expect(retry.attributes('title')).toBeTruthy();
		});

		it('sits in the same footprint as the other controls on the card', () => {
			const retry = failed().find('[data-testid="queue-retry-button"]');

			expect(retry.classes()).toContain('queue-icon-button');
		});

		it('offers it only once there is something to retry', () => {
			for (const state of [0, 1, 2]) {
				expect(failed({ state }).find('[data-testid="queue-retry-button"]').exists()).toBe(false);
			}
		});

		it('can still be taken off the queue from the card', async () => {
			const wrapper = failed();

			await wrapper.find('[data-testid="canceling-button"]').trigger('click');

			expect(wrapper.emitted('cancel')).toHaveLength(1);
		});

		it('reads at the same size as every other state', async () => {
			// it used to be set smaller than the rest, so the row changed height as a
			// photo moved through the queue
			const wrapper = failed();
			const label = wrapper.find('.failed-text');

			expect(label.exists()).toBe(true);
			expect(label.classes()).toContain('status-label');
		});

		it('does not claim to be canceling once it has failed', async () => {
			const wrapper = failed();

			await wrapper.find('[data-testid="canceling-button"]').trigger('click');

			expect(wrapper.find('[data-testid="status-text"]').text()).not.toContain('Cancelling');
		});
	});
});
