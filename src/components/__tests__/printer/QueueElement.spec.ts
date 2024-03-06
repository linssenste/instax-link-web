import { mount } from '@vue/test-utils';
import { describe, it, expect, beforeEach, vi } from 'vitest';

import QueueElement from '../../../components/printer/QueueElement.vue';

describe('QueueElement Component', () => {
	let wrapper;
	const mockElement = {
		base64: 'data:image/png;base64,testbase64',
		state: 1, // 0: In Queue, 1: Sending, 2: Printing
		progress: 50,
		quantity: 5,
	};

	beforeEach(() => {
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
