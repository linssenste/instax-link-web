import { mount } from '@vue/test-utils';
import { describe, it, expect, beforeEach, vi } from 'vitest';

import SelectImageUpload from '../../../components/files/SelectImageUpload.vue';

describe('SelectImageUpload Component', () => {
	let wrapper;

	beforeEach(() => {
		wrapper = mount(SelectImageUpload);
	});

	describe('Component Rendering', () => {
		it('renders successfully', () => {
			expect(wrapper.exists()).toBe(true);
		});
	});

	describe('User Interactions', () => {
		it('should trigger file input click when upload area is clicked', async () => {
			const mockClick = vi.fn();
			const mockElement = {
				click: mockClick
			} as unknown as HTMLElement; // Type assertion to treat the mock as an HTMLElement

			vi.spyOn(document, 'getElementById').mockReturnValue(mockElement);

			await wrapper.find('[data-testid="upload-area"]').trigger('click');

			expect(mockClick).toHaveBeenCalled();
		});

	});

	describe('Event Emission', () => {
		/** jsdom will not let a FileList be assigned, so the input is stood in for. */
		const chooseFiles = async (files: File[]) => {
			const input = wrapper.find('[data-testid="input-file"]');
			Object.defineProperty(input.element, 'files', { value: files, configurable: true });

			await input.trigger('change');
			return input.element as HTMLInputElement;
		};

		it('emits the file that was chosen', async () => {
			// this used to fire a change with no files at all and assert only that
			// something was emitted - so it passed on `selected: undefined`, and the
			// cancelled-picker case was being asserted as a success
			const file = new File(['photo'], 'holiday.jpg', { type: 'image/jpeg' });

			await chooseFiles([file]);

			expect(wrapper.emitted('selected')).toHaveLength(1);
			expect(wrapper.emitted('selected')![0]).toEqual([file]);
		});

		it('emits nothing when the picker is cancelled', async () => {
			await chooseFiles([]);

			expect(wrapper.emitted('selected')).toBeUndefined();
		});

		it('clears the input so the same file can be chosen again', async () => {
			// without this the browser fires no change event for an identical
			// selection, so remove-then-reselect the same photo did nothing
			const file = new File(['photo'], 'holiday.jpg', { type: 'image/jpeg' });
			const input = await chooseFiles([file]);

			expect(input.value).toBe('');
		});

	});

	describe('Component Functionality', () => {
		it('uploadImage method triggers file input click', async () => {
			const mockClick = vi.fn();
			Object.defineProperty(global.document, 'getElementById', {
				value: vi.fn(() => ({
					click: mockClick,
				})),
			});

			wrapper.vm.uploadImage();

			expect(mockClick).toHaveBeenCalledTimes(1);
		});

		it('inputChanged method emits "selected" event with file', () => {
			const mockFile = new File(['dummy content'], 'testfile.png', { type: 'image/png' });
			const event = {
				preventDefault: vi.fn(),
				stopImmediatePropagation: vi.fn(),
				target: { files: [mockFile] },
			};

			wrapper.vm.inputChanged(event);

			expect(event.preventDefault).toHaveBeenCalled();
			expect(event.stopImmediatePropagation).toHaveBeenCalled();
			expect(wrapper.emitted('selected')[0]).toEqual([mockFile]);
		});
	});

	describe('Accessibility', () => {
		it('exposes the upload area as a named button', () => {
			const area = wrapper.find('[data-testid="upload-area"]');

			expect(area.element.tagName).toBe('BUTTON');
			expect(area.attributes('aria-label')).toBe('Choose an image to print');
		});

		it('keeps the plus icon out of the accessible name', () => {
			expect(wrapper.find('[data-testid="plus-icon"]').attributes('alt')).toBe('');
		});

	});
});
