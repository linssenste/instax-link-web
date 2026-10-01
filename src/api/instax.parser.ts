import { INSTAX_OPCODES } from './events'

const twoByteInt = (offset: number, byteArray: number[]) => {
	return byteArray.length < offset + 2 ? 0 : (byteArray[offset] << 8) | byteArray[offset + 1]
}

const oneByteInt = (offset: number, byteArray: number[]) => {
	return byteArray.length < offset + 1 ? 0 : byteArray[offset]
}


export interface InstaxParsedResponse {
	company?: string
	printerTypeId?: string
	serialNumber?: string
	width?: number
	height?: number
	packet?: number
	isCharging?: number
	battery?: number
	photosLeft?: number
	eventCode?: number
	command?: number
	payload?: number[]
	filmState?: number[]
	status?: number
}

/**
 * Read a reply into the fields its opcode is known to carry.
 *
 * `status` is on every shape it returns. It is a property of the frame rather
 * than of the opcode, and the two special-cased branches used to drop it - so a
 * fault reported on one of those opcodes read as a healthy reply, which is
 * exactly how the print-fault watcher could miss the packet that matters most.
 * The same goes for never returning undefined: a well formed reply that mapped
 * to nothing was reported as "the printer did not answer".
 */
export function parse(eventCode: number, command: number, payload: number[], status: number): InstaxParsedResponse {
	const frame = { eventCode, command, payload, status }

	if (eventCode === INSTAX_OPCODES.DEVICE_INFO_SERVICE) {
		const asciiResponse = String.fromCharCode(...payload.filter((code) => code !== 8))
		switch (command) {
			case 0:
				return { ...frame, company: asciiResponse }

			case 1:
				return { ...frame, printerTypeId: asciiResponse }

			case 2:
				return { ...frame, serialNumber: asciiResponse }

			default:
				return frame
		}
	} else if (eventCode === INSTAX_OPCODES.SUPPORT_FUNCTION_INFO) {
		switch (command) {
			case 0:
				return {
					...frame,
					width: twoByteInt(0, payload),
					height: twoByteInt(2, payload),
					packet: twoByteInt(4, payload) // idk - 512
				}

			case 1:
				return {
					...frame,
					isCharging: oneByteInt(0, payload),
					battery: oneByteInt(1, payload)
				}

			case 2:
				// a short payload would read `undefined & 15` as 0 shots left, which
				// the app reports as an empty pack; the other two commands guard with
				// the byte readers and this one used to index straight in
				if (payload.length === 0) return frame

				return {
					...frame,
					photosLeft: oneByteInt(0, payload) & 15,
					isCharging: (oneByteInt(0, payload) & (1 << 7)) === 0 ? 0 : 1,

					// everything past the first byte, kept rather than dropped. Measured
					// on a Link printer: these read `00 00 0c 00 00 00 00` while it is
					// happy and `f4 f0 0c 00 00 00 10` once it has failed to feed, so
					// they carry a state the count itself does not - the count reads the
					// same either way. What each byte means is not known, so this is
					// compared rather than interpreted.
					filmState: payload.slice(1)
				}

			default:
				return frame
		}
	}

	return frame
}
