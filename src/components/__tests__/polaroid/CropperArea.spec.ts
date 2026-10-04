import { mount, type VueWrapper } from '@vue/test-utils'
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { nextTick } from 'vue'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { cssOf } from '../css'

import {
	konvaMock, resetKonvaMock, lastStage, lastLayer, lastImage, lastRect, stages, images
} from './konva.mock'

// vi.mock is hoisted above the module body, so the spies have to be too
const { downloadPolaroid, compressedImage } = vi.hoisted(() => ({
	downloadPolaroid: vi.fn(async () => 'download-url'),
	compressedImage: vi.fn(async () => 'print-url')
}))

vi.mock('konva', () => ({ default: konvaMock }))
vi.mock('../../../cropper/cropper.download', () => ({ downloadPolaroid }))
vi.mock('../../../cropper/cropper.print', () => ({ compressedImage }))

import CropperArea from '../../polaroid/CropperArea.vue'
import { InstaxFilmVariant } from '../../../interfaces/PrinterStateConfig'
import { NEUTRAL_ADJUSTMENTS } from '../../../polaroid/film'

const SOURCE = 'data:image/png;base64,first'

// the container is sized by CSS, which jsdom does not evaluate, so its box is
// stubbed and changed by hand to simulate a responsive layout change
let containerBox = { width: 320, height: 320 }
let loadedImages: FakeImage[] = []

class FakeImage {
	width = 1000
	height = 500
	onload: (() => void) | null = null
	private _src = ''

	constructor() { loadedImages.push(this) }

	set src(value: string) {
		this._src = value;
		// the browser fires load asynchronously; tests decide when
	}

	get src() { return this._src }

	emitLoad(width = this.width, height = this.height) {
		this.width = width;
		this.height = height;
		this.onload?.();
	}
}

