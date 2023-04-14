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

          this.sendCommand(
            INSTAX_EVENT.LED_PATTERN_SETTINGS,
            this.color(
              [
                [255, 0, 0],
                [0, 0, 0],
                [255, 0, 0],
                [0, 0, 0],
                [255, 0, 0],
                [0, 0, 0]
              ],
              10,
              0,
              0
            )
          )

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
  imageToChunks(imgData: Uint8Array): Uint8Array[] {
    const imgDataChunks = []

    for (let i = 0; i < imgData.length; i += 1809) {
      const chunk = imgData.slice(i, i + 1809)
      imgDataChunks.push(chunk)
    }

    if (imgDataChunks[imgDataChunks.length - 1].length < 1809) {
      const lastChunk = imgDataChunks[imgDataChunks.length - 1]
      const padding = new Uint8Array(1809 - lastChunk.length)
      imgDataChunks[imgDataChunks.length - 1] = new Uint8Array([...lastChunk, ...padding])
    }

    for (let i = 0; i < imgDataChunks.length; i++) {
      const chunkNumber = new Uint8Array(Uint32Array.of(i).buffer)
      imgDataChunks[i] = new Uint8Array([...chunkNumber, ...imgDataChunks[i]])
    }

    return imgDataChunks
  }

  packUInt32BE(value: number): Uint8Array {
    const buffer = new ArrayBuffer(4)
    const view = new DataView(buffer)
    view.setUint32(0, value, false)
    return new Uint8Array(buffer)
  }

  private async _base64ToByteArray(base64: string): Promise<Uint8Array> {
    return new Promise<Uint8Array>((resolve, reject) => {
      const buffer = Buffer.from(base64.replace('data:image/jpeg;base64,', ''), 'base64')
      console.log(buffer, base64)
      const blob = new Blob([buffer], { type: 'image/jpeg' })
      const file = new File([blob], 'filename.jpg', { type: 'image/jpeg' })
      console.log(blob, file)

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

  public async sendImage(imageString: string): Promise<void> {
    // console.log(imageString)
    const imageByteArr = await this._base64ToByteArray(imageString)

    // divide image data up into chunks of 256 bytes and pad the last chunk with zeroes if needed
    const imgDataChunks = this.imageToChunks(imageByteArr)

    const imageDataQueue = imgDataChunks.map(
      (chunk: Uint8Array) =>
        new Uint8Array(
          this._encode({ opcode: INSTAX_EVENT.PRINT_IMAGE_DOWNLOAD_DATA, payload: chunk })
        )
    )

    console.log('>>> SEND COMMAND', imageDataQueue)

    await this.sendCommand(INSTAX_EVENT.PRINT_IMAGE_DOWNLOAD_START, [
      0x02,
      0x00,
      0x00,
      0x00,
      0x00,
      0x00,
      ...Array.from(this.packUInt16BE(imageByteArr.length))
    ])

    // setTimeout(async () => {
    await this.sendPackets(imageDataQueue, true)
    console.log('FINISH COMMAND')
    // this._commandNotification()

    await this.sendCommand(INSTAX_EVENT.PRINT_IMAGE_DOWNLOAD_END, [], true)
    await this.sendCommand(INSTAX_EVENT.PRINT_IMAGE, [])
    // await this.sendCommand(INSTAX_EVENT.DEVICE_INFO_SERVICE, [2])

    // }, 1000)

    // setTimeout(async () => {
    //   await this.sendCommand(INSTAX_EVENT.PRINT_IMAGE_DOWNLOAD_CANCEL, [])
    // }, 10000)
    // printCommands.push(
    //   new Uint8Array(this._encode({ opcode: INSTAX_EVENT.PRINT_IMAGE_DOWNLOAD_END, payload: [] }))
    // )
    // printCommands.push(
    //   new Uint8Array(this._encode({ opcode: INSTAX_EVENT.PRINT_IMAGE, payload: [] }))
    // )
    // printCommands.push(new Uint8Array(this._encode({ opcode: [0, 2], payload: [0x02] })))

    // console.log('PRINT COMMAND:', printCommands)
    //   printCommands.forEach((packet, index) => {
    //     console.log(`sending image packet ${index + 1}/${printCommands.length}`);
    //     this.sendPacket(packet);
    //   });

    // for (let index = 0; index < printCommands.length; index++) {
    //   setTimeout(async () => {
    //     console.log('SEND', printCommands[index])
    //     await this.sendRawCommand(printCommands[index])
    //   }, (index + 1) * 100)
    // }
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

  public async sendRawCommand(command: Uint8Array): Promise<void> {
    await (this._characteristicRef.write as any).writeValueWithoutResponse(command)
  }

  public async information(): Promise<void> {
    const interval = setInterval(async () => {
      //   await this.sendCommand(INSTAX_EVENT.DEVICE_INFO_SERVICE, [0])
      // await this.sendCommand(INSTAX_EVENT.SUPPORT_FUNCTION_INFO, [1])
      //   await this.sendCommand(INSTAX_EVENT.DEVICE_INFO_SERVICE, [2])
      //   await this.sendCommand(INSTAX_EVENT.SUPPORT_FUNCTION_INFO, [0])
      // await this.sendCommand(INSTAX_EVENT.SUPPORT_FUNCTION_INFO, [1])
      //   await this.sendCommand(INSTAX_EVENT.SUPPORT_FUNCTION_INFO, [2])
      await this.sendCommand(INSTAX_EVENT.SUPPORT_FUNCTION_INFO, [3])
    }, 2500)
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
      console.log('HEADER:', data.slice(7, -1), data)
      ;(decodedPacket.payload as any) = data.slice(7, -1)
      ;(decodedPacket as any).data = this._formatData(
        Object.values(INSTAX_EVENT)[packetIndex],
        data.slice(7, -1)
      )
    }

    return decodedPacket
  }

  parseBatteryPercentage(hexData: number[]): number {
    if (hexData.length !== 7) {
      throw new Error('Invalid hex data. It should contain exactly 7 bytes.')
    }
    console.log('B', hexData)

    // Convert the first 3 bytes into an integer for the current charge level
    const currentCharge = (hexData[0] << 16) | (hexData[1] << 8) | hexData[2]

    // Convert the next 4 bytes into an integer for the maximum charge level
    const maxCharge = (hexData[3] << 24) | (hexData[4] << 16) | (hexData[5] << 8) | hexData[6]

    // Calculate the battery percentage
    const percentage = (currentCharge / maxCharge) * 100

    // Round the percentage to the nearest integer
    const roundedPercentage = Math.round(percentage)

    console.log(currentCharge, maxCharge)
    return roundedPercentage
  }

  prettifyBytearray(value: number[]): string {
    return value.map((x) => x.toString(16).padStart(2, '0')).join(' ')
  }

  getFourByteInt(offset: number, byteArray: number[]): number {
    if (byteArray.length < offset + 4) {
      return 0
    } else {
      return (
        ((byteArray[offset] & 0xff) << 24) |
        ((byteArray[offset + 1] & 0xff) << 16) |
        ((byteArray[offset + 2] & 0xff) << 8) |
        ((byteArray[offset + 3] & 0xff) << 0)
      )
    }
  }

  formatVersionNumber(version: number): string {
    const part2 = version & 0xff
    const part1 = (0xff00 & version) >> 8
    return `${part1.toString(16).padStart(2, '0')}.${part2.toString(16).padStart(2, '0')}`
  }
  getTwoByteInt(offset: number, byteArray: number[]): number {
    if (byteArray.length < offset + 2) {
      return 0
    } else {
      return ((byteArray[offset] & 0xff) << 8) | ((byteArray[offset + 1] & 0xff) << 0)
    }
  }

  getOneByteInt(offset: number, byteArray: number[]): number {
    if (byteArray.length < offset + 1) {
      return 0
    } else {
      return byteArray[offset] & 0xff
    }
  }

  private _formatData(eventCode: number[], data: number[]): any {
    console.log('---------  DATA PARSING --------------', data)
    console.log(
      this.getOneByteInt(1, data),
      this.getOneByteInt(2, data),
      this.getOneByteInt(3, data),
      this.getOneByteInt(4, data),
      this.getOneByteInt(5, data),
      this.getOneByteInt(6, data),
      this.getOneByteInt(7, data),
      this.getOneByteInt(8, data),
      this.getOneByteInt(9, data),
      this.getOneByteInt(10, data),
      this.getOneByteInt(16, data)
    )

    console.log(
      this.getTwoByteInt(0, data),
      this.getTwoByteInt(2, data),
      this.getTwoByteInt(4, data),
      this.getTwoByteInt(6, data),
      this.getTwoByteInt(8, data)
    )

    console.log(
      this.getFourByteInt(0, data),
      this.getFourByteInt(4, data),
      this.getFourByteInt(8, data)
    )

    if (
      eventCode === INSTAX_EVENT.PRINT_IMAGE_DOWNLOAD_DATA ||
      eventCode === INSTAX_EVENT.PRINT_IMAGE_DOWNLOAD_START ||
      eventCode === INSTAX_EVENT.PRINT_IMAGE_DOWNLOAD_END
    ) {
      return this.getOneByteInt(0, data)
    }
    if (eventCode === INSTAX_EVENT.DEVICE_INFO_SERVICE) {
      const infoType = data[0]
      switch (infoType) {
        case 0:
          return { company: String.fromCharCode(...data.slice(1, data.length)) }

        case 1:
          return { printerTypeId: String.fromCharCode(...data.slice(1, data.length)) }
        case 2:
          return { serialNumber: String.fromCharCode(...data.slice(1, data.length)) }

        default:
          break
      }
      console.log('DEINFO', String.fromCharCode(...data))
      return String.fromCharCode(...data)
    } else if (eventCode === INSTAX_EVENT.SUPPORT_FUNCTION_INFO) {
      const infoType = data[0]

      let dataHandle: any = {}
      console.log(this.prettifyBytearray(data))
      switch (infoType) {
        case 0:
          dataHandle = {
            width: this.getTwoByteInt(1, data),
            height: this.getTwoByteInt(3, data),
            packet: this.getTwoByteInt(5, data)
          }
          break

        case 1:
          dataHandle = {
            isCharging: this.getOneByteInt(1, data) == 0x0b,
            battery: this.getOneByteInt(2, data)
          }
          break

        default:
          break
      }

      console.log(dataHandle)
      return dataHandle
    }

    return
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

  async notifications(callback: (event: any) => void): Promise<void> {}

  public color(colorArray: number[][], speed: number, repeat: number, when: number): number[] {
    const payload = new Uint8Array(4 + colorArray.length * 3)

    payload[0] = when
    payload[1] = colorArray.length
    payload[2] = speed
    payload[3] = repeat

    let i = 4
    for (const color of colorArray) {
      payload[i] = color[0]
      payload[i + 1] = color[1]
      payload[i + 2] = color[2]
      i += 3
    }

    return Array.from(payload)
  }
}
