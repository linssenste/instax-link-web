import { describe, it, expect } from 'vitest'

import { parse } from '../instax.parser'
import { INSTAX_OPCODES } from '../events'

describe('instax response parser', () => {
	describe('Support function info', () => {
		it('reads the film dimensions', () => {
			const response = parse(INSTAX_OPCODES.SUPPORT_FUNCTION_INFO, 0, [0x04, 0xEC, 0x03, 0x48, 0x02, 0x00], 0);

			expect(response).toMatchObject({ width: 1260, height: 840 });
		});

		it('reads the battery level and charging flag', () => {
			const response = parse(INSTAX_OPCODES.SUPPORT_FUNCTION_INFO, 1, [9, 72], 0);

			expect(response).toMatchObject({ isCharging: 9, battery: 72 });
		});

		it('reads the remaining photo count', () => {
			const response = parse(INSTAX_OPCODES.SUPPORT_FUNCTION_INFO, 2, [7], 0);

			expect(response?.photosLeft).toBe(7);
		});

		it('reports charging from the high bit rather than always zero', () => {
			// the bit test used to reduce to `128 & 1`, so this was never set
			expect(parse(INSTAX_OPCODES.SUPPORT_FUNCTION_INFO, 2, [0b10000111], 0)?.isCharging).toBe(1);
			expect(parse(INSTAX_OPCODES.SUPPORT_FUNCTION_INFO, 2, [0b00000111], 0)?.isCharging).toBe(0);
		});

		it('masks the photo count to its low nibble', () => {
			expect(parse(INSTAX_OPCODES.SUPPORT_FUNCTION_INFO, 2, [0b10001010], 0)?.photosLeft).toBe(10);
		});

		it('still describes a command it has no fields for', () => {
			// it used to return undefined, and a well formed reply that mapped to
			// nothing was reported upstream as "the printer did not answer"
			expect(parse(INSTAX_OPCODES.SUPPORT_FUNCTION_INFO, 99, [0], 4)).toMatchObject({
				eventCode: INSTAX_OPCODES.SUPPORT_FUNCTION_INFO, command: 99, payload: [0], status: 4
			});
		});

		it('carries the status on the film count reply', () => {
			// this branch used to drop it, so a printer reporting a count it cannot
			// honour was indistinguishable from one that can - and the print fault
			// watcher, which only looks at status, could never see a fault here
			expect(parse(INSTAX_OPCODES.SUPPORT_FUNCTION_INFO, 2, [7], 0xb4)?.status).toBe(0xb4);
		});

		it('carries the status on the dimensions and battery replies too', () => {
			expect(parse(INSTAX_OPCODES.SUPPORT_FUNCTION_INFO, 0, [0, 0], 9)?.status).toBe(9);
			expect(parse(INSTAX_OPCODES.SUPPORT_FUNCTION_INFO, 1, [0, 0], 9)?.status).toBe(9);
		});

		it('does not read an empty film count reply as an empty pack', () => {
			// `undefined & 15` is 0, which the app reports to the user as no film left
			const response = parse(INSTAX_OPCODES.SUPPORT_FUNCTION_INFO, 2, [], 0);

			expect(response?.photosLeft).toBeUndefined();
			expect(response?.status).toBe(0);
		});

		it('keeps the film state bytes beside the count', () => {
			const response = parse(INSTAX_OPCODES.SUPPORT_FUNCTION_INFO, 2, [0x9a, 0xf4, 0xf0, 0x0c], 0);

			expect(response?.photosLeft).toBe(10);
			expect(response?.filmState).toEqual([0xf4, 0xf0, 0x0c]);
		});
	});

	describe('Device info', () => {
		const ascii = (text: string) => Array.from(text).map((character) => character.charCodeAt(0));

		it('reads the company, model and serial as text', () => {
			expect(parse(INSTAX_OPCODES.DEVICE_INFO_SERVICE, 0, ascii('FUJIFILM'), 0)).toMatchObject({ company: 'FUJIFILM' });
			expect(parse(INSTAX_OPCODES.DEVICE_INFO_SERVICE, 1, ascii('SQ10'), 0)).toMatchObject({ printerTypeId: 'SQ10' });
			expect(parse(INSTAX_OPCODES.DEVICE_INFO_SERVICE, 2, ascii('12345'), 0)).toMatchObject({ serialNumber: '12345' });
		});

		it('carries the status alongside the text', () => {
			expect(parse(INSTAX_OPCODES.DEVICE_INFO_SERVICE, 0, ascii('FUJIFILM'), 7)?.status).toBe(7);
		});

		it('falls back to the raw packet for an unknown command', () => {
			expect(parse(INSTAX_OPCODES.DEVICE_INFO_SERVICE, 99, [1, 2], 0))
				.toEqual({ eventCode: INSTAX_OPCODES.DEVICE_INFO_SERVICE, command: 99, payload: [1, 2], status: 0 });
		});
	});

	it('passes unknown event codes through with their status', () => {
		expect(parse(0xFFFF, 1, [5], 3)).toEqual({ eventCode: 0xFFFF, command: 1, payload: [5], status: 3 });
	});

	it('does not read past a short payload', () => {
		expect(parse(INSTAX_OPCODES.SUPPORT_FUNCTION_INFO, 0, [], 0)).toMatchObject({ width: 0, height: 0 });
		expect(parse(INSTAX_OPCODES.SUPPORT_FUNCTION_INFO, 1, [], 0)).toMatchObject({ isCharging: 0, battery: 0 });
	});
})
