import { mount, type VueWrapper } from '@vue/test-utils'
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { nextTick } from 'vue'

import { konvaMock } from './konva.mock'

// PolaroidEditor pulls in CropperArea, and Konva resolves to a node build that
// wants a real canvas
vi.mock('konva', () => ({ default: konvaMock }))
vi.mock('../../../cropper/cropper.download', () => ({ downloadPolaroid: vi.fn() }))
vi.mock('../../../cropper/cropper.print', () => ({ compressedImage: vi.fn() }))

import PolaroidEditor from '../../polaroid/PolaroidEditor.vue'
import DropImageUpload from '../../files/DropImageUpload.vue'
import PolaroidFrame from '../../polaroid/PolaroidFrame.vue'
import SettingsExpansion from '../../layout/SettingsExpansion.vue'
import SelectImageUpload from '../../files/SelectImageUpload.vue'
import { InstaxFilmVariant } from '../../../interfaces/PrinterStateConfig'

// CropperArea owns a Konva canvas, which jsdom cannot render; the editor only
// needs its interface here
let cropperSpies: { fit: ReturnType<typeof vi.fn>, saveCanvasImage: ReturnType<typeof vi.fn> }

const CropperAreaStub = {
	name: 'CropperArea',
	props: ['src', 'loading', 'config', 'settings', 'displayScale'],
	emits: ['save', 'remove-image'],
	template: '<div class="cropper-stub" />',
	methods: {
		fit(...args: unknown[]) { return cropperSpies.fit(...args) },
		saveCanvasImage(...args: unknown[]) { return cropperSpies.saveCanvasImage(...args) }
	}
}

