

export function encodeColor(
  colorArray: string[],
  speed: number,
  repeat: number,
  when: number
): number[] {
	console.log(colorArray)
	const colorsBGR = colorArray.map(color => convertHexColor(color));
  const payloadSize = 4 + colorsBGR.length * 3
  const payload = new Uint8Array(payloadSize)

  payload.set([when, colorsBGR.length, speed, repeat])

  colorsBGR.flat().forEach((value, index) => {
    payload[index + 4] = value
  })

  return Array.from(payload)
}

function convertHexColor(hex: string): number[] | null {

	hex = hex.replace(/^#/, ''); // Remove the '#' if present
  
	// Convert shorthand hex to full hex
	if (hex.length === 3) {
	  hex = hex
		.split('')
		.map((char) => char.repeat(2))
		.join('');
	}
  
	// Parse hex to RGB
	const rgb = parseInt(hex, 16);
	const red = (rgb >> 16) & 255;
	const green = (rgb >> 8) & 255;
	const blue = rgb & 255;
  
	// Return BGR array
	return [blue, green, red];
  }
  
