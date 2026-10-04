import { INSTAX_OPCODES } from './events'
import { InstaxBluetooth } from './instax.bluetooth'
import { parse, type InstaxParsedResponse } from './instax.parser'
import { encodeColor } from './instax.color'
import { InstaxFilmVariant, type PrinterBatteryStatus } from '../interfaces/PrinterStateConfig'
import { TransferTuning, writeStride } from './instax.transfer'
import { InstaxPrintError, isPrintError } from './instax.errors'

/**
 * How long a sheet takes to come out of the printer.
 *
 * Exported because the queue card draws its printing bar over exactly this long:
 * two hardcoded fifteen-second values that had to coincide is how the bar came to
 * finish before the printer did.
 */
export const PRINT_DURATION = 15000

/**
 * Opcodes whose unsolicited replies say something about the print.
 *
 * Anything else the printer volunteers while a sheet is coming out - the answer
 * to a colour change, say - is not a print fault however its status byte reads.
 */
const PRINT_FAULT_OPCODES: ReadonlySet<number> = new Set([
	INSTAX_OPCODES.PRINT_IMAGE,
	INSTAX_OPCODES.PRINT_IMAGE_DOWNLOAD_START,
	INSTAX_OPCODES.PRINT_IMAGE_DOWNLOAD_DATA,
	INSTAX_OPCODES.PRINT_IMAGE_DOWNLOAD_END,
	INSTAX_OPCODES.SUPPORT_FUNCTION_INFO
])

/**
 * Answer to a transfer start that means "not yet".
 *
 * Measured on a Link printer: inserting a pack makes it report ten shots while it
 * is still preparing them, and a transfer started then is answered with this.
 */
const PRINTER_NOT_READY = 0x01

/** The transfer packs the payload length into two bytes, so this is the ceiling. */
const MAX_TRANSFER_BYTES = 65535


export class InstaxPrinter extends InstaxBluetooth {
	/** what the link has been shown to take, carried across prints */
	protected tuning = new TransferTuning()

	constructor() {
		super()
	}

	// Helper function to convert Uint8Array into a human-readable hexadecimal string
	private _printableHex(command: Uint8Array): string {
		return Array.from(command, (byte) => byte.toString(16).padStart(2, '0')).join(' ')
	}

	/**
	 * Set the printer's own light.
	 *
	 * The reply is waited for even though nothing is done with it: the printer
	 * answers this command, and leaving that answer unclaimed is what used to
	 * desynchronise every reply after it. A printer that does not answer costs a
	 * timeout here and nothing else - the light is not worth failing a print over.
	 */
	public async setColor(colors: string[], speed = 20, repeat = 0, when = 0): Promise<void> {
		try {
			await this.sendCommand(
				INSTAX_OPCODES.LED_PATTERN_SETTINGS,
				encodeColor(colors, speed, repeat, when),
				true
			)
		} catch (error) {
			if (import.meta.env.DEV) console.warn('> could not set the printer light', error)
		}
	}


	// Sends a command to the printer
	async sendCommand(opCode: number, command: number[], awaitResponse = true): Promise<InstaxParsedResponse | undefined> {
		// Encode the command into the Instax packet format
		const instaxCommandData: Uint8Array = this.encode(opCode, command);

		// Log the command as a hex string for debugging purposes
		if (import.meta.env.DEV) console.log('>', this._printableHex(instaxCommandData))

		// the opcode goes with it, so a reply meant for something else cannot be
		// mistaken for this command's answer
		const response = await this.send(instaxCommandData, awaitResponse, opCode)
		return this._decode(response)
	}


	async getInformation(includeType = false) {

		const printerStatus: {
			battery: PrinterBatteryStatus
			polaroidCount: number | null
			type: InstaxFilmVariant | null
			filmState: string | null
		} = {
			battery: {
				charging: false,
				level: null
			},
			polaroidCount: null,
			type: null,
			filmState: null
		}
		let response: InstaxParsedResponse | undefined;
		if (includeType == true) {
			response = await this.sendCommand(INSTAX_OPCODES.SUPPORT_FUNCTION_INFO, [0]);

			const reportedWidth = response?.width;
			const reportedHeight = response?.height;

			const width = (reportedWidth != 600 && reportedWidth != 800 && reportedWidth != 1260) ? 800 : reportedWidth;
			const height = (reportedHeight != 800 && reportedHeight != 840) ? 800 : reportedHeight;

			if (width == 1260 && height == 840) {
				printerStatus.type = InstaxFilmVariant.WIDE
			} else if (width == 800) {
				printerStatus.type = InstaxFilmVariant.SQUARE
			} else if (width == 600) {
				printerStatus.type = InstaxFilmVariant.MINI
			}

		}


		response = await this.sendCommand(INSTAX_OPCODES.SUPPORT_FUNCTION_INFO, [1]);

		printerStatus.battery.charging = (response?.isCharging ?? 0) > 5;
		printerStatus.battery.level = response?.battery ?? null;

		response = await this.sendCommand(INSTAX_OPCODES.SUPPORT_FUNCTION_INFO, [2]);
		printerStatus.polaroidCount = response?.photosLeft ?? null;
		printerStatus.filmState = response?.filmState?.join(',') ?? null;
		return printerStatus;
	}

