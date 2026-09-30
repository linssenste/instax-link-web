import { INSTAX_OPCODES } from './events'
import { InstaxBluetooth } from './instax.bluetooth'
import { parse, type InstaxParsedResponse } from './instax.parser'
import { Buffer } from 'buffer'
import { encodeColor } from './instax.color'
import { InstaxFilmVariant, type PrinterBatteryStatus } from '../interfaces/PrinterStateConfig'


export class InstaxPrinter extends InstaxBluetooth {
	constructor() {
		super()
	}

	// Helper function to convert Uint8Array into a human-readable hexadecimal string
	private _printableHex(command: Uint8Array): string {
		return Array.from(command, (byte) => byte.toString(16).padStart(2, '0')).join(' ')
	}

	public async setColor(colors: string[], speed = 20, repeat = 0, when = 0): Promise<void> {
		await this.sendCommand(
			INSTAX_OPCODES.LED_PATTERN_SETTINGS,
			encodeColor(colors, speed, repeat, when),
			false
		)
	}


	// Sends a command to the printer
	async sendCommand(opCode: number, command: number[], awaitResponse = true): Promise<InstaxParsedResponse | undefined> {
		// Encode the command into the Instax packet format
		const instaxCommandData: Uint8Array = this.encode(opCode, command);

		// Log the command as a hex string for debugging purposes
		if (import.meta.env.DEV) console.log('>', this._printableHex(instaxCommandData))

		const response = await this.send(instaxCommandData, awaitResponse)
		return this._decode(response)
	}


