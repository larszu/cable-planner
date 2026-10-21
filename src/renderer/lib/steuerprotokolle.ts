import type { EquipmentTemplate } from '../types/equipment'

// ───────────────────────────────────────────────────────────────────────────
// #1063 — "Steuerung über": control protocol, port and interface per device.
//
// Kept as an overlay keyed by the stable deviceTypeId instead of written into
// the catalogue files, because `cameraBodyCatalog.ts` is GENERATED from
// multicam-planner and a hand edit there would vanish on the next
// `katalog:uebernahme`.
//
// Every value is taken from manufacturer documentation; `source` holds that
// document (tests enforce it). A value the documentation does not state is
// left out — never guessed. For every serial interface the network-bridge
// setup is documented (interface, pinout, baud, TCP mode, ports,
// packetization); fields the manufacturer does not publish are listed in
// `bridge.unverified` instead of being filled in.

export interface SerialSettings {
  standard: 'RS-422' | 'RS-232' | 'RS-485'
  /** Supported baud rates (bit/s), selectable on the device. */
  baud?: number[]
  /** Character format, e.g. "8N1". */
  format?: string
  /** Pin assignment of the connector, as published by the manufacturer. */
  pinout?: string
  /** Flow-control remark from the documentation. */
  flowControl?: string
  /** Multidrop / daisy-chain remark from the documentation. */
  multidrop?: string
}

export interface BridgeSetup {
  /** A serial-to-IP device server can carry this interface. */
  capable: boolean
  /** Device-server mode to use (raw TCP server/client, UDP). */
  tcpMode?: string
  /** Port on the device server; site-chosen unless the protocol fixes it. */
  port?: string
  /** How messages are framed — what the bridge must not split. */
  packetization?: string
  /** Bridge fields the manufacturer documentation does not state. */
  unverified?: string[]
}

export interface ControlInterface {
  /** Protocol name as the manufacturer calls it. */
  protocol: string
  transport: 'serial' | 'ip'
  /** Physical connector on the device. */
  connector?: string
  serial?: SerialSettings
  ip?: { layer: 'UDP' | 'TCP' | 'HTTP'; port?: number }
  bridge?: BridgeSetup
  /** Manufacturer document the values come from. */
  source: string
}

export interface ControlEntry {
  deviceTypeId: string
  /** Model name, for readability and as a guard against a mismatched id. */
  name: string
  interfaces: ControlInterface[]
}

// Sources
const SONY_H800_VISCA =
  'https://sony.net/Products/CameraSystem/CA/BRC_X1000_BRC_H800/Technical_Document/C456100111.pdf'
const SONY_FR7_VISCA =
  'https://www.sony.jp/ls-camera/download/pdf/FR7/ILME-FR7_VISCA_command_list.pdf'
const PANA_UE150 = 'https://pro-av.panasonic.net/en/products/aw-ue150/spec.html'

const VISCA_PACKETS = 'VISCA packets end with terminator 0xFF; forward each packet whole'

const viscaOverIp = (source: string): ControlInterface => ({
  protocol: 'VISCA over IP',
  transport: 'ip',
  connector: 'RJ-45 (LAN)',
  ip: { layer: 'UDP', port: 52381 },
  source,
})

export const CONTROL_CATALOG: ControlEntry[] = [
  {
    deviceTypeId: '022910f2-5d5e-5086-b2c7-fa3d1450eb36',
    name: 'Sony BRC-H800',
    interfaces: [
      {
        protocol: 'VISCA',
        transport: 'serial',
        connector: 'RJ-45 (VISCA RS-422 In/Out)',
        serial: {
          standard: 'RS-422',
          baud: [9600, 38400],
          format: '8N1',
          flowControl: 'none (XON/XOFF and RTS/CTS not supported)',
          multidrop: 'daisy chain, up to 7 cameras per controller',
        },
        bridge: {
          capable: true,
          tcpMode: 'raw TCP server on an RS-422 device server',
          port: 'site-chosen on the device server',
          packetization: VISCA_PACKETS,
          unverified: ['RJ-45 pinout'],
        },
        source: SONY_H800_VISCA,
      },
      viscaOverIp(SONY_H800_VISCA),
    ],
  },
  {
    deviceTypeId: 'd395a7c8-f074-5eb2-a84b-030fa2eeb8c9',
    name: 'Sony FR7',
    interfaces: [viscaOverIp(SONY_FR7_VISCA)],
  },
  {
    deviceTypeId: '7a15a7da-3f17-59cb-896d-8741e61723bb',
    name: 'Panasonic AW-UE150',
    interfaces: [
      {
        protocol: 'AW protocol',
        transport: 'serial',
        connector: 'RJ-45 (CONTROL IN RS-422A)',
        serial: { standard: 'RS-422' },
        bridge: {
          capable: true,
          tcpMode: 'raw TCP server on an RS-422 device server',
          port: 'site-chosen on the device server',
          unverified: ['baud rate', 'character format', 'RJ-45 pinout', 'packet framing'],
        },
        source: PANA_UE150,
      },
      {
        protocol: 'IP control (TCP/IP, UDP/IP, HTTP)',
        transport: 'ip',
        connector: 'RJ-45 (LAN, 100BASE-TX/1000BASE-T)',
        ip: { layer: 'HTTP' },
        source: PANA_UE150,
      },
    ],
  },
]

const BY_ID = new Map(CONTROL_CATALOG.map((e) => [e.deviceTypeId, e]))

/** Control interfaces for a device type, or undefined. */
export const controlInterfacesFor = (deviceTypeId: string | undefined) =>
  deviceTypeId ? BY_ID.get(deviceTypeId)?.interfaces : undefined

/** Attach the documented control interfaces to a catalogue template. */
export const mitSteuerung = (t: EquipmentTemplate): EquipmentTemplate => {
  const interfaces = controlInterfacesFor(t.deviceTypeId)
  return interfaces && !t.controlInterfaces ? { ...t, controlInterfaces: interfaces } : t
}
