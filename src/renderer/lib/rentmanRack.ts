import { v4 as uuidv4 } from 'uuid'
import type { EquipmentTemplate, GroupPreset } from '../types/equipment'

/**
 * #335 — Rentman physische Kombination → Cable-Planner Rack.
 *
 * Eine Rentman-Kombination besteht aus mehreren einzelnen Equipment-IDs.
 * Beim Import „als Rack" wird daraus ein GroupPreset mit Rack-Metadaten:
 *
 * - `rack.rentmanId` = Equipment-ID der Kombination → das Rack trägt als
 *   Einheit die Kombi-ID.
 * - jedes Item trägt seine eigene `rentmanId` → die Inhalte behalten ihre
 *   individuellen Rentman-IDs (genau die Invariante aus Issue #335).
 *
 * Höhen kommen aus `rackUnits` der Kind-Templates (Default 1 HE, da Rentman
 * keine HE-Höhe liefert); die Inhalte werden von unten nach oben gestapelt.
 * Im Rack-Builder kann der User Höhe/Position danach frei nachjustieren.
 */
export interface RackChildInput {
  /** Fertig aufgebautes Kind-Template (z. B. via buildImportedBaseTemplate). */
  template: EquipmentTemplate
  /** Rentman-Equipment-ID dieses Inhalts. */
  rentmanId: string
}

export const buildRackPresetFromCombination = (
  name: string,
  combinationRentmanId: string,
  children: RackChildInput[],
): GroupPreset => {
  let unit = 1
  const items: GroupPreset['items'] = []
  const placements: NonNullable<GroupPreset['rack']>['placements'] = []

  children.forEach((child, index) => {
    const he = Math.max(1, Math.round(child.template.rackUnits ?? 1))
    items.push({
      ...child.template,
      // Rack-Inhalte sind per Definition Rack-Geräte.
      isRackDevice: true,
      rackUnits: he,
      rentmanId: child.rentmanId,
      offsetX: 0,
      offsetY: (unit - 1) * 44,
    })
    placements.push({ itemIndex: index, startUnit: unit, heightUnits: he })
    unit += he
  })

  const totalUnits = Math.max(1, unit - 1)

  return {
    id: uuidv4(),
    name: name.trim() || 'Rentman Rack',
    rack: {
      totalUnits,
      rentmanId: combinationRentmanId,
      placements,
    },
    items,
    cables: [],
  }
}
