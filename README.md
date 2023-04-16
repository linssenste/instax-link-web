# Instax Link Web: A Fun and Slightly Useful Project

[![codecov](https://codecov.io/gh/linssenste/instax-link-web/branch/production/graph/badge.svg?token=ZU5AONZOVE)](https://codecov.io/gh/linssenste/instax-link-web)


Welcome to Instax Link Web, the rebellious lovechild of the 2,450,984 existing INSTAX apps for printers. With our open-source web application, you can use Fujifilm's INSTAX link printers (mini, square, and wide) directly from your browser, no strings attached! For now, the square link printer is our star, but mini and wide are eagerly waiting in the wings. Powered by the Web Bluetooth API, our app is compatible with the cool kids' club of browsers that embrace cutting-edge tech.

Crafted with Vue 3 and Vite, and sprinkled with vitest for unit testing, this project is as whimsical as it is functional.

**Disclaimer:** While I've tested this project and can confirm it won't blow up your printer, I can't take responsibility for any mishaps. But hey, resetting an Instax printer is usually as easy as 1-2-3!

Big shoutout to Jasper, who didn't know their work on the Instax mini link would inspire this little gem.

## Why on Earth Did We Build This?

Well, I had enough of the countless INSTAX apps and thought I could create something that _just_ lets you print photos with your Instax printer. That's it. Plus, I wanted to see if I could reverse engineer the printer, learn something new, and use the Web Bluetooth API. Spoiler alert: it works!

In the future, I might toy around with more quirky projects, like a "Hub" functionality. Picture this: multiple people sending photos to the printer without needing a direct connection. Instead, they'd send the images to a queue on the Hub (like a computer), which would print them one by one. Why? Because I've been frustrated with the INSTAX app, that's why!

## What Sorcery Happens on the Website?

No magic here, folks. Just a simple image cropper that lets you edit and save Polaroid-sized pictures. When you save an image, the data gets compressed (albeit a bit crudely for now) because, well, it's meant for printing.

Once you connect your printer via Bluetooth, the app fetches specific details like battery status, charging state, remaining prints, and allowed image dimensions (width and height). These updates roll in every 2.5 seconds.

When you print an image, the app slices it into chunks and sends them piece by piece to the printer. The printer sends a notification after each chunk, which the app patiently awaits. If there's no notification, the app tries again—slower this time. The printing process is a no-frills 13-second timeout because that's how long it takes to print a picture.

So there you have it, Instax Link Web: a fun little side project that doesn't take itself too seriously, just like its README.

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

## Acknowledgements

@javl's work on the Instax mini link ([https://github.com/javl/InstaxBLE](Instax BLE repository)) , which was a great help in developing this project.

## License

This project is licensed under the [MIT License](LICENSE).
