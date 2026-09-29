import { mount, flushPromises } from '@vue/test-utils';
import { describe, it, expect, beforeEach, vi } from 'vitest';

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
import { InstaxFilmVariant } from '../../../interfaces/PrinterStateConfig';

describe('QueueElement Component', () => {
	let wrapper;
	const mockElement = {
		base64: 'data:image/png;base64,testbase64',
		state: 1, // 0: In Queue, 1: Sending, 2: Printing
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
			expect(wrapper.find('[data-testid="status-text"]').text()).toContain('SENDING ...');
			expect(wrapper.find('img').attributes('src')).toBe(mockElement.base64);
		});

		it('updates status text based on element state', async () => {
			await wrapper.setProps({ element: { ...mockElement, state: 2 } });
			expect(wrapper.find('[data-testid="status-text"]').text()).toContain('PRINTING');
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

		it('shows nothing when there is no caption', () => {
			expect(wrapper.find('[data-testid="queue-caption"]').exists()).toBe(false);
		});

		it('ignores a caption that is only whitespace', async () => {
			await wrapper.setProps({ element: { ...mockElement, caption: '   ' } });

			expect(wrapper.find('[data-testid="queue-caption"]').exists()).toBe(false);
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
			await wrapper.setProps({ element: { ...mockElement, state: 2 } });
			const progressBar = wrapper.find('[data-testid="printing-progress-printing"] .progress-print');
			expect(progressBar.attributes('style')).toContain(`width: ${mockElement.progress}%`);
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
});
