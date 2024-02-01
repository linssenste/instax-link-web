import { INSTAX_OPCODES } from './events'
import { InstaxBluetooth } from './instax.bluetooth'
import { parse } from './instax.parser'
import { Buffer } from 'buffer'
import { encodeColor } from './instax.color'
export class InstaxPrinter extends InstaxBluetooth {
	constructor() {
		super()
	}

	// Helper function to convert Uint8Array into a human-readable hexadecimal string
	private _printableHex(command: Uint8Array): string {
		return Array.from(command, (byte) => byte.toString(16).padStart(2, '0')).join(' ')
	}

	public async setColor(colors: number[][], speed = 20, repeat = 0, when = 0): Promise<void> {
		await this.sendCommand(
			INSTAX_OPCODES.LED_PATTERN_SETTINGS,
			encodeColor(colors, speed, repeat, when),
			false
		)
	}

	// Sends a command to the printer
	async sendCommand(opCode: number, command: number[], awaitResponse = true): Promise<void> {
		// Encode the command into the Instax packet format
		const instaxCommandData: Uint8Array = this.encode(opCode, command)

		// Log the command as a hex string for debugging purposes
		// console.log('>', this._printableHex(instaxCommandData))

		const response = await this.send(instaxCommandData, awaitResponse)
		return this._decode(response as Event)
	}

	async printImage(
		printCount: number = 1,
		callback: (imageId: any) => void,
		signal: AbortSignal
	): Promise<void> {
		await new Promise((r) => setTimeout(r, 500))
		let aborted = false
		signal.addEventListener('abort', () => {
			aborted = true
		})

		// console.log(printCount)
		for (let index = 0; index < (printCount); index++) {
			  await this.sendCommand(INSTAX_OPCODES.PRINT_IMAGE, [], false)
			console.log(index)
			await new Promise((r) => setTimeout(r, 15000))
 
			if (aborted === true) {
				callback(-1);
			} else {
				callback(index +1)
			}
		}
	}

	async sendImage(
		imageUrl: string,
		print = false,
		callback: (event: any) => void,
		signal: AbortSignal
	): Promise<void> {
		const imageData = await this._base64ToByteArray(imageUrl)

		const chunks = this.imageToChunks(imageData)

		let isSendingImage = true
		let printTimeout = 25
		let abortedPrinting = false

		signal.addEventListener('abort', () => {
			// console.log("abORT sIGNaL")
			isSendingImage = false
			abortedPrinting = true
		})

		while (isSendingImage == true && abortedPrinting == false) {
			try {
				const response = await this.sendCommand(INSTAX_OPCODES.PRINT_IMAGE_DOWNLOAD_START, [
					0x02,
					0x00,
					0x00,
					0x00,
					0x00,
					0x00,
					...Array.from(new Uint8Array(new Uint16Array([imageData.length]).buffer))
				])

				if (response.status != 0) throw new Error()

				for (let packetId = 0; packetId < chunks.length; packetId++) {
					if (isSendingImage == false) {
						setTimeout(async () => {
							await this.sendCommand(INSTAX_OPCODES.PRINT_IMAGE_DOWNLOAD_CANCEL, [], false)

							console.log('CANCEL COMMAND')
							callback(-1)
						}, 1000)

						break
					}
					// console.log(`Packet ${packetId}/${chunks.length}`, isSendingImage)

					const chunk = this.encode(
						INSTAX_OPCODES.PRINT_IMAGE_DOWNLOAD_DATA,
						Array.from(chunks[packetId])
					)

					for (let index = 0; index < chunks[packetId].length; index += 182) {
						const isPacketEnd = index > chunks[packetId].length - 182

						const splitChunk = chunk.slice(index, index + 182)
						const response = await this.send(splitChunk, isPacketEnd)

						
						if (
							isPacketEnd == true &&
							response != null &&
							this._decode(response as Event).status != 0
						) {
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
					const finishResponse = await this.sendCommand(
						INSTAX_OPCODES.PRINT_IMAGE_DOWNLOAD_END,
						[],
						true
					)

					//   console.log('finishResponse', finishResponse)

					if (print != true) {
						callback(-1)
					} else {
						callback(1)
					}
				}

				isSendingImage = false
			} catch (error) {
				// console.log(error)
				printTimeout += 25

				await this.sendCommand(INSTAX_OPCODES.PRINT_IMAGE_DOWNLOAD_CANCEL, [], false)

				if (printTimeout > 100) {
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
		const indexBytes = new Uint8Array(new Uint32Array([index]).buffer)
		const combined = new Uint8Array(indexBytes.length + chunk.length)

		combined.set(indexBytes)
		combined.set(chunk, indexBytes.length)

		return combined
	}

	imageToChunks(imgData: Uint8Array): Uint8Array[] {
		const imgDataChunks = []
		const chunkSize = 1808

		// Divide image data up into chunks of <chunkSize> bytes and pad the last chunk with zeroes if needed
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

	private _decode(event: Event): any {
		if (event == null || event.target == null) return
		const packet = Array.from(new Uint8Array((event.target as any).value.buffer))

		// Validate the packet length and checksum
		const packetLength = (packet[2] << 8) | packet[3]

		const packetChecksum = packet.reduce((acc, val) => acc + val, 0) & 255
		if (packetLength !== packet.length || packetChecksum !== 255) {
			throw new Error('Invalid packet')
		}

		if (packet[0] != 0x61 || packet[1] != 0x42) throw new Error()

		// console.log('>', this._printableHex(new Uint8Array(packet)))

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
		const length = payload.length + 7

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


	connect;
	disconnect;
	
}
