export function encodeColor(
  colorArray: number[][],
  speed: number,
  repeat: number,
  when: number
): number[] {
  const payloadSize = 4 + colorArray.length * 3
  const payload = new Uint8Array(payloadSize)

  payload.set([when, colorArray.length, speed, repeat])

  colorArray.flat().forEach((value, index) => {
    payload[index + 4] = value
  })

  return Array.from(payload)
}

export function connectedAnimation(): Promise<void> {}
