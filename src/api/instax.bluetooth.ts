// instax.bluetooth.ts
import { INSTAX_PRINTER_NAME_PREFIX, INSTAX_PRINTER_SERVICES } from './instax.config'
import type { CHARACTERISTIC_REF } from './instax.types'

/** How long the printer is given to answer a write that expects a reply. */
const RESPONSE_TIMEOUT = 500

export class InstaxBluetooth {
	protected _characteristicRef: CHARACTERISTIC_REF = {
		server: null,
		notify: null,
		write: null
	}

	protected isBusy = false

	/**
	 * The subscription, kept open for as long as the printer is connected.
	 *
	 * Every write that expects a reply used to subscribe and unsubscribe around
	 * itself. An image is acknowledged once per packet, so a single print paid for
	 * a hundred or more of those round trips on top of the data itself. The
	 * printer notifies on one characteristic throughout, so subscribing once and
	 * handing each notification to whoever is waiting does the same job.
	 */
	private _listening: Promise<void> | null = null

	/** Whoever is waiting on the next notification, if anyone is. */
	private _waiting: ((event: Event) => void) | null = null

	/**
	 * Where a notification goes when nothing asked for it.
	 *
	 * The printer speaks up on its own when something goes wrong mid print, and
	 * those packets used to land in the gap between one write's subscription and
	 * the next and be lost. Now that the subscription is held open they arrive,
	 * and this is what they arrive at.
	 */
	protected _onUnsolicited: ((event: Event) => void) | null = null

	private _onNotification = (event: Event): void => {
		const waiting = this._waiting
		this._waiting = null

		if (waiting != null) waiting(event)
		else this._onUnsolicited?.(event)
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
		} finally {
			this._forgetSubscription()
		}
	}

	/** A subscription does not survive the connection that carried it. */
	protected _forgetSubscription(): void {
		this._characteristicRef.notify?.removeEventListener(
			'characteristicvaluechanged', this._onNotification
		)
		this._listening = null
		this._waiting = null
		this._onUnsolicited = null
	}

	/** Subscribe once, and only once, for the life of the connection. */
	private async _listen(): Promise<void> {
		if (this._listening != null) return this._listening

		const notify = this._characteristicRef.notify
		if (notify == null) throw new Error('Not connected')

		this._listening = notify
			.startNotifications()
			.then((handle) => {
				handle.addEventListener('characteristicvaluechanged', this._onNotification)
			})
			.catch((error) => {
				// a failed subscribe must not be remembered as a live one
				this._listening = null
				throw error
			})

		return this._listening
	}

	protected async send(command: Uint8Array, response = true): Promise<Event | void> {
		if (this.isBusy === true) return
		this.isBusy = true

		try {
			if (response !== true) {
				await this._characteristicRef.write!.writeValueWithoutResponse(command as BufferSource)
				return
			}

			await this._listen()

			let timeout: ReturnType<typeof setTimeout> | null = null
			const answer = new Promise<Event>((resolve, reject) => {
				this._waiting = resolve
				timeout = setTimeout(() => {
					this._waiting = null
					reject(new Error('Notification timeout'))
				}, RESPONSE_TIMEOUT)
			})

			// the waiter is armed before the write, so a printer that answers
			// immediately cannot reply into a gap
			await this._characteristicRef.write!.writeValueWithoutResponse(command as BufferSource)

			try {
				return await answer
			} finally {
				if (timeout) clearTimeout(timeout)
			}
		} finally {
			// held until the reply, so two writes can never wait on the same slot
			this.isBusy = false
		}
	}

	/**
	 * Connects to the printer.
	 */
	public async connect(): Promise<boolean | BluetoothDevice> {
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
						this._forgetSubscription()
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

					if (import.meta.env.DEV) console.log('> PRINTER CONNECTED')
					return true
				})

			if (connected === true) return deviceHandle!
			else throw new Error()
		} catch {
			this._forgetSubscription()
			this._characteristicRef.notify = null
			this._characteristicRef.write = null
			return false
		}
	}
}
