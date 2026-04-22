import type { ConnectorType } from './equipment'

export type CableType = Exclude<ConnectorType, 'DIN' | 'DisplayPort' | 'USB'> | 'Custom'

export interface Cable {
  id: string
  name: string
  type: CableType
  length: number
  color: string
  fromEquipmentId: string
  fromPortId: string
  toEquipmentId: string
  toPortId: string
  notes: string
}
