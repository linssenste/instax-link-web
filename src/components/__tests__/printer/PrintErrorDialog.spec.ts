import { mount } from '@vue/test-utils';
import { describe, it, expect } from 'vitest';

import PrintErrorDialog from '../../../components/printer/PrintErrorDialog.vue';
import { InstaxPrintError } from '../../../api/instax.errors';
import type { PrintFailure } from '../../../api/instax.errors';

const dialog = (error: InstaxPrintError | null) =>
	mount(PrintErrorDialog, {
		props: { error },
		attachTo: document.body,
		// rendered in place, so the teleported panel is reachable from the wrapper
		global: { stubs: { teleport: true } }
	});

const failure = (reason: PrintFailure, status: number | null = null, payload: number[] = []) =>
	new InstaxPrintError(reason, 'the printer said no', status, payload);

describe('PrintErrorDialog', () => {
	it('stays out of the way until a print has actually failed', () => {
		expect(dialog(null).find('[data-testid="print-error-dialog"]').exists()).toBe(false);
	});

	it('opens on a failure', () => {
		expect(dialog(failure('not-printed')).find('[data-testid="print-error-dialog"]').exists()).toBe(true);
	});

	it('names an empty pack for a print that used no film', () => {
		// the counter and the pack disagree after a reseat, which is the case this
		// whole path exists for, so it is the one the wording has to get right
		const text = dialog(failure('not-printed')).text();

		expect(text).toContain('never used a sheet');
		expect(text.toLowerCase()).toContain('empty');
		expect(text.toLowerCase()).toContain('counter');
	});

	it('says something different for each way a print can fail', () => {
		const reasons: PrintFailure[] = ['refused', 'reported', 'not-printed', 'silent'];
		const headlines = reasons.map((reason) => dialog(failure(reason)).text().split('\n')[0]);

		expect(new Set(headlines).size).toBe(reasons.length);
	});

	it('shows the bytes, so a fault it cannot name is still reportable', () => {
		const text = dialog(failure('reported', 0x09, [0x01, 0xff])).text();

		expect(text).toContain('status 0x09');
		expect(text).toContain('01 ff');
	});

	it('shows the hex alone, not the internal name for the fault', () => {
		const detail = dialog(failure('reported', 0x09, [0x01, 0xff]))
			.find('[data-testid="print-error-detail"]').text();

		expect(detail).toBe('status 0x09 · payload 01 ff');
		expect(detail).not.toContain('reason');
		expect(detail).not.toContain('reported');
	});

	it('leaves the line out when the printer said nothing in hex', () => {
		// a fault worked out from the film count has no bytes of its own, and an
		// empty chip is worse than no chip
		const wrapper = dialog(new InstaxPrintError('not-printed', 'no film was used'));

		expect(wrapper.find('[data-testid="print-error-detail"]').exists()).toBe(false);
	});

	it('still names the fault in the log, where nothing else would', () => {
		expect(failure('reported', 0x09).detail).toContain('reason reported');
		expect(failure('reported', 0x09).detail).toContain('status 0x09');
	});

	it('promises the photo is kept, because it is', () => {
		expect(dialog(failure('not-printed')).text()).toContain('stays on the queue');
	});

	it('labels the discard for what it removes', () => {
		expect(dialog(failure('not-printed')).find('[data-testid="print-error-discard"]').text())
			.toBe('Remove image');
	});

	it('offers taking it off the queue, which closing does not do', () => {
		const wrapper = dialog(failure('not-printed'));

		wrapper.find('[data-testid="print-error-discard"]').trigger('click');

		expect(wrapper.emitted('discard')).toHaveLength(1);
		expect(wrapper.emitted('close')).toBeUndefined();
	});

	it('offers another go', async () => {
		const wrapper = dialog(failure('refused'));

		await wrapper.find('[data-testid="print-error-retry"]').trigger('click');

		expect(wrapper.emitted('retry')).toHaveLength(1);
	});

	it('closes without discarding, so the photo survives being dismissed', async () => {
		const wrapper = dialog(failure('refused'));

		await wrapper.find('[data-testid="print-error-dialog-close"]').trigger('click');

		expect(wrapper.emitted('close')).toHaveLength(1);
		expect(wrapper.emitted('discard')).toBeUndefined();
	});
});
