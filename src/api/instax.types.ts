

interface CHARACTERISTIC_REF {
  server: BluetoothRemoteGATTServer | null
  notify: BluetoothRemoteGATTCharacteristic | null
  write: BluetoothRemoteGATTCharacteristic | null
}
