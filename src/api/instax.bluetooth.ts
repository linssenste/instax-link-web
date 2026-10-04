// instax.bluetooth.ts
import { INSTAX_PRINTER_NAME_PREFIX, INSTAX_PRINTER_SERVICES } from './instax.config'
import type { CHARACTERISTIC_REF } from './instax.types'

/** How long the printer is given to answer a write that expects a reply. */
/**
 * How long the printer is given to answer a write that expects a reply.
 *
 * 500ms was too tight. A printer on a low battery, or simply a slower model,
 * takes longer than that over a status command - and because a late reply has
 * nobody left waiting for it, every command then failed and the late answer was
 * dropped without trace. The printer looked silent while it was in fact talking.
 *
 * This only sets how long a *failure* takes to notice; a healthy printer answers
 * in a few tens of milliseconds and nothing waits the difference.
 */
export const RESPONSE_TIMEOUT = 2000

export class InstaxBluetooth {
	protected _characteristicRef: CHARACTERISTIC_REF = {
		server: null,
		notify: null,
		write: null
	}

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

		if (waiting != null) {
			waiting(event)
			return
		}

		if (this._onUnsolicited != null) {
			this._onUnsolicited(event)
			return
		}

		// nobody was waiting and nothing is watching: either the printer volunteered
		// something outside a print, or a reply arrived after its command had given
		// up on it. The second is worth seeing rather than swallowing - it is the
		// difference between a silent printer and a slow one
		if (import.meta.env.DEV) {
			console.warn('> a printer reply arrived with nothing waiting for it')
		}
	}

	/**
	 * manually disconnects the printer
	 */
	public async disconnect(): Promise<void> {
		try {
			if (this._characteristicRef.notify !== null) {
				await this._characteristicRef.notify.stopNotifications()
			}
			this._characteristicRef.server?.disconnect()
		} catch (error) {
			console.error('> error on manual disconnect: ', error)
			return
		} finally {
			// clearing these is not left to the disconnect event: if the teardown above
			// threw, that event may never arrive and a later write would go to a dead
			// characteristic and fail with a raw GATT error instead of a clear one
			this._forgetSubscription()
			this._characteristicRef.write = null
			this._characteristicRef.notify = null
			this._characteristicRef.server = null
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

	/**
	 * Writes are serialised through this, one at a time, in the order asked.
	 *
	 * The link carries one logical conversation: a reply is matched to a request
	 * only by being the next notification to arrive, so two commands in flight at
	 * once would race for the same answer. This used to be guarded by a boolean
	 * that *dropped* the second command and resolved `undefined`, which in the
	 * image loop meant a slice was quietly never written and the packet went out
	 * truncated. Queueing costs nothing here and cannot lose a command.
	 */
	private _chain: Promise<void> = Promise.resolve()

	/**
	 * The opcode a notification is answering, or null if it is not a readable frame.
	 */
	private _opCodeOf(event: Event): number | null {
		const value = (event.target as { value?: DataView } | null)?.value
		if (value == null || value.byteLength < 6) return null

		return value.getUint16(4, false)
	}

	protected async send(command: Uint8Array, response = true, expect?: number): Promise<Event | void> {
		const run = this._chain.then(() => this._sendNow(command, response, expect))

		// the queue must outlive a failed command, and must not itself look like an
		// unhandled rejection to the runtime
		this._chain = run.then(() => undefined, () => undefined)

		return run
	}

	private async _sendNow(command: Uint8Array, response: boolean, expect?: number): Promise<Event | void> {
		// the disconnect handler nulls these, so they are genuinely nullable and a
		// `!` here turned a lost connection into a TypeError with no cause
		const write = this._characteristicRef.write
		if (write == null) throw new Error('Not connected to a printer')

		if (response !== true) {
			await write.writeValueWithoutResponse(command as BufferSource)
			return
		}

		await this._listen()

		let timer: ReturnType<typeof setTimeout> | undefined
		let waiter: ((event: Event) => void) | undefined

		const release = (): void => {
			if (timer != null) clearTimeout(timer)
			// only ever give up our own slot. A stale timer used to null whatever was
			// waiting by the time it fired, so a write that failed here stole the
			// reply belonging to the next command sent
			if (waiter != null && this._waiting === waiter) this._waiting = null
		}

		const answer = new Promise<Event>((resolve, reject) => {
			// Matched by opcode where the caller knows it. Without this a reply that
			// nobody asked for - the printer answers the LED command even when the
			// command is sent without waiting for one - was taken as the answer to
			// whatever was asked next, and every reply after it was one behind for
			// the rest of the connection: status reads returned another command's
			// fields, and packet acknowledgements went to the wrong packet.
			waiter = (event: Event) => {
				const arrived = this._opCodeOf(event)

				if (expect != null && arrived != null && arrived !== expect) {
					if (import.meta.env.DEV) {
						console.warn(
							`> ignoring a reply for 0x${arrived.toString(16).padStart(4, '0')}`
							+ ` while waiting on 0x${expect.toString(16).padStart(4, '0')}`
						)
					}

					// put the slot back and keep waiting for the right one
					this._waiting = waiter ?? null
					return
				}

				resolve(event)
			}

			this._waiting = waiter
			timer = setTimeout(
				() => reject(new Error(`Notification timeout after ${RESPONSE_TIMEOUT}ms`)),
				RESPONSE_TIMEOUT
			)
		})

		// if the write below throws after the timer has already fired, nothing would
		// be awaiting this rejection
		answer.catch(() => { /* handled by the await, or deliberately abandoned */ })

		try {
			// the waiter is armed before the write, so a printer that answers
			// immediately cannot reply into a gap
			await write.writeValueWithoutResponse(command as BufferSource)
			return await answer
		} finally {
			release()
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
