import type { Cable, CableType } from '../types/cable'
import type { ConnectorType, EquipmentItem, Port } from '../types/equipment'
import { getEquipmentById } from './equipmentSelectors'

/** Connector types that have no direct CableType equivalent. The Cable
 *  model collapses these to 'Custom' because the CableType enum is a
 *  subset of ConnectorType (see types/cable.ts). */
const NON_CABLE_CONNECTORS = new Set<ConnectorType>(['DIN', 'DisplayPort', 'USB'])

/** Cable types that carry signal in both directions by physical nature
 *  (issue #67). Cables of these types render with arrow markers on
 *  both ends by default. */
const BIDIRECTIONAL_CABLE_TYPES = new Set<CableType>([
  'Ethernet/RJ45',
  'Fiber',
  'SFP',
  'SFP+',
  'USB-C',
])

export const connectorToCableType = (c: ConnectorType | undefined): CableType => {
  if (!c) return 'Custom'
  if (NON_CABLE_CONNECTORS.has(c)) return 'Custom'
  return c as CableType
}

export const isBidirectionalCableType = (type: CableType): boolean =>
  BIDIRECTIONAL_CABLE_TYPES.has(type)

const findPort = (
  equipment: EquipmentItem[],
  equipmentId: string,
  portId: string,
): Port | undefined => {
  const eq = getEquipmentById(equipment, equipmentId)
  if (!eq) return undefined
  return eq.inputs.find((p) => p.id === portId) ?? eq.outputs.find((p) => p.id === portId)
}

/** Compute the cable type that the cable WOULD inherit from its current
 *  port endpoints. Returns undefined when neither port can be resolved
 *  (orphaned cable). When the two ports disagree we prefer the source
 *  port — matches the creation-time fallback in CableDialog. */
export const inheritedCableType = (
  cable: Pick<Cable, 'fromEquipmentId' | 'fromPortId' | 'toEquipmentId' | 'toPortId'>,
  equipment: EquipmentItem[],
): CableType | undefined => {
  const fromPort = findPort(equipment, cable.fromEquipmentId, cable.fromPortId)
  const toPort = findPort(equipment, cable.toEquipmentId, cable.toPortId)
  if (!fromPort && !toPort) return undefined
  const a = fromPort?.connectorType
  const b = toPort?.connectorType
  if (a && b && a === b) return connectorToCableType(a)
  return connectorToCableType(a ?? b)
}

/** Returns the patch to apply when a cable's type should follow its
 *  port endpoints, or null when no change is needed.
 *
 *  Safety rule: cables flagged as `needsConverter` are skipped — they
 *  were deliberately chosen to differ from one or both port types
 *  (e.g. a BNC-to-RCA breakout). Touching them would clobber an
 *  intentional choice. */
export const cableTypePatchFromPorts = (
  cable: Cable,
  equipment: EquipmentItem[],
): Pick<Cable, 'type' | 'bidirectional'> | null => {
  if (cable.needsConverter) return null
  const derived = inheritedCableType(cable, equipment)
  if (!derived || derived === cable.type) return null
  return {
    type: derived,
    bidirectional: isBidirectionalCableType(derived),
  }
}
