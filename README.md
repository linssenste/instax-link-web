# Instax Link Web

Instax Link Web is an open-source web application that allows you to use Fujifilm's INSTAX link printers (mini, square, and wide) directly from your browser. The project currently supports the square link printer, with support for mini and wide printers in progress. Leveraging the Web Bluetooth API, the application is compatible with select browsers that support this technology. Built using Vue 3 and Vite, the project also includes vitest for unit testing.

**Disclaimer:** This project interacts with hardware, and while it has been tested, the developers are not responsible for any issues that may arise. That said, resetting an Instax printer is usually a straightforward process.

A special thanks to Jasper, whose work on the Instax mini link was instrumental in getting this project off the ground.

## Prerequisites

- Node.js (v14+ recommended)
- A compatible browser that supports the Web Bluetooth API (e.g., Google Chrome, Microsoft Edge)

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

```npm run test:unit

```

## Contributing

Contributions are welcome! If you'd like to help improve Instax Link Web or add support for additional printer models, please submit a pull request.

## Acknowledgements

@javl's work on the Instax mini link ([https://github.com/javl/InstaxBLE](Instax BLE repository)) , which was a great help in developing this project.

## License

This project is licensed under the [MIT License](LICENSE).