	/**
	 * Print the image the printer is holding, once per copy.
	 *
	 * The answer to the print command only says the command was taken, not that a
	 * photo came out, and it used to be thrown away unread on top of that - so a
	 * printer that took the command and then failed to feed looked exactly like a
	 * printer that had printed. A pack that is empty while the counter still
	 * believes in it is precisely that case.
	 *
	 * There are three places the truth can turn up and no way to know in advance
	 * which one a given printer uses, so all three are watched: the status on the
	 * command's own answer, anything the printer volunteers while it is printing,
	 * and whether it is any further through the pack afterwards.
	 */
	async printImage(
		copies: number | (() => number) = 1,
		callback: (imageId: number) => void,
		signal: AbortSignal
	): Promise<void> {
		// Read before every sheet rather than captured once. The print command is
		// issued per copy, so the number can still be changed while a photo is
		// printing - and it used to be fixed at the start, so asking for another
		// copy mid-print changed the card and nothing else.
		const total = (): number => {
			const asked = Math.floor(Number(typeof copies === 'function' ? copies() : copies));
			return Number.isFinite(asked) && asked > 0 ? asked : 1;
		};

		if (signal.aborted) {
			callback(-1)
			return
		}

		await new Promise((r) => setTimeout(r, 500))
		let aborted: boolean = false
		signal.addEventListener('abort', () => {
			aborted = true
		}, { once: true })

		for (let index = 0; index < total(); index++) {
			const before = await this._filmCount()

			const response = await this.sendCommand(INSTAX_OPCODES.PRINT_IMAGE, [], true)

			if (response == null) {
				throw new InstaxPrintError('silent', 'The printer did not answer the print command')
			}

			if (response.status != null && response.status !== 0) {
				throw new InstaxPrintError(
					'refused', 'The printer turned the print down',
					response.status, response.payload ?? []
				)
			}

			// wait the print out, but let the printer cut the wait short if it has
			// something to say about how it is going
			const fault = await this._watchPrint(PRINT_DURATION)

			if (fault != null) {
				throw new InstaxPrintError(
					'reported', 'The printer reported a fault while printing',
					fault.status ?? null, fault.payload ?? []
				)
			}

			if (aborted) {
				callback(-1)
				return
			}

			const after = await this._filmCount()

			// the count is the printer's own word on whether a sheet was used, and it
			// is the only one of the three that does not depend on the printer
			// volunteering anything
			if (before != null && after != null && after >= before) {
				throw new InstaxPrintError(
					'not-printed',
					`The printer is still showing ${after} shots, so nothing was printed`
				)
			}

			callback(index + 1)
		}
	}

	/** How long a sheet takes to come out. */
	private async _watchPrint(duration: number): Promise<InstaxParsedResponse | null> {
		return new Promise<InstaxParsedResponse | null>((resolve) => {
			const finish = (value: InstaxParsedResponse | null) => {
				clearTimeout(timer)
				this._onUnsolicited = null
				resolve(value)
			}

			const timer = setTimeout(() => finish(null), duration)

			this._onUnsolicited = (event: Event) => {
				let parsed: InstaxParsedResponse | undefined

				// an unreadable packet is not a fault in itself, and throwing out of a
				// notification handler would go nowhere useful
				try {
					parsed = this._decode(event)
				} catch {
					return
				}

				if (import.meta.env.DEV) console.log('> printer volunteered', parsed)

				if (parsed?.status == null || parsed.status === 0) return

				// and it has to be about printing. Anything with a status was treated
				// as a print fault, so a reply to an LED command sent while the sheet
				// was coming out failed a photo that printed perfectly well
				if (!PRINT_FAULT_OPCODES.has(parsed.eventCode ?? -1)) return

				finish(parsed)
			}
		})
	}

	/** How far through the pack the printer believes it is, or null if it will not say. */
	private async _filmCount(): Promise<number | null> {
		try {
			const response = await this.sendCommand(INSTAX_OPCODES.SUPPORT_FUNCTION_INFO, [2])
			return response?.photosLeft ?? null
		} catch {
			return null
		}
	}

