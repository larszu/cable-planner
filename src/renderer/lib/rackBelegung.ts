// Racks des Plans -> Austauschformat `avplan-rack-belegung` (siehe
// `rackBelegungFormat.ts`). Die EINE Stelle, an der von der Zählung des
// Rack-Builders (HE 1 = oben) auf die der Branche (HE 1 = unten) umgerechnet
// wird.
import type { GroupPreset } from '../types/equipment'
import type { PlanRack, RackBelegungsZeile } from './rackBelegungFormat'

/**
 * Die unterste belegte HE, von unten gezählt.
 *
 * Der Rack-Builder legt ein Gerät mit `startUnit` (oberste belegte Zeile,
 * von oben) und `heightUnits` ab; seine unterste Zeile ist damit
 * `startUnit + heightUnits - 1` von oben, und von unten gezählt
 * `totalUnits - (startUnit + heightUnits - 1) + 1`.
 */
export const heVonUnten = (totalUnits: number, startUnit: number, heightUnits: number): number =>
  totalUnits - startUnit - heightUnits + 2

/**
 * Ein Rack-Preset als Plan-Rack. `null` für eine Gruppe ohne Rack.
 *
 * Ein Gerät, das nach der Umrechnung unter HE 1 oder über das Rack hinaus
 * reichte, fällt heraus statt verschoben zu werden: eine verschobene Lage
 * sähe im Lager aus wie eine geplante. `verworfen` zählt sie, damit die
 * Oberfläche es sagen kann.
 */
export function planRackAusPreset(preset: GroupPreset): { rack: PlanRack; verworfen: number } | null {
  const r = preset.rack
  if (!r || !(r.totalUnits > 0)) return null
  let verworfen = 0
  const belegung: RackBelegungsZeile[] = []
  for (const p of r.placements) {
    const hoehe = Math.round(p.heightUnits)
    const start = heVonUnten(r.totalUnits, p.startUnit, hoehe)
    const label = preset.items[p.itemIndex]?.name?.trim()
    if (!label || hoehe < 1 || start < 1 || start + hoehe - 1 > r.totalUnits) {
      verworfen += 1
      continue
    }
    belegung.push({ startHE: start, hoeheHE: hoehe, label, ...(p.mountSide ? { seite: p.mountSide } : {}) })
  }
  belegung.sort((a, b) => a.startHE - b.startHE)
  return {
    rack: {
      planRef: preset.id,
      name: preset.name,
      hoeheHE: r.totalUnits,
      ...(r.depthMm && r.depthMm > 0 ? { tiefeMm: r.depthMm } : {}),
      belegung,
    },
    verworfen,
  }
}

/** Alle Racks einer Bibliothek. */
export function planRacks(presets: readonly GroupPreset[]): { racks: PlanRack[]; verworfen: number } {
  const racks: PlanRack[] = []
  let verworfen = 0
  for (const p of presets) {
    const r = planRackAusPreset(p)
    if (!r) continue
    racks.push(r.rack)
    verworfen += r.verworfen
  }
  return { racks, verworfen }
}
