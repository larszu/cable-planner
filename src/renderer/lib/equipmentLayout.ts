// v7.9.4 — Shared port-position geometry. Single source of truth so
// EquipmentNode (renders the device), CanvasArea#layoutOf (A* routing
// + cable-edge endpoint computation) AND PendingCableOverlay (yellow
// dashed line) compute IDENTICAL port positions. Before, each
// duplicated a simplified version and got the wide-device case wrong:
// the auto-expand-to-fit-port-labels logic was only in EquipmentNode,
// so the overlay's stub-width left the pending line starting at the
// "middle" of wide devices instead of at the actual handle.

import type { EquipmentItem, GreenGoConfig, Port } from '../types/equipment'
import { findGreenGoUserForEquipment } from './greengoSync'

const HEADER_HEIGHT = 48
const HEADER_HEIGHT_WITH_IP = 62
const PORT_ROW = 22
const PADDING = 8

export type PortSide = 'left' | 'right'

export interface PortPosition {
  side: PortSide
  /** Flow-coordinates of the port handle center. */
  x: number
  y: number
}

export interface EquipmentLayout {
  width: number
  height: number
  /** Liefert die exakte Position des Handle-Mittelpunkts in Flow-Koords. */
  portPos: (portId: string, type: 'source' | 'target') => PortPosition | null
}

const resolveSide = (
  port: Port | undefined,
  defaultSide: PortSide,
  mirrored: boolean,
): PortSide => {
  if (port?.side === 'left' || port?.side === 'right') return port.side
  if (!mirrored) return defaultSide
  return defaultSide === 'left' ? 'right' : 'left'
}

/** Berechnet das Layout eines Equipment-Items genau so wie EquipmentNode
 *  es rendert: Header inkl. IP/Subtitle/Beltpack, Port-Side-Bucketing,
 *  Auto-Expand auf intrinsic width für lange Port-Labels. */
export const computeEquipmentLayout = (
  eq: EquipmentItem,
  greengoConfig?: GreenGoConfig,
): EquipmentLayout => {
  const inputs = eq.inputs ?? []
  const outputs = eq.outputs ?? []
  const portsFlipped = !!eq.portsFlipped

  // Header height: identical formula as EquipmentNode.tsx.
  const greengoUser = findGreenGoUserForEquipment(eq.id, greengoConfig)
  const beltpackLine = greengoUser ? 14 : 0
  const headerHeight =
    (eq.ipAddress
      ? eq.subtitle
        ? HEADER_HEIGHT_WITH_IP + 14
        : HEADER_HEIGHT_WITH_IP
      : eq.subtitle
        ? HEADER_HEIGHT + 14
        : HEADER_HEIGHT) + beltpackLine

  // Side bucketing — identical to EquipmentNode.
  const inputPlacement = new Map<string, { side: PortSide; slot: number }>()
  const outputPlacement = new Map<string, { side: PortSide; slot: number }>()
  const sideCounts: Record<PortSide, number> = { left: 0, right: 0 }
  for (const port of inputs) {
    const side = resolveSide(port, 'left', portsFlipped)
    const slot = sideCounts[side]
    sideCounts[side] += 1
    inputPlacement.set(port.id, { side, slot })
  }
  for (const port of outputs) {
    const side = resolveSide(port, 'right', portsFlipped)
    const slot = sideCounts[side]
    sideCounts[side] += 1
    outputPlacement.set(port.id, { side, slot })
  }

  // Width: same auto-expand logic as EquipmentNode (longest port label
  // can push the box wider than the stored eq.width).
  const longestPortText = [...inputs, ...outputs].reduce(
    (max, p) =>
      Math.max(max, (p.name?.length ?? 0) + (p.connectorType?.length ?? 0) + 3),
    0,
  )
  const labelWidth = longestPortText * 7 + 32
  const intrinsicWidth = Math.max(220, labelWidth * 2)
  const width = Math.max(eq.width ?? intrinsicWidth, intrinsicWidth)

  const portRows = Math.max(sideCounts.left, sideCounts.right, 1)
  const computedHeight = headerHeight + portRows * PORT_ROW + PADDING
  const height = Math.max(eq.height ?? computedHeight, computedHeight)

  const rowCenter = (slot: number): number => headerHeight + slot * PORT_ROW + PORT_ROW / 2

  const portPos = (portId: string, type: 'source' | 'target'): PortPosition | null => {
    const isOutput = type === 'source'
    let placement = (isOutput ? outputPlacement : inputPlacement).get(portId)
    if (!placement) {
      // Bi-directional fallback: port might live in the OTHER list.
      placement = (isOutput ? inputPlacement : outputPlacement).get(portId)
    }
    if (!placement) return null
    const x = placement.side === 'left' ? eq.x : eq.x + width
    const y = eq.y + rowCenter(placement.slot)
    return { side: placement.side, x, y }
  }

  return { width, height, portPos }
}