	/**
	 * Push one encoded image to the printer.
	 *
	 * The payload goes out as fixed size chunks the printer reassembles by index -
	 * those sizes come from the firmware and are not ours to change - but how each
	 * chunk reaches the characteristic is, and that is where the time went. Writes
	 * are as large as the link will take and spread evenly across the chunk, and
	 * the pause between them is tuned by {@link TransferTuning} rather than fixed,
	 * so a link that keeps up is not held back to the speed of one that does not.
	 */
	async sendImage(
		imageUrl: string,
		print = false,
		type: InstaxFilmVariant,
		callback: (progress: number) => void,
		signal: AbortSignal
	): Promise<void> {
		const imageData = this._base64ToByteArray(imageUrl)

		// the length below is packed into two bytes, and an image over this would
		// wrap it to a small number and be truncated by the printer without a word
		if (imageData.length > MAX_TRANSFER_BYTES) {
			throw new Error(`Image is ${imageData.length} bytes, over the ${MAX_TRANSFER_BYTES} byte transfer limit`)
		}

		if (imageData.length === 0) throw new InstaxPrintError('refused', 'The image is empty')

		const chunks = this.imageToChunks(imageData, type == InstaxFilmVariant.SQUARE ? 1808 : 900)

		// every chunk carries the 7 byte command frame on top of its own length
		const totalBytes = chunks.reduce((sum, chunk) => sum + chunk.length + 7, 0)

		// checked before anything is sent: a photo cancelled between being queued and
		// the poll picking it up used to be transferred and printed regardless
		if (signal.aborted) {
			callback(-1)
			return
		}

		let isSendingImage: boolean = true
		let abortedPrinting = false

		signal.addEventListener('abort', () => {
			isSendingImage = false
			abortedPrinting = true
		}, { once: true })

		while (isSendingImage == true && abortedPrinting == false) {
			const writeSize = this.tuning.writeSize
			const writeDelay = this.tuning.writeDelay
			const startedAt = Date.now()
			let sentBytes = 0

			if (import.meta.env.DEV) {
				console.log(
					`> sending ${(imageData.length / 1024).toFixed(1)}kB as ${chunks.length} packets,` +
					` ${writeSize} byte writes ${writeDelay}ms apart`
				)
			}

			try {
				const length = new Uint8Array(2)
				new DataView(length.buffer).setUint16(0, imageData.length, false)

				const response = await this.sendCommand(INSTAX_OPCODES.PRINT_IMAGE_DOWNLOAD_START, [
					0x02, 0x00, 0x00, 0x00, 0x00, 0x00, ...Array.from(length)
				])

				// no answer is a link fault and worth another go; an answer carrying a
				// status is the printer having understood and said no, and no amount
				// of retrying will change its mind
				if (response == null) throw new Error('The printer did not answer the transfer start')

				if (response.status != 0) {
					// 0x01 is the printer still getting ready rather than refusing: it
					// reports a fresh pack's full count before it has finished setting
					// the pack up, and a transfer begun in that window lands here
					const reason = response.status === PRINTER_NOT_READY ? 'busy' : 'refused'

					throw new InstaxPrintError(
						reason,
						reason === 'busy'
							? 'The printer is not ready yet'
							: 'The printer would not accept the image',
						response.status, response.payload ?? []
					)
				}

				for (let packetId = 0; packetId < chunks.length; packetId++) {
					if (!isSendingImage) {
						await new Promise((r) => setTimeout(r, 500))

						// the same verified cancel the error path uses: a fire and forget
						// one could be dropped, leaving the printer mid-download and
						// refusing the next image until it was power cycled
						await this._cancelTransfer()
						callback(-1)
						break
					}

					const packet = this.encode(
						INSTAX_OPCODES.PRINT_IMAGE_DOWNLOAD_DATA,
						Array.from(chunks[packetId])
					)

					const stride = writeStride(packet.length, writeSize)

					for (let index = 0; index < packet.length; index += stride) {
						const isPacketEnd = index + stride >= packet.length
						const slice = packet.slice(index, index + stride)

						// the printer acknowledges each packet, so a write size the link
						// cannot carry shows up here rather than as a corrupt print
						const response = await this.send(slice, isPacketEnd)
						if (isPacketEnd == true && response == null) {
							throw new Error('Printer did not acknowledge the packet')
						}

						sentBytes += slice.length
						callback(sentBytes / totalBytes)

						// the acknowledgement is a wait in itself, so the pause between
						// writes is only needed between writes
						if (!isPacketEnd) await new Promise((r) => setTimeout(r, writeDelay))
					}
				}

				if (abortedPrinting == false) {
					await this.sendCommand(INSTAX_OPCODES.PRINT_IMAGE_DOWNLOAD_END, [], true)

					this.tuning.succeeded()

					if (import.meta.env.DEV) {
						const seconds = (Date.now() - startedAt) / 1000
						console.log(
							`> sent ${(imageData.length / 1024).toFixed(1)}kB in ${seconds.toFixed(1)}s` +
							` (${(imageData.length / 1024 / seconds).toFixed(1)}kB/s)`
						)
					}

					callback(print != true ? -1 : 1)
				}

				isSendingImage = false
			} catch (error) {
				// clearing the printer down is best effort: a printer that has gone
				// quiet will not answer this either, and letting that throw here
				// escapes the retry entirely - which is how a silent printer used to
				// surface as a bare notification timeout rather than a retry
				await this._cancelTransfer()

				// the printer's own answer, not a link fault: it is already known why
				// this failed, and sending the same image eight more times only makes
				// the printer refuse it eight more times
				if (isPrintError(error)) {
					isSendingImage = false
					throw error
				}

				console.error('> image transfer failed, retrying', error)

				// a smaller write first, a longer pause once there is no smaller write
				if (!this.tuning.backOff()) {
					isSendingImage = false
					throw new InstaxPrintError(
						'silent', 'The printer stopped responding while the image was being sent'
					)
				}
			}
		}
	}