	async getInformation(includeType = false) {

		const printerStatus: {
			battery: PrinterBatteryStatus
			polaroidCount: number | null
			type: InstaxFilmVariant | null
		} = {
			battery: {
				charging: false,
				level: null
			},
			polaroidCount: null,
			type: null
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
		return printerStatus;
	}

	async printImage(
		printCount: number = 1,
		callback: (imageId: number) => void,
		signal: AbortSignal
	): Promise<void> {
		await new Promise((r) => setTimeout(r, 500))
		let aborted: boolean = false
		signal.addEventListener('abort', () => {
			aborted = true
		}) 

		// console.log(printCount)
		for (let index = 0; index < (printCount); index++) {
			await this.sendCommand(INSTAX_OPCODES.PRINT_IMAGE, [], true);
			// console.log(index)
			await new Promise((r) => setTimeout(r, 15000))

			if (aborted) {
				callback(-1);
			} else {
				callback(index + 1)
			}
		}
	}

	async sendImage(
		imageUrl: string,
		print = false,
		type: InstaxFilmVariant,
		callback: (progress: number) => void,
		signal: AbortSignal
	): Promise<void> {
		const imageData = await this._base64ToByteArray(imageUrl)

		const chunks = this.imageToChunks(imageData, type == InstaxFilmVariant.SQUARE ? 1808 : 900)

		let isSendingImage: boolean = true
		let printTimeout = 15
		let abortedPrinting = false

		signal.addEventListener('abort', () => {
			// console.log("abORT sIGNaL")
			isSendingImage = false
			abortedPrinting = true
		})

		while (isSendingImage == true && abortedPrinting == false) {

			// 0x08 wide ; 0x00 square
			// 0x02 wide at end; 0x00 square


			try {
				const imageDataLength = imageData.length; // Assuming imageData.length gives the length you want to convert

				// Convert imageDataLength to a Uint16Array
				const uint16Array = new Uint16Array([imageDataLength]);

				// Create a DataView wrapping the ArrayBuffer of the Uint16Array
				const dataView = new DataView(uint16Array.buffer);

				// Get the 16-bit unsigned integer from the DataView in big-endian format
				const bigEndianValue = dataView.getUint16(0, false); // false for big-endian

				// Convert the big-endian value to a Uint8Array
				const bigEndianBytes = new Uint8Array(new Uint16Array([bigEndianValue]).buffer);

				// Use the bigEndianBytes in your command
				const response = await this.sendCommand(INSTAX_OPCODES.PRINT_IMAGE_DOWNLOAD_START, [
					0x02,
					0x00,
					0x00,
					0x00,
					0x00,
					0x00,
					...Array.from(bigEndianBytes)
				]);


				if (response == null || response.status != 0) throw new Error()

				for (let packetId = 0; packetId < chunks.length; packetId++) {

					if (!isSendingImage) {
						await new Promise((r) => setTimeout(r, 500))

						await this.sendCommand(INSTAX_OPCODES.PRINT_IMAGE_DOWNLOAD_CANCEL, [], false)

						callback(-1)


						break
					}
					if (import.meta.env.DEV) console.log(`Packet ${packetId}/${chunks.length}`, isSendingImage)

					const chunk = this.encode(
						INSTAX_OPCODES.PRINT_IMAGE_DOWNLOAD_DATA,
						Array.from(chunks[packetId])
					)


					for (let index = 0; index < (chunks[packetId].length + 7); index += 182) {
						const isPacketEnd = index > (chunks[packetId].length + 7) - 182

						const splitChunk = chunk.slice(index, index + 182)
						// console.log("IS END", isPacketEnd, chunk.slice(index + 182, chunk.length))


						const response = await this.send(splitChunk, isPacketEnd)


						if (isPacketEnd == true &&
							response == null) {
							throw new Error()
						}

						callback(
							(packetId * chunks[packetId].length + index) /
							(chunks[packetId].length * chunks.length)
						)

						// console.log(printTimeout)
						await new Promise((r) => setTimeout(r, printTimeout))
					}
				}

				if (abortedPrinting == false) {
					await this.sendCommand(
						INSTAX_OPCODES.PRINT_IMAGE_DOWNLOAD_END,
						[],
						true
					)


					if (print != true) {
						callback(-1)
					} else {
						callback(1)
					}
				}

				isSendingImage = false
			} catch (error) {
				console.error('> image transfer failed, retrying', error)
				printTimeout += 25

				let resp = await this.sendCommand(INSTAX_OPCODES.PRINT_IMAGE_DOWNLOAD_CANCEL, [], true)
				if (resp?.status !== 0) {
					resp = await this.sendCommand(INSTAX_OPCODES.PRINT_IMAGE_DOWNLOAD_CANCEL, [], true)
				}


				if (printTimeout > 200) {
					isSendingImage = false
					throw new Error('ging einfach net')
				}


			}
		}
	}

	private async _base64ToByteArray(base64: string): Promise<Uint8Array> {
		return new Promise<Uint8Array>((resolve, reject) => {
			const buffer = Buffer.from(String(base64).replace('data:image/jpeg;base64,', ''), 'base64')

			const blob = new Blob([buffer], { type: 'image/jpeg' })
			const file = new File([blob], 'filename.jpeg', { type: 'image/jpeg' })

			const reader = new FileReader()
			reader.onload = () => {
				if (reader.result instanceof ArrayBuffer) {
					const arrayBuffer = reader.result
					const byteArray = new Uint8Array(arrayBuffer)
					resolve(byteArray)
				} else {
					reject(new Error('Failed to read file'))
				}
			}
			reader.onerror = (event) => {
				reject(new Error(`Error reading file: ${event.target?.error}`))
			}
			reader.readAsArrayBuffer(file)
		})
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
		const packet = Array.from(new Uint8Array(characteristic.value.buffer))

		// Validate the packet length and checksum
		const packetLength = (packet[2] << 8) | packet[3]

		const packetChecksum = packet.reduce((acc, val) => acc + val, 0) & 255;

		if (packetLength !== packet.length || packetChecksum !== 255) {
			throw new Error('Invalid packet')
		}


		if (packet[0] != 0x61 || packet[1] != 0x42) throw new Error()

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
