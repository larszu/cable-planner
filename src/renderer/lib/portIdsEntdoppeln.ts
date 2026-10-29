import { v4 as uuidv4 } from 'uuid'
import type { CablePlannerProject } from '../types/project'
import type { EquipmentItem } from '../types/equipment'

/**
 * Port-Ids muessen projektweit eindeutig sein.
 *
 * Bis v9.7.0 behielt `addEquipment` die Port-Ids der Bibliotheksvorlage —
 * jedes zweite Exemplar desselben Geraets trug dieselben Ids wie das erste.
 * React Flow fuehrt Handles nach Id; mit Doppelgaengern landete das
 * Ziehen eines Exemplars im Zustand des anderen, und das Geraet sprang
 * nach dem Loslassen zurueck.
 *
 * Die Kabel zeigen auf (Geraet, Port) — darum laesst sich das reparieren:
 * das erste Geraet behaelt seine Ids, jedes weitere bekommt neue, und Kabel
 * sowie `plannedCrosspoints` dieses Geraets ziehen mit.
 */
export const entdoppelePortIds = (project: CablePlannerProject): CablePlannerProject => {
  const gesehen = new Set<string>()
  // Geraete-Id -> (alte Port-Id -> neue Port-Id)
  const umbenannt = new Map<string, Map<string, string>>()

  const equipment = project.equipment.map((eq): EquipmentItem => {
    let map: Map<string, string> | undefined
    const neu = <P extends { id: string }>(p: P): P => {
      if (!p.id || !gesehen.has(p.id)) {
        if (p.id) gesehen.add(p.id)
        return p
      }
      map ??= new Map()
      const id = uuidv4()
      map.set(p.id, id)
      gesehen.add(id)
      return { ...p, id }
    }
    const inputs = (eq.inputs ?? []).map(neu)
    const outputs = (eq.outputs ?? []).map(neu)
    if (!map) return eq
    umbenannt.set(eq.id, map)
    const m = map
    const kp = eq.plannedCrosspoints
    return {
      ...eq,
      inputs,
      outputs,
      ...(kp
        ? {
            plannedCrosspoints: Object.fromEntries(
              Object.entries(kp).map(([aus, ein]) => [m.get(aus) ?? aus, m.get(ein) ?? ein]),
            ),
          }
        : {}),
    }
  })

  if (umbenannt.size === 0) return project
  const ziel = (eqId: string, portId: string): string => umbenannt.get(eqId)?.get(portId) ?? portId
  return {
    ...project,
    equipment,
    cables: project.cables.map((c) => {
      const fromPortId = ziel(c.fromEquipmentId, c.fromPortId)
      const toPortId = ziel(c.toEquipmentId, c.toPortId)
      return fromPortId === c.fromPortId && toPortId === c.toPortId ? c : { ...c, fromPortId, toPortId }
    }),
  }
}