describe('CropperArea responsive canvas', () => {
	let wrapper: VueWrapper
	let resizeObservers: { callback: () => void, disconnect: ReturnType<typeof vi.fn> }[] = []

	const mountComponent = (props = {}) => {
		wrapper = mount(CropperArea, {
			attachTo: document.body,
			props: {
				src: SOURCE,
				loading: false,
				config: { connection: false, type: InstaxFilmVariant.SQUARE },
				settings: { rotation: 0, color: '#FFFFFF', text: '' },
				adjustments: NEUTRAL_ADJUSTMENTS,
				...props
			}
		});
		return wrapper;
	};

	// finish loading the source image so a stage with an image exists
	const loadSource = async () => {
		loadedImages[loadedImages.length - 1].emitLoad();
		await nextTick();
	};

	const resizeContainerTo = async (width: number, height: number) => {
		containerBox = { width, height };
		resizeObservers.forEach(({ callback }) => callback());
		vi.advanceTimersByTime(50);
		await nextTick();
	};

	beforeEach(() => {
		vi.useFakeTimers();
		resetKonvaMock();
		loadedImages = [];
		resizeObservers = [];
		containerBox = { width: 320, height: 320 };

		vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(
			() => ({ ...containerBox, top: 0, left: 0, bottom: 0, right: 0, x: 0, y: 0, toJSON: () => ({}) }) as DOMRect
		);

		// the export hands the browser a frame between its phases so the loading
		// animation keeps painting; under fake timers nothing would ever give it one
		vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
			callback(0);
			return 1;
		});

		vi.stubGlobal('Image', FakeImage);
		vi.stubGlobal('ResizeObserver', class {
			disconnect = vi.fn()
			unobserve = vi.fn()
			constructor(callback: () => void) { resizeObservers.push({ callback, disconnect: this.disconnect }) }
			observe() { /* observation is simulated through resizeContainerTo */ }
		});
	});

	afterEach(() => {
		wrapper?.unmount();
		vi.useRealTimers();
		vi.unstubAllGlobals();
		vi.restoreAllMocks();
	});

	describe('Set up', () => {
		it('creates a stage matching the container box', () => {
			mountComponent();

			expect(stages).toHaveLength(1);
			expect(lastStage().width()).toBe(320);
			expect(lastStage().height()).toBe(320);
		});

		it('fits the image and its background into the stage once loaded', async () => {
			mountComponent();
			await loadSource();

			// a landscape image covers a square stage by matching its height
			expect(lastImage().scaleX()).toBeCloseTo(320 / 500);
			expect(lastRect().width()).toBe(320);
			expect(lastRect().height()).toBe(320);
			// background, photo, and the film faults on top
			expect(lastLayer().children).toHaveLength(2);
		});

		it('leaves the stage unsized while the container has no box', async () => {
			containerBox = { width: 0, height: 0 };
			mountComponent();
			await loadSource();

			expect(lastStage().width()).toBe(0);
			// no image is placed yet: fitting against a zero box would be meaningless
			expect(lastLayer().children).toHaveLength(0);
		});

		it('fits the image once the container is measured for the first time', async () => {
			containerBox = { width: 0, height: 0 };
			mountComponent();
			await loadSource();

			await resizeContainerTo(320, 320);

			expect(lastStage().width()).toBe(320);
			// background, photo, and the film faults on top
			expect(lastLayer().children).toHaveLength(2);
			expect(lastImage().scaleX()).toBeCloseTo(320 / 500);
		});

		it('still wires up the canvas listeners after a late first measurement', async () => {
			containerBox = { width: 0, height: 0 };
			mountComponent();
			await loadSource();
			await resizeContainerTo(320, 320);

			const stage = lastStage();
			stage.pointer = { x: 160, y: 160 };
			stage.fire('wheel', { evt: { preventDefault: vi.fn(), deltaY: -1 } });

			expect(stage.scaleX()).toBeCloseTo(1.05);
		});
	});

	describe('Syncing to the container', () => {
		beforeEach(async () => {
			mountComponent();
			await loadSource();
		});

		it('resizes the stage when the container grows', async () => {
			await resizeContainerTo(640, 640);

			expect(lastStage().width()).toBe(640);
			expect(lastStage().height()).toBe(640);
		});

		it('scales zoom and pan proportionally instead of resetting the framing', async () => {
			const stage = lastStage();
			stage.scale({ x: 2, y: 2 });
			stage.position({ x: -100, y: -50 });

			await resizeContainerTo(640, 640);

			// container doubled, so the framing doubles with it
			expect(stage.scaleX()).toBeCloseTo(4);
			expect(stage.position()).toEqual({ x: -200, y: -100 });
		});

		it('keeps the zoom uniform when the aspect ratio changes', async () => {
			const stage = lastStage();
			stage.scale({ x: 2, y: 2 });

			await resizeContainerTo(480, 320);

			// the box changed shape but not height, so the zoom is left alone, and
			// both axes must carry the same value however it got there
			expect(stage.scaleX()).toBeCloseTo(2);
			expect(stage.scaleX()).toBe(stage.scaleY());
		});

		it('does not resize the photo when only the film type changes', async () => {
			// all three crop windows are the same height, 331 to 334, and differ only
			// in width, so a film type change is a change of shape and not of size:
			// the photo keeps its size and the narrower frame simply crops more
			const stage = lastStage();
			await resizeContainerTo(491, 331);   // wide
			stage.scale({ x: 1, y: 1 });

			await resizeContainerTo(331, 331);   // square

			expect(stage.scaleX()).toBeCloseTo(1);
		});

		it('comes back to the same size after a round trip through the film types', async () => {
			// taking the smaller of the two factors shrank the photo on the way to a
			// narrower frame and did not grow it back on the way out, so every trip
			// through the sizes left the photo smaller than it found it
			const stage = lastStage();
			await resizeContainerTo(491, 331);   // wide
			stage.scale({ x: 1, y: 1 });

			for (const [width, height] of [[331, 331], [254, 334], [491, 331]]) {
				await resizeContainerTo(width, height);
			}

			expect(stage.scaleX()).toBeCloseTo(1);
		});

		it('keeps the middle of the window on the same part of the photo', async () => {
			// a narrower frame crops in from both sides rather than sliding the photo
			// out to one of them
			const stage = lastStage();
			stage.scale({ x: 1, y: 1 });
			stage.position({ x: 0, y: 0 });

			const centreBefore = (stage.width() / 2 - stage.x()) / stage.scaleX();
			await resizeContainerTo(200, 320);

			expect((stage.width() / 2 - stage.x()) / stage.scaleX()).toBeCloseTo(centreBefore);
		});

		it('grows the background rect to keep covering the stage', async () => {
			await resizeContainerTo(640, 480);

			expect(lastRect().width()).toBe(640);
			expect(lastRect().height()).toBe(480);
			expect(lastRect().absolutePosition()).toEqual({ x: 0, y: 0 });
		});

		it('counter-scales the background rect against the stage zoom', async () => {
			lastStage().scale({ x: 2, y: 2 });

			await resizeContainerTo(640, 640);

			expect(lastRect().scaleX()).toBeCloseTo(1 / lastStage().scaleX());
		});

		it('ignores sub-pixel jitter', async () => {
			const stage = lastStage();
			stage.scale({ x: 1, y: 1 });

			await resizeContainerTo(320.2, 320.3);

			expect(stage.width()).toBe(320);
			expect(stage.scaleX()).toBe(1);
		});

		it('debounces a burst of resizes into a single sync', async () => {
			lastLayer().batchDraw.mockClear();

			containerBox = { width: 400, height: 400 };
			resizeObservers.forEach(({ callback }) => callback());
			containerBox = { width: 500, height: 500 };
			resizeObservers.forEach(({ callback }) => callback());
			containerBox = { width: 600, height: 600 };
			resizeObservers.forEach(({ callback }) => callback());
			vi.advanceTimersByTime(50);
			await nextTick();

			expect(lastStage().width()).toBe(600);
			expect(lastLayer().batchDraw).toHaveBeenCalledTimes(1);
		});

		it('keeps the same stage across a film type change', async () => {
			// the frame aspect ratio changes, the canvas must not be rebuilt
			await wrapper.setProps({ config: { connection: false, type: InstaxFilmVariant.WIDE } });
			await resizeContainerTo(500, 337);

			expect(stages).toHaveLength(1);
			expect(lastStage().width()).toBe(500);
			expect(lastStage().height()).toBe(337);
		});
	});

	describe('Without a ResizeObserver', () => {
		it('falls back to the window resize event', async () => {
			vi.stubGlobal('ResizeObserver', undefined);
			mountComponent();
			await loadSource();

			containerBox = { width: 640, height: 640 };
			window.dispatchEvent(new Event('resize'));
			vi.advanceTimersByTime(50);
			await nextTick();

			expect(lastStage().width()).toBe(640);
		});

		it('stops listening after unmount', async () => {
			vi.stubGlobal('ResizeObserver', undefined);
			mountComponent();
			await loadSource();
			const stage = lastStage();

			wrapper.unmount();

			containerBox = { width: 640, height: 640 };
			window.dispatchEvent(new Event('resize'));
			vi.advanceTimersByTime(50);

			expect(stage.width()).toBe(320);
		});
	});

	describe('Tear down', () => {
		it('disconnects the observer and destroys the stage', async () => {
			mountComponent();
			await loadSource();
			const stage = lastStage();

			wrapper.unmount();

			expect(resizeObservers[0].disconnect).toHaveBeenCalled();
			expect(stage.destroyed).toBe(true);
		});
	});

	describe('Changing the image', () => {
		it('reloads the canvas when a new source arrives without a remount', async () => {
			mountComponent();
			await loadSource();
			const imageCount = images.length;

			await wrapper.setProps({ src: 'data:image/png;base64,second' });
			loadedImages[loadedImages.length - 1].emitLoad(500, 1000);
			await nextTick();

			expect(stages).toHaveLength(1);
			expect(images.length).toBeGreaterThan(imageCount);
			// the portrait replacement covers the stage by matching its width
			expect(lastImage().scaleY()).toBeCloseTo(320 / 500);
		});
	});

	describe('Zooming', () => {
		beforeEach(async () => {
			mountComponent();
			await loadSource();
		});

		const wheel = (deltaY: number) => lastStage().fire('wheel', {
			evt: { preventDefault: vi.fn(), deltaY }
		});

		it('zooms in and out around the pointer', () => {
			const stage = lastStage();
			stage.pointer = { x: 160, y: 160 };

			wheel(-1);
			expect(stage.scaleX()).toBeCloseTo(1.05);

			wheel(1);
			expect(stage.scaleX()).toBeCloseTo(1.05 * 0.95);
		});

		it('never zooms out past the minimum', () => {
			const stage = lastStage();
			stage.pointer = { x: 0, y: 0 };

			for (let step = 0; step < 200; step++) wheel(1);

			expect(stage.scaleX()).toBeCloseTo(0.25);
		});

		it('never zooms in past the maximum', () => {
			const stage = lastStage();
			stage.pointer = { x: 0, y: 0 };

			for (let step = 0; step < 200; step++) wheel(-1);

			expect(stage.scaleX()).toBeCloseTo(5);
		});

		it('does not double up its listeners when the source changes', async () => {
			const stage = lastStage();
			stage.pointer = { x: 160, y: 160 };

			await wrapper.setProps({ src: 'data:image/png;base64,second' });
			loadedImages[loadedImages.length - 1].emitLoad();
			await nextTick();

			wheel(-1);

			// a second registration would apply the zoom step twice
			expect(stage.scaleX()).toBeCloseTo(1.05);
		});

		it('clamps pinch zoom to the same bounds', () => {
			const stage = lastStage();
			const pinch = (distance: number, previous: number) => {
				stage.fire('touchend');
				stage.fire('touchmove', {
					evt: { preventDefault: vi.fn(), touches: [{ clientX: 0, clientY: 0 }, { clientX: previous, clientY: 0 }] }
				});
				stage.fire('touchmove', {
					evt: { preventDefault: vi.fn(), touches: [{ clientX: 0, clientY: 0 }, { clientX: distance, clientY: 0 }] }
				});
			};

			pinch(10000, 10);
			expect(stage.scaleX()).toBeLessThanOrEqual(5);

			pinch(1, 10000);
			expect(stage.scaleX()).toBeGreaterThanOrEqual(0.25);
		});
	});

	describe('Settings', () => {
		it('rotates the image by the delta', async () => {
			mountComponent();
			await loadSource();

			await wrapper.setProps({ settings: { rotation: 90, color: '#FFFFFF', text: '' } });
			expect(lastImage().rotation()).toBe(90);

			await wrapper.setProps({ settings: { rotation: 45, color: '#FFFFFF', text: '' } });
			expect(lastImage().rotation()).toBe(45);
		});

		it('does not throw when the rotation changes before the image is loaded', async () => {
			mountComponent();

			await expect(
				wrapper.setProps({ settings: { rotation: 90, color: '#FFFFFF', text: '' } })
			).resolves.not.toThrow();
		});

		it('repaints the background with the chosen colour', async () => {
			mountComponent();
			await loadSource();

			await wrapper.setProps({ settings: { rotation: 0, color: '#ff0000', text: '' } });

			expect(lastRect().fill()).toBe('#ff0000');
		});
	});

	describe('Alignment', () => {
		it('refits the image to the stage width or height on request', async () => {
			mountComponent();
			await loadSource();

			wrapper.vm.fit(false);
			await nextTick();
			expect(lastImage().scaleY()).toBeCloseTo(320 / 500);

			wrapper.vm.fit(true);
			await nextTick();
			expect(lastImage().scaleX()).toBeCloseTo(320 / 1000);
		});
	});

	describe('Reporting what the framing already is', () => {
		// each control lights up while its own state holds, so this has to be right
		// after anything that moves or scales the image, not only after a button
		const reported = () => {
			const emitted = wrapper.emitted('alignment');
			return emitted?.[emitted.length - 1][0] as Record<string, boolean>;
		};

		it('reports a fresh image as fitted and centred', async () => {
			// a 1000x500 photo in a 320x320 frame is fitted to the height it covers,
			// and fitImage places it dead centre
			mountComponent();
			await loadSource();

			expect(reported()).toEqual({
				fitsWidth: false,
				fitsHeight: true,
				centredHorizontally: true,
				centredVertically: true
			});
		});

		it('follows a fit onto the other axis', async () => {
			mountComponent();
			await loadSource();

			wrapper.vm.fit(true);
			await nextTick();

			expect(reported()).toMatchObject({ fitsWidth: true, fitsHeight: false });
		});

		it('drops the centring once the image is panned off the line', async () => {
			mountComponent();
			await loadSource();

			const stage = lastStage();
			stage.position({ x: -80, y: -40 });
			wrapper.vm.measureAlignment(true);

			expect(reported()).toMatchObject({
				centredHorizontally: false, centredVertically: false
			});
		});

		it('notices a zoom, which is neither fit any more', async () => {
			// Zooming scales the stage and never touches the image node, so reading the
			// node's own scale would call it fitted for ever. Zoomed about the middle,
			// so the photo stays centred and only its span changes: otherwise the
			// centring would go and carry the fit with it for the wrong reason.
			mountComponent();
			await loadSource();
			expect(reported().fitsHeight).toBe(true);

			const stage = lastStage();
			const zoom = 2.5;
			stage.scale({ x: zoom, y: zoom });
			stage.position({
				x: stage.width() / 2 - lastImage().x() * zoom,
				y: stage.height() / 2 - lastImage().y() * zoom
			});

			wrapper.vm.measureAlignment(true);

			expect(reported()).toMatchObject({
				fitsWidth: false, fitsHeight: false,
				centredHorizontally: true, centredVertically: true
			});
		});

		it('drops the fit once the photo is panned off that axis', async () => {
			// it still spans as much of the frame, but no longer from edge to edge
			mountComponent();
			await loadSource();
			expect(reported().fitsHeight).toBe(true);

			lastStage().position({ x: 0, y: -40 });
			wrapper.vm.measureAlignment(true);

			expect(reported()).toMatchObject({ fitsHeight: false, centredVertically: false });
		});

		it('keeps a fit while the photo moves along the axis it fills', async () => {
			// a photo fitted to the height may be slid sideways and still fill it
			mountComponent();
			await loadSource();

			lastStage().position({ x: -60, y: 0 });
			wrapper.vm.measureAlignment(true);

			expect(reported()).toMatchObject({ fitsHeight: true, centredHorizontally: false });
		});

		it('drops a width fit under zoom too, not only a height one', async () => {
			mountComponent();
			await loadSource();
			wrapper.vm.fit(true);
			expect(reported().fitsWidth).toBe(true);

			const stage = lastStage();
			const zoom = 2;
			stage.scale({ x: zoom, y: zoom });
			stage.position({
				x: stage.width() / 2 - lastImage().x() * zoom,
				y: stage.height() / 2 - lastImage().y() * zoom
			});

			wrapper.vm.measureAlignment(true);

			expect(reported()).toMatchObject({ fitsWidth: false, centredHorizontally: true });
		});

		it('drops a width fit once the photo is panned sideways', async () => {
			// the mirror of the case above, so neither axis is left unguarded
			mountComponent();
			await loadSource();
			wrapper.vm.fit(true);
			expect(reported().fitsWidth).toBe(true);

			lastStage().position({ x: -60, y: 0 });
			wrapper.vm.measureAlignment(true);

			expect(reported()).toMatchObject({ fitsWidth: false, centredHorizontally: false });
		});

		it('says nothing at all before there is an image to frame', () => {
			// the controls start out unlit anyway, so there is nothing to report yet
			mountComponent();

			expect(wrapper.emitted('alignment')).toBeUndefined();
		});

		it('clears what it reported once a different image is chosen', async () => {
			mountComponent();
			await loadSource();
			expect(reported().fitsHeight).toBe(true);

			await wrapper.setProps({ src: 'data:image/png;base64,second' });

			// the old framing must not linger over the new photo while it loads
			expect(reported()).toEqual({
				fitsWidth: false,
				fitsHeight: false,
				centredHorizontally: false,
				centredVertically: false
			});
		});
	});

	describe('Centring on an axis', () => {
		it('puts the image back on the vertical centre line, leaving the other axis', async () => {
			mountComponent();
			await loadSource();

			const stage = lastStage();
			stage.position({ x: -80, y: -40 });

			wrapper.vm.centre(false);

			// only y moves: the frame's centre now sits on the image's own centre
			expect(stage.y()).toBeCloseTo(stage.height() / 2 - lastImage().y() * stage.scaleY());
			expect(stage.x()).toBe(-80);
		});

		it('puts it back on the horizontal centre line the same way', async () => {
			mountComponent();
			await loadSource();

			const stage = lastStage();
			stage.position({ x: -80, y: -40 });

			wrapper.vm.centre(true);

			expect(stage.x()).toBeCloseTo(stage.width() / 2 - lastImage().x() * stage.scaleX());
			expect(stage.y()).toBe(-40);
		});

		it('reports the new framing straight away', async () => {
			mountComponent();
			await loadSource();

			lastStage().position({ x: -80, y: -40 });
			wrapper.vm.centre(true);

			const emitted = wrapper.emitted('alignment');
			expect((emitted?.[emitted.length - 1][0] as Record<string, boolean>).centredHorizontally)
				.toBe(true);
		});

		it('does nothing at all before there is an image', () => {
			mountComponent();

			expect(() => wrapper.vm.centre(true)).not.toThrow();
		});
	});

	describe('Guides', () => {
		const lit = (name: string) =>
			wrapper.find(`[data-testid="${name}"]`).classes().includes('snapped');

		it('draws nothing for a photo that has only just been placed', async () => {
			// a guide marks something the user just did, not a resting state
			mountComponent();
			await loadSource();
			await nextTick();

			expect(lit('cross-horizontal')).toBe(false);
			expect(lit('cross-vertical')).toBe(false);
		});

		it('offers no border lines at all, only the crosshair', async () => {
			// four of them lighting around the frame was more noise than help; the
			// borders still catch a drag, they just do it quietly
			mountComponent();
			await loadSource();

			for (const edge of ['left', 'right', 'top', 'bottom']) {
				expect(wrapper.find(`[data-testid="edge-${edge}"]`).exists(), edge).toBe(false);
			}
		});

		it('leaves the crosshair alone for a fit, which was asked to scale', async () => {
			mountComponent();
			await loadSource();

			lastStage().fire('dragmove');
			await nextTick();
			expect(lit('cross-vertical')).toBe(true);

			wrapper.vm.fit(true);
			await nextTick();

			expect(lit('cross-vertical')).toBe(false);
			expect(lit('cross-horizontal')).toBe(false);
		});

		it('lights only the centre line a centring was asked for', async () => {
			mountComponent();
			await loadSource();

			wrapper.vm.centre(true);
			await nextTick();

			expect(lit('cross-horizontal')).toBe(true);
			expect(lit('cross-vertical')).toBe(false);
		});

		it('lets a guide fade once the moment has passed', async () => {
			mountComponent();
			await loadSource();

			wrapper.vm.centre(false);
			await nextTick();
			expect(lit('cross-vertical')).toBe(true);

			// they mark an arrival rather than standing there for as long as it holds
			vi.advanceTimersByTime(400);
			await nextTick();

			expect(lit('cross-vertical')).toBe(false);
		});

		it('draws no line while a drag is flush with nothing', async () => {
			mountComponent();
			await loadSource();

			lastStage().position({ x: -37, y: -53 });
			lastStage().fire('dragmove');
			await nextTick();

			expect(lit('cross-horizontal')).toBe(false);
			expect(lit('cross-vertical')).toBe(false);
		});
	});

	describe('The pointer over the canvas', () => {
		const ruleFor = cssOf('src/components/polaroid/CropperArea.vue');

		it('offers the photo to be grabbed, and shows it being held', () => {
			// the same two the sliders and the dial use, so every draggable thing in
			// the app says it the same way
			expect(ruleFor('.container')).toContain('cursor: grab');
			expect(ruleFor('.container:active')).toContain('cursor: grabbing');
		});
	});

	describe('Where the crosshair is drawn', () => {
		// jsdom lays nothing out, so the rules are read from the source. Walked by line
		// rather than sliced on braces: a selector appears in its grouped rule too.
		const lines = readFileSync(
			resolve(process.cwd(), 'src/components/polaroid/CropperArea.vue'), 'utf8'
		).split('\n');

		const ruleFor = (selector: string) => {
			const head = `${selector} {`.split('\n');
			const start = lines.findIndex((_, index) =>
				head.every((line, offset) => lines[index + offset] === line)
				&& !(lines[index - 1] ?? '').trimEnd().endsWith(',')
			);

			expect(start, `${selector} not found on its own`).toBeGreaterThan(-1);

			const end = lines.findIndex((line, index) => index > start && line === '}');
			return lines.slice(start, end).join('\n');
		};

		it('runs each line past both ends rather than stopping it short', () => {
			// the artwork lies over the crop area, so a line stopping at the boundary
			// reads as broken; the overflow hides under the lip
			expect(ruleFor('.center-cross')).toContain('--guide-overflow');
			expect(ruleFor('.cross-x.snapped'))
				.toContain('height: calc(100% + 2 * var(--guide-overflow))');
			expect(ruleFor('.cross-y.snapped'))
				.toContain('width: calc(100% + 2 * var(--guide-overflow))');
		});

		it('measures the crosshair against the crop area and nothing else', () => {
			// unpositioned, the box its percentages resolve against was whatever
			// happened to be positioned above it
			const rule = ruleFor('.center-cross');

			expect(rule).toContain('position: absolute');
			expect(rule).toContain('inset: 0');
		});

		it('lets a drag through, since it covers the whole crop area', () => {
			expect(ruleFor('.center-cross')).toContain('pointer-events: none');
		});

		it('takes the overflow from the frame\'s own scale, since the lip shrinks too', () => {
			expect(ruleFor('.center-cross')).toContain('var(--polaroid-scale');
		});
	});

	describe('Nudging with the arrow keys', () => {
		it('shifts the image by exactly what it was given', async () => {
			mountComponent();
			await loadSource();

			const stage = lastStage();
			const { x, y } = stage.position();

			wrapper.vm.nudge(-3, 7);

			expect(stage.x()).toBe(x - 3);
			expect(stage.y()).toBe(y + 7);
		});

		it('lights the centre line as the image reaches it', async () => {
			// the same feedback a drag gives, so an arrow step is not silent
			mountComponent();
			await loadSource();

			const stage = lastStage();
			stage.position({ x: -40, y: 0 });
			wrapper.vm.nudge(0, 0);
			await nextTick();
			expect(wrapper.find('[data-testid="cross-horizontal"]').classes()).not.toContain('snapped');

			wrapper.vm.nudge(40, 0);
			await nextTick();

			expect(wrapper.find('[data-testid="cross-horizontal"]').classes()).toContain('snapped');
		});

		it('does not snap, so a step near a line is not swallowed by it', async () => {
			// a one pixel step onto the centre would otherwise be sucked onto it and
			// there would be no way to step past
			mountComponent();
			await loadSource();

			const stage = lastStage();
			stage.position({ x: 0, y: 0 });
			wrapper.vm.nudge(2, 0);

			expect(stage.x()).toBe(2);
		});

		it('reports the new framing, which is the only feedback it gives', async () => {
			mountComponent();
			await loadSource();

			const before = wrapper.emitted('alignment')?.length ?? 0;
			wrapper.vm.nudge(40, 0);
			vi.advanceTimersByTime(200);

			expect(wrapper.emitted('alignment')?.length).toBe(before + 1);
		});

		it('does nothing before there is an image', () => {
			mountComponent();

			expect(() => wrapper.vm.nudge(5, 5)).not.toThrow();
		});
	});

	describe('Snapping a drag to the borders', () => {
		// A 1000x500 photo fitted to a 320 frame is 640 wide on screen and centred at
		// 160 in stage coordinates, so its left border meets the frame's at stage.x()
		// 160 and its right at -160. These catch without drawing anything: the pull is
		// the whole point of them.
		const LEFT_BORDER = 160;
		const RIGHT_BORDER = -160;

		it('catches the left border', async () => {
			mountComponent();
			await loadSource();

			const stage = lastStage();
			stage.position({ x: LEFT_BORDER - 3, y: -70 });
			stage.fire('dragmove');

			expect(stage.x()).toBeCloseTo(LEFT_BORDER);
		});

		it('catches the right border', async () => {
			mountComponent();
			await loadSource();

			const stage = lastStage();
			stage.position({ x: RIGHT_BORDER + 3, y: -70 });
			stage.fire('dragmove');

			expect(stage.x()).toBeCloseTo(RIGHT_BORDER);
		});

		it('catches the top and bottom the same way', async () => {
			// fitted to the height, so the photo's own top and bottom are the frame's:
			// it is already on both, and moving off by a hair is pulled back
			mountComponent();
			await loadSource();

			const stage = lastStage();
			stage.position({ x: -300, y: 3 });
			stage.fire('dragmove');

			expect(stage.y()).toBeCloseTo(0);
		});

		it('leaves a drag alone well clear of any border', async () => {
			mountComponent();
			await loadSource();

			const stage = lastStage();
			stage.position({ x: -80, y: -70 });
			stage.fire('dragmove');

			expect(stage.x()).toBe(-80);
			expect(stage.y()).toBe(-70);
		});

		it('gives the centre the first claim on an axis', async () => {
			// Zoomed out a little the photo is narrower than the frame, so its centre
			// and its near border are both within reach at once. The centre has to win,
			// or a border would pull a centred photo back off the line.
			mountComponent();
			await loadSource();
			wrapper.vm.fit(true);

			const stage = lastStage();
			const zoom = 0.98;
			stage.scale({ x: zoom, y: zoom });

			// centred: the frame's middle sits on the photo's own
			const centred = stage.width() / 2 - lastImage().x() * zoom;
			stage.position({ x: centred, y: centred });
			stage.fire('dragmove');
			await nextTick();

			expect(stage.x()).toBeCloseTo(centred);
			expect(wrapper.find('[data-testid="cross-horizontal"]').classes()).toContain('snapped');
		});

		it('snaps each axis on its own', async () => {
			// the photo overhangs sideways but fills the height, so x catches a border
			// while y is held by the centre
			mountComponent();
			await loadSource();

			const stage = lastStage();
			stage.position({ x: LEFT_BORDER - 2, y: 0 });
			stage.fire('dragmove');
			await nextTick();

			expect(stage.x()).toBeCloseTo(LEFT_BORDER);
			expect(wrapper.find('[data-testid="cross-vertical"]').classes()).toContain('snapped');
			expect(wrapper.find('[data-testid="cross-horizontal"]').classes()).not.toContain('snapped');
		});
	});

	describe('Settling before the controls agree', () => {
		const reports = () => wrapper.emitted('alignment')?.length ?? 0;

		it('waits out a photo being dragged rather than flickering with it', async () => {
			mountComponent();
			await loadSource();

			const before = reports();
			const stage = lastStage();

			// three positions in quick succession, as a drag across the centre gives
			for (const x of [-4, 0, -4]) {
				stage.position({ x, y: 0 });
				wrapper.vm.measureAlignment();
			}

			expect(reports()).toBe(before);

			vi.advanceTimersByTime(200);
			expect(reports()).toBe(before + 1);
		});

		it('agrees at once when a button settles the framing', async () => {
			mountComponent();
			await loadSource();

			const before = reports();
			wrapper.vm.centre(true);

			expect(reports()).toBe(before + 1);
		});
	});

	describe('Centre snapping', () => {
		const horizontalGuide = () => wrapper.find('[data-testid="cross-horizontal"]');
		const verticalGuide = () => wrapper.find('[data-testid="cross-vertical"]');

		it('highlights both guides when the image is centred', async () => {
			mountComponent();
			await loadSource();

			lastStage().fire('dragmove');
			await nextTick();

			expect(horizontalGuide().classes()).toContain('snapped');
			expect(verticalGuide().classes()).toContain('snapped');
		});

		it('returns the guides to idle shortly after', async () => {
			mountComponent();
			await loadSource();

			lastStage().fire('dragmove');
			await nextTick();
			expect(horizontalGuide().classes()).toContain('snapped');

			vi.advanceTimersByTime(350);
			await nextTick();

			expect(horizontalGuide().classes()).not.toContain('snapped');
			expect(verticalGuide().classes()).not.toContain('snapped');
		});

		it('leaves the guides idle while the image is off centre', async () => {
			mountComponent();
			await loadSource();

			lastStage().position({ x: -200, y: -200 });
			lastStage().fire('dragmove');
			await nextTick();

			expect(horizontalGuide().classes()).not.toContain('snapped');
			expect(verticalGuide().classes()).not.toContain('snapped');
		});

		it('snaps only on the axis the image is centred on', async () => {
			mountComponent();
			await loadSource();

			// off centre horizontally, still centred vertically
			lastStage().position({ x: -200, y: 0 });
			lastStage().fire('dragmove');
			await nextTick();

			expect(horizontalGuide().classes()).not.toContain('snapped');
			expect(verticalGuide().classes()).toContain('snapped');
		});
	});

	describe('Exporting', () => {
		beforeEach(() => {
			downloadPolaroid.mockClear();
			compressedImage.mockClear();
		});

		it('hands the download the live stage, which derives its own export size', async () => {
			mountComponent();
			await loadSource();

			await wrapper.vm.saveCanvasImage(false);

			expect(downloadPolaroid).toHaveBeenCalledWith(
				InstaxFilmVariant.SQUARE, '', lastImage(), lastRect(), lastStage()
			);
		});

		it('passes the caption through to the export', async () => {
			mountComponent({ settings: { rotation: 0, color: '#FFFFFF', text: 'holiday 98' } });
			await loadSource();

			await wrapper.vm.saveCanvasImage(false);

			expect(downloadPolaroid.mock.calls[0][1]).toBe('holiday 98');
		});

		it('hands the printer the live stage, which derives its own resolution', async () => {
			mountComponent();
			await loadSource();

			await wrapper.vm.saveCanvasImage(true);

			expect(compressedImage).toHaveBeenCalledWith(
				InstaxFilmVariant.SQUARE, lastImage(), lastRect(), lastStage()
			);
		});





		it('rejects when there is nothing to export yet', async () => {
			mountComponent();

			await expect(wrapper.vm.saveCanvasImage(false)).rejects.toBeFalsy();
			expect(downloadPolaroid).not.toHaveBeenCalled();
		});
	});

	describe('Previewing the film look', () => {
		let context: Record<string, ReturnType<typeof vi.fn>>

		beforeEach(() => {
			context = { drawImage: vi.fn() };
			vi.spyOn(HTMLCanvasElement.prototype, 'getContext')
				.mockReturnValue(context as unknown as CanvasRenderingContext2D);
		});

		afterEach(() => {
			vi.mocked(HTMLCanvasElement.prototype.getContext).mockRestore?.();
		});

		it('hands over the photo itself, not the frame it is being cropped into', async () => {
			mountComponent();
			await loadSource();

			const canvas = wrapper.vm.previewSource(200);

			// 1000x500 source: the dialog shows the picture, so neither the square
			// stage nor the crop has any say in what comes back
			expect(canvas.width).toBe(200);
			expect(canvas.height).toBe(100);
			expect(context.drawImage).toHaveBeenCalledWith(loadedImages[0], 0, 0, 200, 100);
		});

		it('never blows a small photo up past its own size', async () => {
			mountComponent();
			loadedImages[loadedImages.length - 1].emitLoad(80, 40);
			await nextTick();

			expect(wrapper.vm.previewSource(320).width).toBe(80);
		});

		it('has nothing to show before an image has loaded', () => {
			mountComponent();

			expect(wrapper.vm.previewSource()).toBeNull();
		});
	});

	describe('Removing the image', () => {
		it('emits remove-image when the close button is clicked', async () => {
			mountComponent();
			await loadSource();

			await wrapper.find('[data-testid="remove-image-button"]').trigger('click');

			expect(wrapper.emitted('remove-image')).toHaveLength(1);
		});

		it('exposes the close control as a named button', async () => {
			mountComponent();
			await loadSource();

			const remove = wrapper.find('[data-testid="remove-image-button"]');
			expect(remove.element.tagName).toBe('BUTTON');
			expect(remove.attributes('aria-label')).toBe('Remove image');
		});

		it('keeps the close mark out of the accessible name', async () => {
			mountComponent();
			await loadSource();

			// the mark is a mask rather than an image, so it can take a colour; either
			// way it must not be read out alongside the button's own name
			const mark = wrapper.find('[data-testid="remove-image-button"] span');

			expect(mark.exists()).toBe(true);
			expect(mark.attributes('aria-hidden')).toBe('true');
		});

		it('hides the controls while loading', () => {
			mountComponent({ loading: true });

			expect(wrapper.find('.remove-button').exists()).toBe(false);
			expect(wrapper.find('.center-cross').exists()).toBe(false);
		});
	});
});
