import { mount, type VueWrapper } from '@vue/test-utils'
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { nextTick } from 'vue'

import SettingsExpansion from '../../layout/SettingsExpansion.vue'
import { InstaxFilmVariant } from '../../../interfaces/PrinterStateConfig'

// the collapsed offset is measured from the rendered panel, which jsdom reports
// as 0x0 - so the height is stubbed to a realistic panel size
const PANEL_HEIGHT = 200;
// the footer (action buttons + grab handle) is what stays visible when collapsed
const FOOTER_HEIGHT = 80;
const EXPANDED_OFFSET = -20;
const COLLAPSED_OFFSET = -(PANEL_HEIGHT - FOOTER_HEIGHT);
// fully tucked behind the polaroid, nothing showing
const HIDDEN_OFFSET = -PANEL_HEIGHT;

describe('SettingsExpansion drawer', () => {
	let wrapper: VueWrapper
	let savePolaroid: ReturnType<typeof vi.fn>
	let rectSpy: ReturnType<typeof vi.spyOn>

	const mountComponent = (props = {}) => {
		savePolaroid = vi.fn();
		wrapper = mount(SettingsExpansion, {
			attachTo: document.body,
			props: {
				config: { connection: false, type: InstaxFilmVariant.SQUARE },
				hasImage: true,
				queueLength: 0,
				savePolaroid,
				...props
			}
		});
		return wrapper;
	};

	// the reveal animates over several ticks before it settles
	const flush = async () => { for (let tick = 0; tick < 8; tick++) await nextTick(); };

	const panel = () => wrapper.find('.settings-panel');
	const handle = () => wrapper.find('[data-testid="expand-handle"]');
	const marginTop = () => panel().element.style.marginTop;

	const drag = async (steps: number[]) => {
		await handle().trigger('pointerdown', { clientY: 0, pointerType: 'mouse', button: 0, pointerId: 1 });
		for (const clientY of steps) {
			await handle().trigger('pointermove', { clientY, pointerType: 'mouse', pointerId: 1 });
		}
		await handle().trigger('pointerup', { clientY: steps[steps.length - 1] ?? 0, pointerType: 'mouse', pointerId: 1 });
	};

	// jsdom lays nothing out, so each element is given the height it would have
	const mockHeights = (panel: number, footer = FOOTER_HEIGHT) => {
		rectSpy.mockImplementation(function (this: HTMLElement) {
			const height = this.classList.contains('panel-footer') ? footer : panel;
			return { height, width: 360, top: 0, left: 0, bottom: 0, right: 0, x: 0, y: 0, toJSON: () => ({}) } as DOMRect;
		});
	};

	beforeEach(() => {
		rectSpy = vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect');
		mockHeights(PANEL_HEIGHT);
		mountComponent();
	});

	afterEach(() => {
		rectSpy.mockRestore();
		wrapper?.unmount();
	});

	it('renders the settings, the action footer and the grab handle', () => {
		expect(panel().exists()).toBe(true);
		expect(handle().exists()).toBe(true);
		expect(wrapper.find('.panel-footer').exists()).toBe(true);
		expect(wrapper.find('[data-testid="rotation-input"]').exists()).toBe(true);
	});

	describe('Resting positions', () => {
		it('starts collapsed when mounted with an image already present', () => {
			expect(wrapper.vm.isExpanded).toBe(false);
			expect(marginTop()).toBe(`${COLLAPSED_OFFSET}px`);
		});

		it('slides out to the expanded offset when the handle is clicked', async () => {
			await handle().trigger('click');

			expect(wrapper.vm.isExpanded).toBe(true);
			expect(marginTop()).toBe(`${EXPANDED_OFFSET}px`);
		});

		it('collapses again on a second click', async () => {
			await handle().trigger('click');
			await handle().trigger('click');

			expect(wrapper.vm.isExpanded).toBe(false);
			expect(marginTop()).toBe(`${COLLAPSED_OFFSET}px`);
		});

		it('follows the panel height when it changes', async () => {
			mockHeights(300);
			wrapper.vm.measurePanel();
			await nextTick();

			expect(marginTop()).toBe(`${-(300 - FOOTER_HEIGHT)}px`);
		});

		it('leaves more showing when the footer grows', async () => {
			// a connected printer adds the download icon button beside Print
			mockHeights(PANEL_HEIGHT, 120);
			wrapper.vm.measurePanel();
			await nextTick();

			expect(marginTop()).toBe(`${-(PANEL_HEIGHT - 120)}px`);
		});

		it('never collapses past the expanded offset for a very short panel', async () => {
			mockHeights(10, 10);
			wrapper.vm.measurePanel();
			await nextTick();

			expect(marginTop()).toBe(`${EXPANDED_OFFSET}px`);
		});
	});

	describe('Without an image', () => {
		beforeEach(() => {
			wrapper.unmount();
			mountComponent({ hasImage: false });
		});

		it('is taken out of the layout entirely', () => {
			expect(panel().isVisible()).toBe(false);
		});

		it('cannot be expanded by clicking', async () => {
			await handle().trigger('click');

			expect(wrapper.vm.isExpanded).toBe(false);
			expect(marginTop()).toBe(`${COLLAPSED_OFFSET}px`);
		});

		it('cannot be dragged open', async () => {
			await drag([40, 120]);

			expect(wrapper.vm.isExpanded).toBe(false);
			expect(marginTop()).toBe(`${COLLAPSED_OFFSET}px`);
		});
	});

	describe('Drag gesture', () => {
		it('tracks the pointer while dragging', async () => {
			await handle().trigger('pointerdown', { clientY: 0, pointerType: 'mouse', button: 0, pointerId: 1 });
			await handle().trigger('pointermove', { clientY: 60, pointerType: 'mouse', pointerId: 1 });

			expect(panel().classes()).toContain('no-transition');
			expect(marginTop()).toBe(`${COLLAPSED_OFFSET + 60}px`);
		});

		it('clamps the drag between both resting positions', async () => {
			await handle().trigger('pointerdown', { clientY: 0, pointerType: 'mouse', button: 0, pointerId: 1 });

			await handle().trigger('pointermove', { clientY: 5000, pointerType: 'mouse', pointerId: 1 });
			expect(marginTop()).toBe(`${EXPANDED_OFFSET}px`);

			await handle().trigger('pointermove', { clientY: -5000, pointerType: 'mouse', pointerId: 1 });
			expect(marginTop()).toBe(`${COLLAPSED_OFFSET}px`);
		});

		it('snaps open when released past the halfway point', async () => {
			await drag([40, 120]);

			expect(wrapper.vm.isExpanded).toBe(true);
			expect(marginTop()).toBe(`${EXPANDED_OFFSET}px`);
			expect(panel().classes()).not.toContain('no-transition');
		});

		it('snaps back when released before the halfway point', async () => {
			await drag([10, 20]);

			expect(wrapper.vm.isExpanded).toBe(false);
			expect(marginTop()).toBe(`${COLLAPSED_OFFSET}px`);
		});

		it('does not let the click that ends a drag toggle the panel', async () => {
			await drag([40, 120]);
			expect(wrapper.vm.isExpanded).toBe(true);

			// the browser fires click right after pointerup
			await handle().trigger('click');

			expect(wrapper.vm.isExpanded).toBe(true);
		});

		it('still toggles when the pointer barely moved', async () => {
			await drag([2]);
			await handle().trigger('click');

			expect(wrapper.vm.isExpanded).toBe(true);
		});

		it('ignores a non-primary mouse button', async () => {
			await handle().trigger('pointerdown', { clientY: 0, pointerType: 'mouse', button: 2, pointerId: 1 });
			await handle().trigger('pointermove', { clientY: 120, pointerType: 'mouse', pointerId: 1 });

			expect(marginTop()).toBe(`${COLLAPSED_OFFSET}px`);
		});

		it('snaps to the nearest position when a touch drag is cancelled', async () => {
			await handle().trigger('pointerdown', { clientY: 0, pointerType: 'touch', pointerId: 2 });
			await handle().trigger('pointermove', { clientY: 80, pointerType: 'touch', pointerId: 2 });
			await handle().trigger('pointercancel', { clientY: 80, pointerType: 'touch', pointerId: 2 });

			expect(panel().classes()).not.toContain('no-transition');
			expect(marginTop()).toBe(`${EXPANDED_OFFSET}px`);
		});
	});

	describe('Action footer', () => {
		it('offers a download when no printer is connected', () => {
			expect(wrapper.find('[data-testid="download-image-button"]').exists()).toBe(true);
			expect(wrapper.find('[data-testid="print-image-button"]').exists()).toBe(false);
		});

		it('offers printing and a download icon once a printer is connected', async () => {
			await wrapper.setProps({ config: { connection: true, type: InstaxFilmVariant.SQUARE } });

			expect(wrapper.find('[data-testid="print-image-button"]').exists()).toBe(true);
			expect(wrapper.find('[data-testid="download-image-icon-button"]').exists()).toBe(true);
			expect(wrapper.find('[data-testid="download-image-button"]').exists()).toBe(false);
		});

		it('keeps the film look with the alignment controls, not with the actions', () => {
			// it is something done to the picture, like the rotation and the fit
			// buttons, rather than something done with the finished polaroid
			const film = wrapper.find('[data-testid="open-film-button"]')

			expect(wrapper.find('.image-controls').find('[data-testid="open-film-button"]').exists())
				.toBe(true)
			expect(wrapper.find('.print-download-action-buttons')
				.find('[data-testid="open-film-button"]').exists()).toBe(false)
			expect(film.attributes('aria-label')).toBe('Open the film look settings')
		});

		it('asks for the film look dialog when pressed', async () => {
			await wrapper.find('[data-testid="open-film-button"]').trigger('click');

			expect(wrapper.emitted('open-film')).toHaveLength(1);
		});

		it('stays reachable while the settings are collapsed', () => {
			// the footer is the part of the panel that is never pulled out of sight
			expect(wrapper.vm.isExpanded).toBe(false);
			expect(wrapper.find('.panel-footer').find('[data-testid="download-image-button"]').exists()).toBe(true);
		});

		it('asks for a print when the printer is connected', async () => {
			await wrapper.setProps({ config: { connection: true, type: InstaxFilmVariant.SQUARE } });
			await wrapper.find('[data-testid="print-image-button"]').trigger('click');

			expect(savePolaroid).toHaveBeenCalledWith(false);
		});

		it('asks for a download from the icon button', async () => {
			await wrapper.setProps({ config: { connection: true, type: InstaxFilmVariant.SQUARE } });
			await wrapper.find('[data-testid="download-image-icon-button"]').trigger('click');

			expect(savePolaroid).toHaveBeenCalledWith(true);
		});

		it('disables the download and shows a spinner while rendering', async () => {
			expect(wrapper.find('[data-testid="download-image-button"]').attributes('disabled')).toBeUndefined();

			await wrapper.setProps({ savingAction: 'download' });

			const download = wrapper.find('[data-testid="download-image-button"]');
			expect(download.attributes('disabled')).toBeDefined();
			expect(download.find('.button-spinner').exists()).toBe(true);
			expect(download.find('img').exists()).toBe(false);
		});

		it('does not start a second render while one is running', async () => {
			await wrapper.setProps({ savingAction: 'download' });

			await wrapper.find('[data-testid="download-image-button"]').trigger('click');

			expect(savePolaroid).not.toHaveBeenCalled();
		});

		describe('With a printer connected', () => {
			beforeEach(async () => {
				await wrapper.setProps({ config: { connection: true, type: InstaxFilmVariant.SQUARE } });
			});

			const printButton = () => wrapper.find('[data-testid="print-image-button"]');
			const downloadIconButton = () => wrapper.find('[data-testid="download-image-icon-button"]');

			it('spins only the download when the download was pressed', async () => {
				await wrapper.setProps({ savingAction: 'download' });

				expect(downloadIconButton().find('.button-spinner').exists()).toBe(true);
				expect(printButton().find('.button-spinner').exists()).toBe(false);

				// the print is out of action, but it is not the one reporting progress
				expect(printButton().attributes('disabled')).toBeDefined();
			});

			it('spins only the print when the print was pressed', async () => {
				await wrapper.setProps({ savingAction: 'print' });

				expect(printButton().find('.button-spinner').exists()).toBe(true);
				expect(downloadIconButton().find('.button-spinner').exists()).toBe(false);
				expect(downloadIconButton().attributes('disabled')).toBeDefined();
			});

			it('leaves both usable when nothing is rendering', () => {
				expect(printButton().attributes('disabled')).toBeUndefined();
				expect(downloadIconButton().attributes('disabled')).toBeUndefined();
				expect(wrapper.find('.button-spinner').exists()).toBe(false);
			});
		});

		it('disables the grab handle while rendering', async () => {
			expect(handle().attributes('disabled')).toBeUndefined();

			await wrapper.setProps({ savingAction: 'download' });

			expect(handle().attributes('disabled')).toBeDefined();
		});

		it('cannot be expanded by click or drag while rendering', async () => {
			await wrapper.setProps({ savingAction: 'download' });

			await handle().trigger('click');
			expect(wrapper.vm.isExpanded).toBe(false);

			await drag([40, 120]);
			expect(wrapper.vm.isExpanded).toBe(false);
			expect(marginTop()).toBe(`${COLLAPSED_OFFSET}px`);
		});

		it('disables printing once the queue is full', async () => {
			await wrapper.setProps({
				config: { connection: true, type: InstaxFilmVariant.SQUARE }, queueLength: 11
			});

			const style = wrapper.find('[data-testid="print-image-button"]').attributes('style');
			expect(style).toContain('opacity: 0.2');
			expect(style).toContain('not-allowed');
		});

		it('leaves printing alone while there is still room', async () => {
			// the limit is ten; this test used to sit at three, which stopped matching
			// when the queue was allowed to grow
			await wrapper.setProps({
				config: { connection: true, type: InstaxFilmVariant.SQUARE }, queueLength: 10
			});

			expect(wrapper.find('[data-testid="print-image-button"]').attributes('style'))
				.toBeFalsy();
		});
	});

	describe('Reachable only while it is open', () => {
		const wrap = () => wrapper.find('.settings-wrap');

		it('takes the controls out of the tab order while collapsed', () => {
			// they sit behind the polaroid, so Tab and Shift Tab must not find them
			expect(wrapper.vm.isExpanded).toBe(false);
			expect(wrap().attributes('inert')).toBeDefined();
		});

		it('gives them back once it is open', async () => {
			await wrapper.find('[data-testid="expand-handle"]').trigger('click');

			expect(wrapper.vm.isExpanded).toBe(true);
			expect(wrap().attributes('inert')).toBeUndefined();
		});

		it('lets go of a focused control as it closes', async () => {
			await wrapper.find('[data-testid="expand-handle"]').trigger('click');

			const button = wrapper.find('[data-testid="align-horizontal-button"]')
				.element as HTMLButtonElement;
			button.focus();
			expect(document.activeElement).toBe(button);

			await wrapper.find('[data-testid="expand-handle"]').trigger('click');

			// otherwise the focus ring would be left sitting on something hidden
			expect(document.activeElement).not.toBe(button);
		});

		it('leaves focus outside the panel alone', async () => {
			await wrapper.find('[data-testid="expand-handle"]').trigger('click');

			const handle = wrapper.find('[data-testid="expand-handle"]').element as HTMLElement;
			handle.focus();

			await wrapper.find('[data-testid="expand-handle"]').trigger('click');

			expect(document.activeElement).toBe(handle);
		});
	});

	describe('Keyboard', () => {
		const press = (key: string) => {
			document.dispatchEvent(new KeyboardEvent('keydown', { key, cancelable: true }));
		};

		it('opens and closes the panel', async () => {
			expect(wrapper.vm.isExpanded).toBe(false);

			press('s');
			await nextTick();
			expect(wrapper.vm.isExpanded).toBe(true);

			press('s');
			await nextTick();
			expect(wrapper.vm.isExpanded).toBe(false);
		});

		it('hands a move on to the editor', () => {
			press('ArrowRight');

			expect(wrapper.emitted('move')).toEqual([[{ x: 1, y: 0 }]]);
		});

		it('names its own shortcut on the handle', () => {
			expect(wrapper.find('[data-testid="expand-handle"]').attributes('title')).toContain('(S)');
		});
	});

	describe('Forwarding to the editor', () => {
		it('re-emits the settings change from ImageSettings', async () => {
			await wrapper.find('[data-testid="rotation-input"]').setValue('45');

			const emitted = wrapper.emitted('change');
			expect(emitted).toBeTruthy();
			expect(emitted![emitted!.length - 1][0]).toMatchObject({ rotation: 45 });
		});

		it('re-emits the alignment request', async () => {
			await wrapper.find('[data-testid="align-horizontal-button"]').trigger('click');

			expect(wrapper.emitted('scale')![0]).toEqual(['horizontal']);
		});

		it('collapses the panel before saving so it is out of the frame', async () => {
			await handle().trigger('click');
			expect(wrapper.vm.isExpanded).toBe(true);

			await wrapper.find('[data-testid="download-image-button"]').trigger('click');

			expect(savePolaroid).toHaveBeenCalledWith(true);
			expect(wrapper.vm.isExpanded).toBe(false);
		});

		it('stays collapsed when saving from the collapsed state', async () => {
			await wrapper.find('[data-testid="download-image-button"]').trigger('click');

			expect(savePolaroid).toHaveBeenCalled();
			expect(wrapper.vm.isExpanded).toBe(false);
		});
	});

	describe('Reacting to the image', () => {
		it('is shown once an image is loaded', async () => {
			wrapper.unmount();
			mountComponent({ hasImage: false });
			expect(panel().isVisible()).toBe(false);

			await wrapper.setProps({ hasImage: true });
			await flush();

			expect(panel().isVisible()).toBe(true);
		});

		it('re-measures itself when revealed, since it has no box while hidden', async () => {
			wrapper.unmount();
			// hidden on mount, so the first measurement sees a collapsed box
			mockHeights(0, 0);
			mountComponent({ hasImage: false });

			mockHeights(PANEL_HEIGHT);
			await wrapper.setProps({ hasImage: true });
			await flush();

			// it rests on the offset for the height measured on reveal, which is
			// only possible if it was re-measured
			expect(marginTop()).toBe(`${COLLAPSED_OFFSET}px`);
		});

		it('comes up collapsed, showing only the action footer', async () => {
			wrapper.unmount();
			mountComponent({ hasImage: false });

			await wrapper.setProps({ hasImage: true });
			await flush();

			expect(wrapper.vm.isExpanded).toBe(false);
			expect(marginTop()).toBe(`${COLLAPSED_OFFSET}px`);
			expect(wrapper.find('[data-testid="download-image-button"]').exists()).toBe(true);
		});

		// walk the reveal tick by tick, recording where the panel sat and whether a
		// transition was live at that point
		const recordReveal = async () => {
			wrapper.unmount();
			// a hidden panel has no box, exactly as the browser reports it
			mockHeights(0, 0);
			mountComponent({ hasImage: false });

			mockHeights(PANEL_HEIGHT);
			wrapper.setProps({ hasImage: true });

			const frames: { offset: string, animated: boolean }[] = [];
			for (let tick = 0; tick < 8; tick++) {
				await nextTick();
				frames.push({ offset: marginTop(), animated: !panel().classes().includes('no-transition') });
			}
			return frames;
		};

		it('slides out from behind the frame and stops at the collapsed position', async () => {
			const frames = await recordReveal();
			const offsets = frames.map((frame) => frame.offset);

			const hiddenAt = offsets.indexOf(`${HIDDEN_OFFSET}px`);
			const collapsedAt = offsets.indexOf(`${COLLAPSED_OFFSET}px`);

			// hidden first, then collapsed: that ordering is the animation
			expect(hiddenAt).toBeGreaterThanOrEqual(0);
			expect(collapsedAt).toBeGreaterThan(hiddenAt);

			expect(offsets[offsets.length - 1]).toBe(`${COLLAPSED_OFFSET}px`);
			expect(wrapper.vm.isExpanded).toBe(false);
		});

		it('never animates before it reaches the hidden starting position', async () => {
			const frames = await recordReveal();
			const hiddenAt = frames.findIndex((frame) => frame.offset === `${HIDDEN_OFFSET}px`);

			// this is the regression that made the panel appear open and then close:
			// a stale offset left animatable while it was corrected
			for (const frame of frames.slice(0, hiddenAt)) {
				expect(frame.animated).toBe(false);
			}
		});

		it('has the transition live while still at the hidden position', async () => {
			const frames = await recordReveal();

			// the starting offset has to be committed and only then made animatable,
			// otherwise the move to collapsed jumps instead of sliding
			expect(frames.some((frame) => frame.offset === `${HIDDEN_OFFSET}px` && frame.animated)).toBe(true);
		});

		it('puts transitions back once it has settled, so opening animates', async () => {
			wrapper.unmount();
			mountComponent({ hasImage: false });

			wrapper.setProps({ hasImage: true });
			await flush();

			expect(panel().classes()).not.toContain('no-transition');

			await handle().trigger('click');
			expect(marginTop()).toBe(`${EXPANDED_OFFSET}px`);
		});

		describe('Sliding back out of sight', () => {
			// the reverse of the reveal: it has to stay on screen for the slide
			const removeImage = async () => {
				await wrapper.setProps({ hasImage: false });
				await flush();
			};

			it('stays visible while it slides back behind the frame', async () => {
				await removeImage();

				expect(panel().isVisible()).toBe(true);
				expect(marginTop()).toBe(`${HIDDEN_OFFSET}px`);
			});

			it('animates rather than snapping away', async () => {
				await removeImage();

				expect(panel().classes()).not.toContain('no-transition');
			});

			it('leaves the layout once the slide has finished', async () => {
				vi.useFakeTimers();
				wrapper.setProps({ hasImage: false });
				await flush();

				await vi.advanceTimersByTimeAsync(250);
				await flush();

				expect(panel().isVisible()).toBe(false);
				vi.useRealTimers();
			});

			it('does not linger when the panel was never on screen', async () => {
				wrapper.unmount();
				mockHeights(0, 0);
				mountComponent({ hasImage: false });

				await wrapper.setProps({ hasImage: false });
				await flush();

				expect(panel().isVisible()).toBe(false);
			});

			it('abandons the slide when a new image arrives mid-way', async () => {
				wrapper.setProps({ hasImage: false });
				await nextTick();

				await wrapper.setProps({ hasImage: true });
				await flush();

				expect(panel().isVisible()).toBe(true);
				expect(marginTop()).toBe(`${COLLAPSED_OFFSET}px`);
			});
		});

		it('collapses when the image is removed', async () => {
			await handle().trigger('click');
			expect(wrapper.vm.isExpanded).toBe(true);

			await wrapper.setProps({ hasImage: false });

			expect(wrapper.vm.isExpanded).toBe(false);
		});

		it('stays collapsed for a replacement image', async () => {
			await handle().trigger('click');
			expect(wrapper.vm.isExpanded).toBe(true);

			await wrapper.setProps({ hasImage: false });
			await wrapper.setProps({ hasImage: true });
			await flush();

			expect(wrapper.vm.isExpanded).toBe(false);
		});

		it('abandons the reveal if the image is removed again mid-animation', async () => {
			vi.useFakeTimers();
			wrapper.unmount();
			mountComponent({ hasImage: false });

			wrapper.setProps({ hasImage: true });
			await nextTick();
			// removed again before the reveal finished
			wrapper.setProps({ hasImage: false });
			await flush();
			await vi.advanceTimersByTimeAsync(250);
			await flush();

			expect(wrapper.vm.isExpanded).toBe(false);
			expect(panel().isVisible()).toBe(false);
			// not left stuck without a transition for the next reveal
			expect(panel().classes()).not.toContain('no-transition');
			vi.useRealTimers();
		});

		it('still settles correctly for the image that follows an abandoned reveal', async () => {
			wrapper.unmount();
			mountComponent({ hasImage: false });

			wrapper.setProps({ hasImage: true });
			await nextTick();
			wrapper.setProps({ hasImage: false });
			await nextTick();
			await wrapper.setProps({ hasImage: true });
			await flush();

			expect(marginTop()).toBe(`${COLLAPSED_OFFSET}px`);
			expect(panel().classes()).not.toContain('no-transition');
		});

		it('can be opened by hand once revealed', async () => {
			wrapper.unmount();
			mountComponent({ hasImage: false });
			await wrapper.setProps({ hasImage: true });
			await flush();

			await handle().trigger('click');

			expect(wrapper.vm.isExpanded).toBe(true);
			expect(marginTop()).toBe(`${EXPANDED_OFFSET}px`);
		});
	});

	describe('Observing its own height', () => {
		it('re-measures through a ResizeObserver when available', async () => {
			const observe = vi.fn();
			const disconnect = vi.fn();
			let trigger: (() => void) | null = null;

			vi.stubGlobal('ResizeObserver', class {
				constructor(callback: () => void) { trigger = callback; }
				observe = observe;
				unobserve = vi.fn();
				disconnect = disconnect;
			});

			wrapper.unmount();
			mountComponent();
			expect(observe).toHaveBeenCalled();

			mockHeights(260);
			trigger!();
			await nextTick();
			expect(marginTop()).toBe(`${-(260 - FOOTER_HEIGHT)}px`);

			wrapper.unmount();
			expect(disconnect).toHaveBeenCalled();

			vi.unstubAllGlobals();
		});

		it('mounts and unmounts without a ResizeObserver', () => {
			vi.stubGlobal('ResizeObserver', undefined);

			expect(() => {
				mountComponent();
				wrapper.unmount();
			}).not.toThrow();

			vi.unstubAllGlobals();
		});
	});
});
