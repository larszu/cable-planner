import type { EquipmentItem } from '../types/equipment'
import type { LocationFrame } from '../types/location'

/**
 * #292 — Liefert den Namen der Location, in deren Box der Center-Punkt
 * des Geraets liegt. Verwendet die gleiche Center-Punkt-Heuristik wie
 * projectStore.ts beim Group-Drag (`x + width/2`, `y + height/2`).
 *
 * Wenn das Geraet in keiner Location oder in mehreren liegt, wird der
 * Name der ERSTEN passenden zurueckgegeben. `undefined` wenn keine
 * Location passt — der Caller faellt dann auf den Geraete-Namen alleine
 * zurueck ("Cam1" statt "Cam1@Bühne").
 */
export const locationNameForEquipment = (
  equipment: Pick<EquipmentItem, 'x' | 'y' | 'width' | 'height'>,
  locations: readonly LocationFrame[],
): string | undefined => {
  if (!locations.length) return undefined
  const cx = equipment.x + (equipment.width ?? 0) / 2
  const cy = equipment.y + (equipment.height ?? 0) / 2
  for (const loc of locations) {
    if (
      cx >= loc.x &&
      cx <= loc.x + loc.width &&
      cy >= loc.y &&
      cy <= loc.y + loc.height
    ) {
      return loc.name
    }
  }
  return undefined
}

/**
 * #292 — Praktischer "Device@Location"-Formatter. Wenn der Equipment-
 * Name leer ist, wird `?` als Platzhalter verwendet. Wenn keine Location
 * passt, wird nur der Geraete-Name zurueckgegeben.
 */
export const formatDeviceAtLocation = (
  equipmentName: string | undefined,
  locationName: string | undefined,
): string => {
  const name = equipmentName?.trim() || '?'
  if (!locationName) return name
  return `${name}@${locationName}`
}
