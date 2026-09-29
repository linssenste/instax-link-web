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

		it('returns nothing for an unknown command', () => {
			expect(parse(INSTAX_OPCODES.SUPPORT_FUNCTION_INFO, 99, [0], 0)).toBeUndefined();
		});
	});

	describe('Device info', () => {
		const ascii = (text: string) => Array.from(text).map((character) => character.charCodeAt(0));

		it('reads the company, model and serial as text', () => {
			expect(parse(INSTAX_OPCODES.DEVICE_INFO_SERVICE, 0, ascii('FUJIFILM'), 0)).toEqual({ company: 'FUJIFILM' });
			expect(parse(INSTAX_OPCODES.DEVICE_INFO_SERVICE, 1, ascii('SQ10'), 0)).toEqual({ printerTypeId: 'SQ10' });
			expect(parse(INSTAX_OPCODES.DEVICE_INFO_SERVICE, 2, ascii('12345'), 0)).toEqual({ serialNumber: '12345' });
		});

		it('falls back to the raw packet for an unknown command', () => {
			expect(parse(INSTAX_OPCODES.DEVICE_INFO_SERVICE, 99, [1, 2], 0))
				.toEqual({ eventCode: INSTAX_OPCODES.DEVICE_INFO_SERVICE, command: 99, payload: [1, 2] });
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
