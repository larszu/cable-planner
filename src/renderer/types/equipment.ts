export type ConnectorType =
  | 'XLR'
  | 'BNC'
  | 'HDMI'
  | 'SDI'
  | 'Ethernet/RJ45'
  | 'Fiber'
  | 'DIN'
  | 'DisplayPort'
  | 'USB'
  | 'IEC 230V'
  | 'PowerCON'
  | 'Schuko 230V'
  | 'Custom'

import type { SignalStandard } from './cableSpec'

export interface Port {
  id: string
  name: string
  type: string
  connectorType: ConnectorType
  /** Optional signal standard declared for this port (e.g. SDI-12G on a camera out). */
  standard?: SignalStandard
}

export interface EquipmentItem {
  id: string
  name: string
  category: string
  inputs: Port[]
  outputs: Port[]
  rentmanId?: string
  x: number
  y: number
  width: number
  height: number
  /** Optional network/access info for devices that have it (cameras, switches, servers). */
  ipAddress?: string
  macAddress?: string
  username?: string
  password?: string
  notes?: string
}

export type EquipmentTemplate = Omit<EquipmentItem, 'id' | 'x' | 'y'>

