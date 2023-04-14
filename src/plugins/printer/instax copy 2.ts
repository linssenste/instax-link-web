import { INSTAX_EVENT } from './events'
import { Buffer } from 'buffer'
interface CHARACTERISTIC_REF {
  server: any
  notify: string | null
  write: string | null
}

const PRINTER_SERVICES = [
  '0000180a-0000-1000-8000-00805f9b34fb',
  '00001800-0000-1000-8000-00805f9b34fb',
  '0000e0ff-3c17-d293-8e48-14fe2e4da212',
  '70954782-2d83-473d-9e5f-81e1d02d5273'
]
export class InstaxPrinter {
  private _lastNotification = null
  private _characteristicRef: CHARACTERISTIC_REF = {
    server: null,
    notify: null,
    write: null
  }

  constructor() {
    // this.connectPrinter()
    // navigator.bluetooth.getDevices().then(devices => {console.log(devices)})
  }

  public async disconnect(): Promise<void> {
    try {
      // await this.sendCommand(INSTAX_EVENT.LED_PATTERN_SETTINGS, this.color([[0, 0, 255], [0, 0, 0], [0, 0, 255], [0, 0, 0]], 10, 0, 0))

      if (this._characteristicRef.notify != null)
        (this._characteristicRef.notify as any).stopNotifications().catch(() => {})
      this._characteristicRef.server.disconnect()
    } catch (error) {
      console.error('> error on manual disconnect: ', error)
      return
    }
  }

  async connect(): Promise<boolean | any> {
    try {
      let deviceHandle = null
      const connected = await navigator.bluetooth
        .requestDevice({
          filters: [
            {
              namePrefix: 'INSTAX'
            }
          ],
          optionalServices: PRINTER_SERVICES
        })
        .then((device) => {
          deviceHandle = device
          device.addEventListener('gattserverdisconnected', () => {
            this._characteristicRef.write = null
            this._characteristicRef.notify = null
          })
          return (device.gatt as any).connect()
        })

        // Get the server we want
        .then((server) => {
          // console.log(server)
          this._characteristicRef.server = server
          return server.getPrimaryService('70954782-2d83-473d-9e5f-81e1d02d5273')
        })

        .then((service) => {
          return service.getCharacteristics() //("70954783-2d83-473d-9e5f-81e1d02d5273");
        })

        .then((characteristic) => {
          // console.log("H")
          if (characteristic == null) throw new Error('invalid-characteristic')

          const writeCharacteristic = characteristic.reduce((a: any, b: any) =>
            a.properties.write == true && a.properties.writeWithoutResponse == true ? a : b
          )
          const notificationsCharacteristic = characteristic.reduce((a: any, b: any) =>
            a.properties.notify == true ? a : b
          )

          if (
            notificationsCharacteristic == null ||
            notificationsCharacteristic.properties.notify != true ||
            writeCharacteristic == null ||
            writeCharacteristic.properties.write != true
          ) {
            throw new Error('missing-characteristics')
          }

          console.log(writeCharacteristic, notificationsCharacteristic)

          this._characteristicRef.notify = notificationsCharacteristic as any
          this._characteristicRef.write = writeCharacteristic as any

          console.log('CONNECTED')

          return true
          // this._characteristicRef.notify.startNotifications().then((e) => {console.log("DONE", e)})
        })

      if (connected == true) return deviceHandle
      else throw new Error()
    } catch (error) {
      this._characteristicRef.notify = null
      this._characteristicRef.write = null

      return false
    }
  }

  packUInt16BE(value: number): Uint8Array {
    const buffer = new ArrayBuffer(2)
    const view = new DataView(buffer)
    view.setUint16(0, value, false) // false for big-endian byte order
    return new Uint8Array(buffer)
  }

  //   packUInt32BE(value: number): Uint8Array {
  //     const buffer = new ArrayBuffer(4)
  //     const view = new DataView(buffer)
  //     view.setUint32(0, value, false)
  //     return new Uint8Array(buffer)
  //   }

  public async sendRawCommand(command: Uint8Array): Promise<void> {
    await (this._characteristicRef.write as any).writeValueWithoutResponse(command)
  }

