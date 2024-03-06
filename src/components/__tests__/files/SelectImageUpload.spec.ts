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
		it('emits "selected" event when a file is selected', async () => {

			// mocking of event data not allowed??

			const input = wrapper.find('[data-testid="input-file"]');

			await input.trigger('change');
			expect(wrapper.emitted('selected')).toBeTruthy();
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
});
