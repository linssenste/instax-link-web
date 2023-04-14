import { INSTAX_EVENT } from './events'




export async function connect(): Promise<void> {
    await navigator.bluetooth.requestDevice({
        filters: [{
            namePrefix: 'INSTAX',
        }], optionalServices: ['0000180a-0000-1000-8000-00805f9b34fb', '00001800-0000-1000-8000-00805f9b34fb', '0000e0ff-3c17-d293-8e48-14fe2e4da212', '70954782-2d83-473d-9e5f-81e1d02d5273']
    })
}
export function parse(event: any): void {
  const dataView = new DataView(event.target.value.buffer as ArrayBufferLike)

  //   const view = new DataView((new Uint8Array(payload)));
  //   return ;
  //   console.log(dataView.getInt32(6, false).toString(2));
  const dataArr: number[] = []
  for (let i = 0; i < dataView.byteLength; i++) {
    dataArr.push(dataView.getUint8(i))
  }

  console.log(dataArr)
  if (dataArr.length < 7) throw new Error()
  else return decodeEvent(dataArr)
}

export function encodeEvent(event: Record<number[], number[]>): number[] {
  const opcode = Object.entries(INSTAX_EVENT).find(
    ([, opcode]) => opcode[0] === event.opcode[0] && opcode[1] === event.opcode[1]
  )
  if (!opcode) throw new Error('Invalid event opcode')

  const payload = event.payload.map((byte) => parseInt(byte, 16))
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

function _isValidPacket(packet: number[]): boolean {
  const packetLength = (packet[2] << 8) | packet[3]

  if (packetLength != packet.length) return false

  return (packet.reduce((acc, val) => acc + val, 0) & 255) === 255 // check checksum
}

function parseBigEndianInts(bytes: number[]): number[] {
  const result: number[] = []

  for (let i = 0; i < bytes.length; i += 4) {
    // Extract four bytes from the input array
    const b1 = bytes[i]
    const b2 = bytes[i + 1]
    const b3 = bytes[i + 2]
    const b4 = bytes[i + 3]

    // Convert the four bytes into a single big-endian integer
    const intValue = (b1 << 24) | (b2 << 16) | (b3 << 8) | b4

    // Add the integer to the result array
    result.push(intValue)
  }

  return result
}

export function decodeEvent(data: number[]): any {

  if (!_isValidPacket(data)) throw new Error()

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

  if (data.length > (7 + 1))  {
    (decodedPacket.payload as any) = data.slice(7, -1);
    (decodedPacket as any).data = formatData(packetName, data.slice(7, -1))
  }


  return decodedPacket;
}

function byteArrayToNumber(byteArray: Uint8Array): number {
  const buffer = new ArrayBuffer(4);
  const view = new DataView(buffer);

  for (let i = 0; i < 4; i++) {
    view.setUint8(i, byteArray[i]);
  }

  return view.getInt32(0);
}

function formatData(eventId: string, data: number[]): string {

    console.log("FORMAT", eventId, data, String.fromCharCode(...data) )

    return ''
}