	/**
	 * Read back whatever the printer will say about itself, raw.
	 *
	 * The parser keeps only the few fields the UI shows - the film count is a
	 * single nibble of a single byte, and the status byte that came with it is
	 * dropped entirely - so a printer that reports a count it cannot honour looks
	 * no different to one that can. This asks every info command and hands back
	 * the untouched bytes, which is the only way to find out where the truth is.
	 *
	 * Read only: nothing here moves the film or changes a setting.
	 */
	async probe(): Promise<Array<{ opCode: string, command: number, status: number, payload: string }>> {
		const readings: Array<{ opCode: string, command: number, status: number, payload: string }> = []

		const questions: Array<[INSTAX_OPCODES, number[]]> = [
			[INSTAX_OPCODES.SUPPORT_FUNCTION_AND_VERSION_INFO, []],
			[INSTAX_OPCODES.SUPPORT_FUNCTION_INFO, [0]],
			[INSTAX_OPCODES.SUPPORT_FUNCTION_INFO, [1]],
			[INSTAX_OPCODES.SUPPORT_FUNCTION_INFO, [2]],
			[INSTAX_OPCODES.SUPPORT_FUNCTION_INFO, [3]],
			[INSTAX_OPCODES.SUPPORT_FUNCTION_INFO, [4]],
			[INSTAX_OPCODES.SUPPORT_FUNCTION_INFO, [5]],
			[INSTAX_OPCODES.ADDITIONAL_PRINTER_INFO, []],
			[INSTAX_OPCODES.ADDITIONAL_PRINTER_INFO, [0]],
			[INSTAX_OPCODES.ADDITIONAL_PRINTER_INFO, [1]],
			[INSTAX_OPCODES.IDENTIFY_INFORMATION, []],
			[INSTAX_OPCODES.XYZ_AXIS_INFO, []]
		]

		for (const [opCode, command] of questions) {
			try {
				const event = await this.send(this.encode(opCode, command), true)
				const value = (event as { target?: { value?: DataView } } | void)?.target?.value
				if (value == null) continue

				const packet = Array.from(new Uint8Array(value.buffer, value.byteOffset, value.byteLength))
				readings.push({
					opCode: `0x${opCode.toString(16).padStart(4, '0')}`,
					command: command[0] ?? -1,
					status: packet[6],
					payload: this._printableHex(new Uint8Array(packet.slice(8, packet.length - 1)))
				})
			} catch {
				readings.push({
					opCode: `0x${opCode.toString(16).padStart(4, '0')}`,
					command: command[0] ?? -1,
					status: -1,
					payload: 'no answer'
				})
			}

			await new Promise((r) => setTimeout(r, 60))
		}

		console.table(readings)
		return readings
	}

	/** Tell the printer to drop a part sent image, without ever throwing. */
	private async _cancelTransfer(): Promise<void> {
		for (let attempt = 0; attempt < 2; attempt++) {
			try {
				const response = await this.sendCommand(INSTAX_OPCODES.PRINT_IMAGE_DOWNLOAD_CANCEL, [], true)
				if (response?.status === 0) return
			} catch (error) {
				if (import.meta.env.DEV) console.warn('> could not cancel the transfer', error)
			}
		}
	}