  public async sendPackets(packetList: Uint8Array[], waitResponse = false): Promise<void> {
    // console.log('PACK', packetList, packetList[0]);
    this._commandNotification()

    for (let packetId = 0; packetId < packetList.length; packetId++) {
      console.log(
        'PACKET ',
        packetId + '/' + packetList.length + ' - ' + Math.round(packetList[packetId].length / 182)
      )
      this._lastNotification = null
      for (let index = 0; index < packetList[packetId].length; index += 182) {
        // const element = array[index];
        // console.log("BLE ", (index/packetList[packetId].length) + "/" + packetList[packetId].length/182)

        // console.log('SEND!', packetList[packetId].slice(index, index + 182).length)

        await this.sendRawCommand(packetList[packetId].slice(index, index + 182))
        await new Promise((r) => setTimeout(r, 100))
      }

      if (waitResponse == true) {
        const timeoutHandle = setTimeout(() => {
          ;(this._lastNotification as any) = false
        }, 5000)

        await new Promise((r) => setTimeout(r, 100))
        //   while (this._lastNotification ==  null);

        clearTimeout(timeoutHandle)
      }
    }
  }

  public async sendCommand(
    opCode: number[],
    payload: number[] = [],
    waitResponse = false
  ): Promise<void> {
    if (this._characteristicRef.write == null || opCode == null) throw new Error('error')

    const value = new Uint8Array(this._encode({ opcode: opCode, payload: payload || [] }))
    return await this.sendPackets([value], waitResponse)
  }

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

    console.log('BEFORE LENG', packet.length)
    packet.push(checksum ^ 0xff) // Add checksum

    console.log('AFTER: ', packet.length)
    return packet
  }

  private _isValidPacket(packet: number[]): boolean {
    const packetLength = (packet[2] << 8) | packet[3]

    if (packetLength != packet.length) return false

    return (packet.reduce((acc, val) => acc + val, 0) & 255) === 255 // check checksum
  }

  private _decodeEvent(event: any): any {
    const dataView = new DataView(event.target.value.buffer as ArrayBufferLike)

    //   const view = new DataView((new Uint8Array(payload)));
    //   return ;
    //   console.log(dataView.getInt32(6, false).toString(2));
    const data: number[] = []
    for (let i = 0; i < dataView.byteLength; i++) {
      data.push(dataView.getUint8(i))
    }
    if (data.length < 7) throw new Error()

    if (!this._isValidPacket(data)) throw new Error()

    const packetOp1 = data[4]
    const packetOp2 = data[5]
    const packetStatus = data[6]

    //   if (packetStatus != 0x00) throw new Error('NOT OK');
    const packetIndex =
      Object.values(INSTAX_EVENT).findIndex(
        (a: number[]) => a[0] == packetOp1 && a[1] == packetOp2
      ) || null

    if (packetIndex == null || Object.keys(INSTAX_EVENT as any)[packetIndex] == null) return data

    const packetName = Object.keys(INSTAX_EVENT)[packetIndex]

    const decodedPacket = {
      status: packetStatus == 0x00 ? 'OK' : 'ERROR',
      payload: null,
      opcode: Object.values(INSTAX_EVENT)[packetIndex],
      name: packetName
    }

    if (data.length > 7 + 1) {
      ;(decodedPacket.payload as any) = data.slice(7, -1)
      ;(decodedPacket as any).data = this._formatData(
        Object.values(INSTAX_EVENT)[packetIndex],
        data.slice(7, -1)
      )
    }

    return decodedPacket
  }

  private _formatData(eventCode: number[], data: number[]): any {
    console.log('---------  DATA PARSING --------------', data)
  }

  private async _commandNotification(): Promise<void> {
    if (this._characteristicRef.notify == null) return

    const va = await this._characteristicRef.notify.startNotifications()

    await new Promise<void>((resolve) => {
      va.addEventListener('characteristicvaluechanged', (e: any) => {
        // Do something with the event data here...
        console.log('NOTIFICATION', this._decodeEvent(e))
        this._lastNotification = this._decodeEvent(e)
        resolve()
      })
    })
  }
}
