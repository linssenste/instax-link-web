// instax.bluetooth.ts
import { INSTAX_PRINTER_NAME_PREFIX, INSTAX_PRINTER_SERVICES } from './instax.config'

export class InstaxBluetooth {
	protected _characteristicRef: CHARACTERISTIC_REF = {
		server: null,
		notify: null,
		write: null
	}

	protected isBusy = false
	/**
	 * manually disconnects the printer
	 */
	protected async disconnect(): Promise<void> {
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

	protected async notifications(callback: (event: any) => void): Promise<void> {
		if (this._characteristicRef.notify == null) return

		const va = await this._characteristicRef.notify.startNotifications()

		await new Promise<void>(() => {
			va.addEventListener('characteristicvaluechanged', (e: any) => {
				// Do something with the event data here...
				callback(e)
			})
		})
	}

	protected async send(command: Uint8Array, response = true): Promise<Event | void> {
		if (this.isBusy === true) return
		this.isBusy = true
		let timeout: ReturnType<typeof setTimeout> | null = null

		// console.log('SEND', Array.from(command))
		let notificationHandle = null
		let notificationPromise = null
		let timeoutPromise = null
		if (response === true) {
			notificationHandle = await this._characteristicRef.notify!.startNotifications()

			notificationPromise = new Promise<Event>((resolve) => {
				notificationHandle.addEventListener(
					'characteristicvaluechanged',
					(e: Event) => {
						if (timeout) clearTimeout(timeout)

						resolve(e)
					},
					{ once: true }
				)
			})

			timeoutPromise = new Promise<Event>((resolve, reject) => {
				timeout = setTimeout(() => {
					notificationHandle.removeEventListener('characteristicvaluechanged', () => { })
					reject(new Error('Notification timeout'))
				}, 500)
			})
		}

		await this._characteristicRef.write!.writeValueWithoutResponse(command)
		this.isBusy = false
		if (response != true) return

		try {
			const event = await Promise.race([notificationPromise, timeoutPromise])
			if (event) {
				return event
			} else {
				throw new Error('Unexpected void return')
			}
		} finally {
			if (timeout) clearTimeout(timeout)
			await notificationHandle.stopNotifications()
		}
	}

	/**
	 * Connects to the printer.
	 */
	protected async connect(): Promise<boolean | BluetoothDevice> {
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
}