	/**
	 * The bytes behind a data URL.
	 *
	 * This used to wrap the decoded bytes in a Blob, then a File, then read them
	 * back out through a FileReader - three further copies of ~60kB and an event
	 * loop hop to arrive at the array it already had. The prefix strip was also a
	 * literal match on the jpeg form, so any other data URL left its prefix in
	 * place and decoded to a handful of bytes.
	 */
	private _base64ToByteArray(base64: string): Uint8Array {
		const payload = String(base64).replace(/^data:[^;,]*;base64,/, '')
		const binary = atob(payload)

		const bytes = new Uint8Array(binary.length)
		for (let index = 0; index < binary.length; index++) bytes[index] = binary.charCodeAt(index)

		return bytes
	}

	createImageDataChunk(index: number, chunk: Uint8Array): Uint8Array {
		// Create a Uint32Array containing the index
		const indexArray = new Uint32Array([index]);

		// Convert the indexArray to a Uint8Array
		const indexBytes = new Uint8Array(indexArray.buffer);

		// Create a new Uint8Array for the combined data
		const combined = new Uint8Array(4 + chunk.length);

		// Manually reorder the bytes to Big Endian format
		for (let i = 0; i < 4; i++) {
			combined[i] = indexBytes[3 - i]; // Reverse the byte order
		}

		// Copy the chunk data into the combined array, after the index
		combined.set(chunk, 4);

		return combined;
	}

	imageToChunks(imgData: Uint8Array, chunkSize = 900): Uint8Array[] {
		// the loop below builds nothing for an empty image, and the padding step then
		// indexes into an empty array and throws a TypeError out of sendImage before
		// it has a try block to catch it
		if (imgData.length === 0) return []

		const imgDataChunks = []

		// pad the last chunk with zeroes if needed
		for (let i = 0; i < imgData.length; i += chunkSize) {
			const chunk = imgData.slice(i, i + chunkSize)
			imgDataChunks.push(chunk)
		}

		if (imgDataChunks[imgDataChunks.length - 1].length < chunkSize) {
			const lastChunk = imgDataChunks[imgDataChunks.length - 1]
			const padding = new Uint8Array(chunkSize - lastChunk.length)
			imgDataChunks[imgDataChunks.length - 1] = new Uint8Array([...lastChunk, ...padding])
		}

		// Create image data chunks with index
		for (let i = 0; i < imgDataChunks.length; i++) {
			imgDataChunks[i] = this.createImageDataChunk(i, imgDataChunks[i])
		}

		return imgDataChunks
	}

	private _decode(event: Event | void): InstaxParsedResponse | undefined {
		if (event == null || event.target == null) return
		const characteristic = event.target as { value?: DataView }
		if (characteristic.value == null) return
		const value = characteristic.value
		const packet = Array.from(new Uint8Array(value.buffer, value.byteOffset, value.byteLength))

		// Validate the packet length and checksum
		const packetLength = (packet[2] << 8) | packet[3]

		const packetChecksum = packet.reduce((acc, val) => acc + val, 0) & 255;

		if (packetLength !== packet.length || packetChecksum !== 255) {
			throw new Error('Invalid packet')
		}


		if (packet[0] != 0x61 || packet[1] != 0x42) throw new Error('Unrecognised packet header')

		if (import.meta.env.DEV) console.log('>', this._printableHex(new Uint8Array(packet)))

		// Extract the event data from the packet
		const opCode = (packet[4] << 8) | packet[5]
		const status = packet[6]
		const command = packet[7]
		const payload = packet.slice(8, packet.length - 1)

		// console.log(status)
		// Return the decoded packet data
		return parse(opCode, command, payload, status)
	}

	/**
	 * encode
	 * @param opcode
	 * @param payload
	 * @returns
	 */
	encode(opcode: number, payload: number[]): Uint8Array {
		// Calculate the length of the command packet
		const length = (payload.length + 7)

		// create the command packet array:
		// - 0x41 and 0x62 are the default headers for Instax printer commands
		// - the next two bytes are the high and low bytes of the packet length
		// - the following two bytes are the high and low bytes of the opcode
		// - the remaining bytes are the payload
		const commandPacket = [
			0x41,
			0x62,
			(length >> 8) & 0xff,
			length & 0xff,
			opcode >> 8,
			opcode & 0xff,
			...payload
		]

		// @TODO: check if invalid packet size or OP-code

		// calculate the checksum of the command packet
		const checksum = commandPacket.reduce((acc, val) => acc + val, 0) & 0xff
		// return the command packet as a Uint8Array with the checksum appended
		return new Uint8Array([...commandPacket, checksum ^ 0xff])
	}


}
