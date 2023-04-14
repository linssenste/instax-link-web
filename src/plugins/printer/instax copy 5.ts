import { INSTAX_EVENT } from './events'
import { INSTAX_PRINTER_NAME_PREFIX, INSTAX_PRINTER_SERVICES } from './instax.config'

interface CharacteristicRef {
  server: BluetoothRemoteGATTServer | null
  notify: BluetoothRemoteGATTCharacteristic | null
  write: BluetoothRemoteGATTCharacteristic | null
}

interface DecodedPacket {
  status: string
  payload: number[] | null
  opcode: number[]
  name: string
  data?: any
}

const PRINTER_SERVICES = [
  '0000180a-0000-1000-8000-00805f9b34fb',
  '00001800-0000-1000-8000-00805f9b34fb',
  '0000e0ff-3c17-d293-8e48-14fe2e4da212',
  '70954782-2d83-473d-9e5f-81e1d02d5273'
]

export class InstaxPrinter {
  private _characteristicRef: CharacteristicRef = {
    server: null,
    notify: null,
    write: null
  }

  constructor() {
    // This is an empty constructor.
  }

  /**
   * manually disconnects the printer
   */
  public async disconnect(): Promise<void> {
    try {
      if (this._characteristicRef.notify !== null) {
        await this._characteristicRef.notify.stopNotifications()
      }
      this._characteristicRef.server!.disconnect()
    } catch (error) {
      console.error('> error on manual disconnect: ', error)
      return
    }
  }

  /**
   * Connects to the printer.
   */
  async connect(): Promise<boolean | BluetoothDevice> {
    try {
      let deviceHandle: BluetoothDevice | null = null
      const connected = await navigator.bluetooth
        .requestDevice({
          filters: [
            {
              namePrefix: INSTAX_PRINTER_NAME_PREFIX
            }
          ],
          optionalServices: INSTAX_PRINTER_SERVICES
        })
        .then((device: BluetoothDevice) => {
          deviceHandle = device
          device.addEventListener('gattserverdisconnected', () => {
            this._characteristicRef.write = null
            this._characteristicRef.notify = null
          })
          return device.gatt!.connect()
        })
        .then((server: BluetoothRemoteGATTServer) => {
          this._characteristicRef.server = server
          return server.getPrimaryService(INSTAX_PRINTER_SERVICES[0])
        })
        .then((service: BluetoothRemoteGATTService) => {
          return service.getCharacteristics()
        })
        .then((characteristics: BluetoothRemoteGATTCharacteristic[]) => {
          if (characteristics === null) throw new Error('invalid-characteristic')

          const writeCharacteristic = characteristics.reduce(
            (a: BluetoothRemoteGATTCharacteristic, b: BluetoothRemoteGATTCharacteristic) =>
              a.properties.write && a.properties.writeWithoutResponse ? a : b
          )
          const notificationsCharacteristic = characteristics.reduce(
            (a: BluetoothRemoteGATTCharacteristic, b: BluetoothRemoteGATTCharacteristic) =>
              a.properties.notify ? a : b
          )

          if (
            notificationsCharacteristic === null ||
            !notificationsCharacteristic.properties.notify ||
            writeCharacteristic === null ||
            !writeCharacteristic.properties.write
          ) {
            throw new Error('missing-characteristics')
          }

          this._characteristicRef.notify = notificationsCharacteristic
          this._characteristicRef.write = writeCharacteristic

          console.log('> PRINTER CONNECTED')
          return true
        })

      if (connected === true) return deviceHandle!
      else throw new Error()
    } catch (error) {
      this._characteristicRef.notify = null
      this._characteristicRef.write = null
      return false
    }
  }

  /**

Sends a raw command to the printer.
@param command The command to send.
*/
  public async sendRawCommand(command: Uint8Array): Promise<void> {
    await this._characteristicRef.write!.writeValueWithoutResponse(command)
  }
  /**

Sends a series of packets to the printer.
@param packetList The list of packets to send.
@param waitResponse Whether to wait for a response after sending each packet.
*/
  public async sendPackets(packetList: Uint8Array[], waitResponse = false): Promise<void> {
    this._commandNotification()
    for (let packetId = 0; packetId < packetList.length; packetId++) {
      this._lastNotification = null
      for (let index = 0; index < packetList[packetId].length; index += 182) {
        await this.sendRawCommand(packetList[packetId].slice(index, index + 182))
        await new Promise((r) => setTimeout(r, 100))
      }

      if (waitResponse === true) {
        const timeoutHandle = setTimeout(() => {
          this._lastNotification = false
        }, 5000)

        await new Promise((r) => setTimeout(r, 100))

        clearTimeout(timeoutHandle)
      }
    }
  }