describe('PolaroidEditor', () => {
	let wrapper: VueWrapper

	const mountComponent = (props = {}) => {
		wrapper = mount(PolaroidEditor, {
			props: {
				config: { connection: false, type: InstaxFilmVariant.SQUARE },
				queueLength: 0,
				...props
			},
			global: {
				stubs: { CropperArea: CropperAreaStub }
			}
		});
		return wrapper;
	};

	// the editor only loads an image through a FileReader, so the state is set directly
	const withImage = async (src = 'data:image/png;base64,abc') => {
		wrapper.vm.image = src;
		await nextTick();
	};

	// jsdom implements neither object URLs nor canvas encoding
	let createObjectURL: ReturnType<typeof vi.fn>
	let revokeObjectURL: ReturnType<typeof vi.fn>
	let urlCounter = 0

	beforeEach(() => {
		cropperSpies = { fit: vi.fn(), saveCanvasImage: vi.fn(async () => 'saved-image-url') };

		urlCounter = 0;
		createObjectURL = vi.fn(() => `blob:mock/${++urlCounter}`);
		revokeObjectURL = vi.fn();
		vi.stubGlobal('URL', Object.assign(Object.create(URL), URL, { createObjectURL, revokeObjectURL }));

		mountComponent();
	});

	afterEach(() => {
		wrapper?.unmount();
		vi.unstubAllGlobals();
	});

	describe('Layout', () => {
		it('renders the frame for the configured film type', () => {
			expect(wrapper.findComponent(PolaroidFrame).props('type')).toBe(InstaxFilmVariant.SQUARE);
		});

		it('follows the film type without rebuilding the frame', async () => {
			const uidBefore = wrapper.findComponent(PolaroidFrame).vm.$.uid;
			await wrapper.setProps({ config: { connection: false, type: InstaxFilmVariant.WIDE } });

			expect(wrapper.findComponent(PolaroidFrame).props('type')).toBe(InstaxFilmVariant.WIDE);
			// the same instance: a rebuilt frame would drop the loaded canvas
			expect(wrapper.findComponent(PolaroidFrame).vm.$.uid).toBe(uidBefore);
		});

		it('caps its width at the frame width of each film variant', async () => {
			const widths = {
				[InstaxFilmVariant.MINI]: '282px',
				[InstaxFilmVariant.SQUARE]: '368px',
				[InstaxFilmVariant.WIDE]: '522px'
			};

			for (const [type, expected] of Object.entries(widths)) {
				await wrapper.setProps({ config: { connection: false, type } });

				// the settings panel sits inside this box, so it can never be wider
				// than the polaroid itself
				expect(wrapper.find('.polaroid-editor').attributes('style')).toContain(`max-width: ${expected}`);
			}
		});

		it('passes the frame display scale to the cropper', async () => {
			await withImage();

			expect(wrapper.findComponent(CropperAreaStub).props('displayScale')).toBeDefined();
		});

		it('shows the upload prompt while no image is loaded', () => {
			expect(wrapper.findComponent(SelectImageUpload).exists()).toBe(true);
			expect(wrapper.find('.polaroid-caption').text()).toBe('Choose an image!');
			expect(wrapper.findComponent(CropperAreaStub).exists()).toBe(false);
		});

		it('swaps the prompt for the cropper once an image is loaded', async () => {
			await withImage();

			expect(wrapper.findComponent(CropperAreaStub).exists()).toBe(true);
			expect(wrapper.findComponent(SelectImageUpload).exists()).toBe(false);
			// the prompt is replaced by the caption field in the same spot
			expect(wrapper.find('.polaroid-caption').element.tagName).toBe('INPUT');
		});

		it('keeps the cropper mounted when the film type changes', async () => {
			await withImage();
			const uidBefore = wrapper.findComponent(CropperAreaStub).vm.$.uid;

			await wrapper.setProps({ config: { connection: false, type: InstaxFilmVariant.MINI } });

			expect(wrapper.findComponent(CropperAreaStub).vm.$.uid).toBe(uidBefore);
		});

		it('keeps the cropper mounted when the source changes', async () => {
			await withImage();
			const uidBefore = wrapper.findComponent(CropperAreaStub).vm.$.uid;

			await withImage('data:image/png;base64,second');

			expect(wrapper.findComponent(CropperAreaStub).vm.$.uid).toBe(uidBefore);
		});

		it('rebuilds the cropper once the source is cleared', async () => {
			await withImage();
			const uidBefore = wrapper.findComponent(CropperAreaStub).vm.$.uid;

			wrapper.vm.image = null;
			await nextTick();
			await withImage('data:image/png;base64,second');

			expect(wrapper.findComponent(CropperAreaStub).vm.$.uid).not.toBe(uidBefore);
		});
	})

	describe('Loading a file', () => {
		// a file below the resize threshold is read straight through
		const smallImage = () => new File([new Uint8Array(1024)], 'photo.png', { type: 'image/png' });

		// the editor reads the file asynchronously through a FileReader
		const flushFileRead = async () => {
			for (let tick = 0; tick < 10; tick++) {
				await new Promise((resolve) => setTimeout(resolve, 0));
				await nextTick();
				if (wrapper.vm.image) return;
			}
		};

		it('loads a file dropped onto the page', async () => {
			wrapper.findComponent(DropImageUpload).vm.$emit('dropped', smallImage());
			await flushFileRead();

			expect(wrapper.vm.image).toBe('blob:mock/1');
			expect(wrapper.findComponent(CropperAreaStub).exists()).toBe(true);
		});

		it('loads a file chosen through the upload prompt', async () => {
			wrapper.findComponent(SelectImageUpload).vm.$emit('selected', smallImage());
			await flushFileRead();

			expect(wrapper.vm.image).toBe('blob:mock/1');
		});

		it('references the blob in place instead of copying it into a data URL', async () => {
			const file = smallImage();
			wrapper.findComponent(DropImageUpload).vm.$emit('dropped', file);
			await flushFileRead();

			expect(createObjectURL).toHaveBeenCalledWith(file);
		});

		it('releases the previous source when another image replaces it', async () => {
			wrapper.findComponent(DropImageUpload).vm.$emit('dropped', smallImage());
			await flushFileRead();

			wrapper.findComponent(DropImageUpload).vm.$emit('dropped', smallImage());
			await flushFileRead();

			expect(revokeObjectURL).toHaveBeenCalledWith('blob:mock/1');
			expect(wrapper.vm.image).toBe('blob:mock/2');
		});

		it('releases the source when the image is removed', async () => {
			wrapper.findComponent(DropImageUpload).vm.$emit('dropped', smallImage());
			await flushFileRead();

			wrapper.findComponent(CropperAreaStub).vm.$emit('remove-image');
			await nextTick();

			expect(revokeObjectURL).toHaveBeenCalledWith('blob:mock/1');
		});

		it('releases the source on unmount', async () => {
			wrapper.findComponent(DropImageUpload).vm.$emit('dropped', smallImage());
			await flushFileRead();

			wrapper.unmount();

			expect(revokeObjectURL).toHaveBeenCalledWith('blob:mock/1');
		});

		it('ignores an empty selection', async () => {
			wrapper.findComponent(DropImageUpload).vm.$emit('dropped', null);
			await flushFileRead();

			expect(wrapper.vm.image).toBeNull();
			expect(wrapper.findComponent(SelectImageUpload).exists()).toBe(true);
		});

		it('hands the source to the cropper', async () => {
			wrapper.findComponent(DropImageUpload).vm.$emit('dropped', smallImage());
			await flushFileRead();

			expect(wrapper.findComponent(CropperAreaStub).props('src')).toBe(wrapper.vm.image);
		});

		it('does not resize a file that is already small enough', async () => {
			const toBlob = vi.spyOn(HTMLCanvasElement.prototype, 'toBlob');

			wrapper.findComponent(DropImageUpload).vm.$emit('dropped', smallImage());
			await flushFileRead();

			expect(toBlob).not.toHaveBeenCalled();
			toBlob.mockRestore();
		});
	})

	describe('Settings panel', () => {
		it('is hidden while no image is loaded', () => {
			expect(wrapper.findComponent(SettingsExpansion).find('.settings-panel').isVisible()).toBe(false);
		});

		it('is shown once an image is loaded', async () => {
			await withImage();
			for (let tick = 0; tick < 4; tick++) await nextTick();

			expect(wrapper.findComponent(SettingsExpansion).find('.settings-panel').isVisible()).toBe(true);
		});

		it('tells the panel whether an image is loaded', async () => {
			expect(wrapper.findComponent(SettingsExpansion).props('hasImage')).toBe(false);

			await withImage();

			expect(wrapper.findComponent(SettingsExpansion).props('hasImage')).toBe(true);
		});

		it('passes the film type and queue length through', async () => {
			await wrapper.setProps({ queueLength: 2, config: { connection: true, type: InstaxFilmVariant.MINI } });
			const panel = wrapper.findComponent(SettingsExpansion);

			expect(panel.props('queueLength')).toBe(2);
			expect(panel.props('config')).toMatchObject({ type: InstaxFilmVariant.MINI, connection: true });
		});

		it('hands the adjustments down to the cropper', async () => {
			await withImage();
			wrapper.findComponent(SettingsExpansion).vm.$emit('change', { rotation: 90, color: '#ff0000' });
			await nextTick();

			expect(wrapper.findComponent(CropperAreaStub).props('settings')).toMatchObject({
				rotation: 90, color: '#ff0000'
			});
		});

		it('forwards an alignment request to the cropper', async () => {
			await withImage();

			wrapper.findComponent(SettingsExpansion).vm.$emit('scale', 'horizontal');
			expect(cropperSpies.fit).toHaveBeenCalledWith(true);

			wrapper.findComponent(SettingsExpansion).vm.$emit('scale', 'vertical');
			expect(cropperSpies.fit).toHaveBeenCalledWith(false);
		});
	})

	describe('Caption on the polaroid', () => {
		const captionInput = () => wrapper.find('[data-testid="caption-input"]');

		it('is only offered once there is an image to caption', async () => {
			expect(captionInput().exists()).toBe(false);

			await withImage();

			expect(captionInput().exists()).toBe(true);
		});

		it('sits in the frame text area, not in the settings panel', async () => {
			await withImage();

			// it renders through the frame's polaroid-text slot
			expect(wrapper.findComponent(PolaroidFrame).find('[data-testid="caption-input"]').exists()).toBe(true);
			expect(wrapper.findComponent(SettingsExpansion).find('[data-testid="caption-input"]').exists()).toBe(false);
		});

		it('reaches the cropper, which draws it onto the export', async () => {
			await withImage();
			await captionInput().setValue('holiday 98');

			expect(wrapper.findComponent(CropperAreaStub).props('settings').text).toBe('holiday 98');
		});

		it('keeps the adjustments when the caption changes', async () => {
			await withImage();
			wrapper.findComponent(SettingsExpansion).vm.$emit('change', { rotation: 90, color: '#ff0000' });
			await nextTick();

			await captionInput().setValue('sunset');

			expect(wrapper.findComponent(CropperAreaStub).props('settings')).toMatchObject({
				rotation: 90, color: '#ff0000', text: 'sunset'
			});
		});

		it('limits the caption to what fits on each film variant', async () => {
			await withImage();

			const lengths = {
				[InstaxFilmVariant.MINI]: '18',
				[InstaxFilmVariant.SQUARE]: '25',
				[InstaxFilmVariant.WIDE]: '35'
			};

			for (const [type, expected] of Object.entries(lengths)) {
				await wrapper.setProps({ config: { connection: false, type } });
				expect(captionInput().attributes('maxlength')).toBe(expected);
			}
		});

		it('is cleared once the image is gone', async () => {
			vi.useFakeTimers();
			await withImage();
			await captionInput().setValue('holiday 98');

			wrapper.findComponent(CropperAreaStub).vm.$emit('remove-image');
			vi.advanceTimersByTime(500);
			await nextTick();

			await withImage();
			expect(captionInput().element.value).toBe('');
			vi.useRealTimers();
		});

		it('keeps the caption if a replacement image arrives in time', async () => {
			vi.useFakeTimers();
			await withImage();
			await captionInput().setValue('holiday 98');

			wrapper.findComponent(CropperAreaStub).vm.$emit('remove-image');
			vi.advanceTimersByTime(200);
			await withImage('data:image/png;base64,second');
			vi.advanceTimersByTime(1000);
			await nextTick();

			expect(captionInput().element.value).toBe('holiday 98');
			vi.useRealTimers();
		});
	});

	describe('Removing the image', () => {
		it('clears the source when the cropper asks for it', async () => {
			await withImage();

			wrapper.findComponent(CropperAreaStub).vm.$emit('remove-image');
			await nextTick();

			expect(wrapper.vm.image).toBeNull();
			expect(wrapper.findComponent(SettingsExpansion).props('hasImage')).toBe(false);
		});
	})

	describe('Saving', () => {
		it('renders the polaroid and emits it once the panel has collapsed', async () => {
			vi.useFakeTimers();
			await withImage();

			const save = wrapper.findComponent(SettingsExpansion).props('savePolaroid');
			const pending = save(true);

			expect(wrapper.vm.loading).toBe(true);

			await vi.advanceTimersByTimeAsync(525);
			await pending;

			expect(wrapper.emitted('image')![0]).toEqual([{ src: 'saved-image-url', download: true }]);

			await vi.advanceTimersByTimeAsync(750);
			expect(wrapper.vm.loading).toBe(false);
			vi.useRealTimers();
		});

		it('asks for a printable image when not downloading', async () => {
			vi.useFakeTimers();
			await withImage();

			const pending = wrapper.findComponent(SettingsExpansion).props('savePolaroid')(false);
			await vi.advanceTimersByTimeAsync(525);
			await pending;

			expect(cropperSpies.saveCanvasImage).toHaveBeenCalledWith(true);
			vi.useRealTimers();
		});

		it('shows the loading overlay while rendering', async () => {
			vi.useFakeTimers();
			await withImage();

			wrapper.findComponent(SettingsExpansion).props('savePolaroid')(true);
			await nextTick();

			expect(wrapper.find('.loading-overlay').exists()).toBe(true);
			vi.useRealTimers();
		});
	})
});
