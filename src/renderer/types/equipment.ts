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
  | 'Custom'

export interface Port {
  id: string
  name: string
  type: string
  connectorType: ConnectorType
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
}
