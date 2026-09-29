import { mount, type VueWrapper } from '@vue/test-utils'
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { nextTick } from 'vue'

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

			// the smaller factor wins so the framing never overflows the new box
			expect(stage.scaleX()).toBeCloseTo(2);
			expect(stage.scaleX()).toBe(stage.scaleY());
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

		it('passes the display scale on so the download is rendered at full size', async () => {
			mountComponent({ displayScale: 0.75 });
			await loadSource();

			await wrapper.vm.saveCanvasImage(false);

			// type, text, image, background, stage, displayScale
			expect(downloadPolaroid.mock.calls[0][5]).toBe(0.75);
		});

		it('defaults the display scale to 1', async () => {
			mountComponent();
			await loadSource();

			await wrapper.vm.saveCanvasImage(false);

			expect(downloadPolaroid.mock.calls[0][5]).toBe(1);
		});

		it('follows a display scale that changes after mount', async () => {
			mountComponent({ displayScale: 1 });
			await loadSource();

			await wrapper.setProps({ displayScale: 0.4 });
			await wrapper.vm.saveCanvasImage(false);

			expect(downloadPolaroid.mock.calls[0][5]).toBe(0.4);
		});

		it('hands the printer the live stage, which derives its own resolution', async () => {
			mountComponent({ displayScale: 0.5 });
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

	describe('Removing the image', () => {
		it('emits remove-image when the close button is clicked', async () => {
			mountComponent();
			await loadSource();

			await wrapper.find('.remove-button').trigger('click');

			expect(wrapper.emitted('remove-image')).toHaveLength(1);
		});

		it('hides the controls while loading', () => {
			mountComponent({ loading: true });

			expect(wrapper.find('.remove-button').exists()).toBe(false);
			expect(wrapper.find('.center-cross').exists()).toBe(false);
		});
	});
});
