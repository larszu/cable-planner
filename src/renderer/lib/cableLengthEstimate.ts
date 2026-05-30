// #350 — Geometrische Kabellängen-Schätzung.
//
// Erste Ausbaustufe: Luftlinie zwischen den Geräte-Mittelpunkten auf dem
// Canvas × Maßstab (Meter pro 100 px) × (1 + Slack%). Das ersetzt das
// manuelle Längen-Tippen für grobe Planung. Eine spätere Stufe kann die
// echten Waypoint-/A*-Pfade statt der Luftlinie nutzen (siehe Issue #350).

import type { Cable } from '../types/cable'
import type { EquipmentItem } from '../types/equipment'
import type { LengthEstimationScheme } from '../types/project'

export const DEFAULT_LENGTH_ESTIMATION: LengthEstimationScheme = {
  metersPer100px: 1,
  slackPercent: 15,
  roundUp: true,
}

const centerOf = (e: EquipmentItem): { x: number; y: number } => ({
  x: e.x + (e.width ?? 220) / 2,
  y: e.y + (e.height ?? 60) / 2,
})

/** Schätzt die Länge EINES Kabels (in Metern) aus der Canvas-Geometrie.
 *  Liefert null, wenn ein Endpunkt-Gerät fehlt oder das Kabel wireless ist. */
export const estimateCableLength = (
  cable: Cable,
  eqById: Map<string, EquipmentItem>,
  scheme: LengthEstimationScheme,
): number | null => {
  if (cable.wireless) return null
  const from = eqById.get(cable.fromEquipmentId)
  const to = eqById.get(cable.toEquipmentId)
  if (!from || !to) return null
  const a = centerOf(from)
  const b = centerOf(to)
  const px = Math.hypot(b.x - a.x, b.y - a.y)
  const meters = (px / 100) * scheme.metersPer100px * (1 + scheme.slackPercent / 100)
  if (scheme.roundUp) return Math.max(1, Math.ceil(meters))
  return Math.max(0.1, Math.round(meters * 10) / 10)
}

export interface EstimateResult {
  /** id → neue Länge für alle Kabel, die geschätzt werden konnten. */
  updates: Map<string, number>
  estimated: number
  skipped: number
}

/** Schätzt die Längen aller (nicht-wireless) Kabel. */
export const estimateAllCableLengths = (
  cables: Cable[],
  equipment: EquipmentItem[],
  scheme: LengthEstimationScheme,
): EstimateResult => {
  const eqById = new Map(equipment.map((e) => [e.id, e]))
  const updates = new Map<string, number>()
  let skipped = 0
  for (const c of cables) {
    const len = estimateCableLength(c, eqById, scheme)
    if (len == null) skipped += 1
    else updates.set(c.id, len)
  }
  return { updates, estimated: updates.size, skipped }
}