  /**

Sends a command to the printer.
@param opCode The operation code for the command.
@param payload The payload for the command.
@param waitResponse Whether to wait for a response after sending the command.
*/
  public async sendCommand(
    opCode: number[],
    payload: number[] = [],
    waitResponse = false
  ): Promise<void> {
    if (this._characteristicRef.write === null || opCode === null) throw new Error('error')
    const value = new Uint8Array(this._encode({ opcode: opCode, payload: payload || [] }))

    return await this.sendPackets([value], waitResponse)
  }

  /**
Encodes an event into a packet.
@param event The event to encode.
@returns The encoded packet.
*/
  public _encode(event: any): number[] {
    const opcode = Object.entries(INSTAX_EVENT).find(
      ([, opcodeHandle]: any) =>
        opcodeHandle[0] === event.opcode[0] && opcodeHandle[1] === event.opcode[1]
    )
    if (!opcode) throw new Error('Invalid event opcode')

    const payload = event.payload.map((byte: string | number) => parseInt(String(byte), 16))

    const length = payload.length + 7

    const packet = [
      0x41, // Header
      0x62, // Header
      (length >> 8) & 0xff, // Length high byte
      length & 0xff, // Length low byte
      opcode[1][0], // Opcode 1
      opcode[1][1], // Opcode 2
      ...payload // Payload
    ]

    const checksum = packet.reduce((acc, val) => acc + val, 0) & 0xff

    packet.push(checksum ^ 0xff) // Add checksum

    return packet
  }

  /**

Validates a packet by checking its length and checksum.
@param packet The packet to validate.
@returns A boolean indicating whether the packet is valid.
*/
  private _isValidPacket(packet: number[]): boolean {
    const packetLength = (packet[2] << 8) | packet[3]
    if (packetLength !== packet.length) return false

    return (packet.reduce((acc, val) => acc + val, 0) & 255) === 255 // check checksum
  }

  /**
   * Decodes an event from a packet.
   * @param event The packet containing the event.
   * @returns The decoded event.
   */
  private _decodeEvent(event: any): DecodedPacket | number[] {
    const dataView = new DataView(event.target.value.buffer as ArrayBufferLike)

    const data: number[] = []
    for (let i = 0; i < dataView.byteLength; i++) {
      data.push(dataView.getUint8(i))
    }
    if (data.length < 7) throw new Error()

    if (!this._isValidPacket(data)) throw new Error()

    const packetOp1 = data[4]
    const packetOp2 = data[5]
    const packetStatus = data[6]

    const packetIndex =
      Object.values(INSTAX_EVENT).findIndex(
        (a: number[]) => a[0] === packetOp1 && a[1] === packetOp2
      ) || null

    if (packetIndex === null || Object.keys(INSTAX_EVENT)[packetIndex] === null) return data

    const packetName = Object.keys(INSTAX_EVENT)[packetIndex]

    const decodedPacket: DecodedPacket = {
      status: packetStatus === 0x00 ? 'OK' : 'ERROR',
      payload: null,
      opcode: Object.values(INSTAX_EVENT)[packetIndex],
      name: packetName
    }

    if (data.length > 7 + 1) {
      decodedPacket.payload = data.slice(7, -1)
      decodedPacket.data = this._formatData(
        Object.values(INSTAX_EVENT)[packetIndex],
        data.slice(7, -1)
      )
    }

    return decodedPacket
  }

  /**

Formats data based on the event code.
@param eventCode The event code.
@param data The data to format.
@returns The formatted data.
*/
  private _formatData(eventCode: number[], data: number[]): any {
    console.log('--------- DATA PARSING --------------', data)
  }
  /**

Subscribes to command notifications and processes them.
*/
  private async _commandNotification(): Promise<void> {
    if (this._characteristicRef.notify === null) return

    const va = await this._characteristicRef.notify.startNotifications()

    await new Promise<void>((resolve) => {
      va.addEventListener('characteristicvaluechanged', (e: any) => {
        const decodedEvent = this._decodeEvent(e)
        console.log('NOTIFICATION', decodedEvent)
        resolve()
      })
    })
  }
}
