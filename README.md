# Instax Link Web


[![codecov](https://codecov.io/gh/linssenste/instax-link-web/branch/production/graph/badge.svg?token=ZU5AONZOVE)](https://codecov.io/gh/linssenste/instax-link-web)


✨ TL;DR: [https://instax.linssenste.dev](https://instax.linssenste.dev)

Instax Link-Web is a simple web-based tool that connects directly to your INSTAX Link printer and simplifies the way you print Polaroids. There's no software or app to install - just go to the website, connect your printer and start printing. Or don't and just download your Polaroid image - no need for a printer.  
It has a few advantages over the various official apps. For starters: Queuing. You can queue up photos to print one at a time, and while they're being sent and printed, you can prepare the others. So whether you're printing a batch of holiday snaps or decorating your room with your latest adventures, things run smoothly. Preparing images is easy.  You can upload a photo or simply drag and drop it into the tool. Images automatically adjust to fit the frame perfectly. If you want to tweak things, you can drag or zoom the canvas to make manual adjustments or make sure your photos print just the way you want. There are even guidelines to show you the vertical and horizontal centre marks. You can also get artsy with this tool by changing the background of the image and adding images (or just stickers). Be creative with it.  It's all about giving your prints a personal touch and making each one unique. 

Don't have a printer? No problem! You can still create charming Polaroid-style images. Just use the tool as if you were going to print, but apart from printing, just download. The Polaroid frame and some vintage themed filters are applied. Best of all, you can add text to the bottom of the Polaroid in a pen-style font that looks just like handwriting. It's the perfect way to add an old-school feel to your digital pictures.

Instax Link Web makes photo printing fun and easy. Try it out and bring your digital memories to life in a creative and fun way!

**Disclaimer:** While I've tested this project and can confirm that it won't blow up your printer, I can't take responsibility for any mishaps. But hey, resetting an Instax printer is easy.

Big shoutout to Jasper (@javl) for his inspiring [work](https://github.com/javl/InstaxBLE) on the Instax mini link! Another high-paw to my dog Jasper, the photogenic furball who kept me smiling during this project:
![IMG_4D1B5DC83F55-1](https://user-images.githubusercontent.com/13923365/232333543-868db58e-7537-4260-88fa-5c3a7c601268.jpeg)

## Why on Earth did I build this?
I was becoming increasingly frustrated with the number of Instax apps available and decided to develop a streamlined solution that focused solely on allowing users to print photos with their Instax printer - no more, no less. In addition, this project gave me the opportunity to delve into reverse engineering the printer, learn more about the Web Bluetooth API and improve my technical skills. I am happy to report that the endeavour was successful.


## How Does It Work?

There's no magic behind the scenes - just a simple image cropper that lets you edit (pan, zoom, centre, etc.) and save images in Polaroid sizes (600x800, 800x800, 1260x840).

Once you connect your printer via Bluetooth, the app retrieves essential printer information such as battery status, charging level, number of prints remaining and maximum image dimensions (width and height). This information is updated every 2.5 seconds.

During these intervals, the app also checks for queued images that are ready to print. If there's an image in the queue, it's divided into chunks and sent to the printer one at a time. The printer acknowledges each chunk it receives with a notification. If no notification is received, the application resends the segment at a slower rate. 

## Technical Considerations and Compatibility

This application utilizes the [Web Bluetooth API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Bluetooth_API), which enables web applications to communicate with Bluetooth devices. Please note that the functionality of this API is not supported on all devices/browsers. For full compatibility details, refer to the [Web Bluetooth API reference](https://developer.mozilla.org/en-US/docs/Web/API/Web_Bluetooth_API).


## Installation

To set up the project locally, follow these steps:

1. Clone the repository
2. Install the dependencies (`npm i`)

## Usage

To run the project locally:

`npm run dev`

The application will be available at [http://localhost:5173](http://localhost:5173).

## Testing

To run unit tests using vitest:

`npm run test:unit`

## Contributing

Contributions are welcome! If you'd like to help improve Instax Link Web or add support for additional printer models, please submit a pull request.


## License

This project is licensed under the [MIT License](LICENSE).
