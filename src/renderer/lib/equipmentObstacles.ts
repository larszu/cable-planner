import type { EquipmentItem } from '../types/equipment'
import type { IntercomPlan } from '../types/intercomPlan'
import type { Rect } from './cableRouting'
import { computeEquipmentLayout } from './equipmentLayout'
import type { Raster } from './raster'

export interface EquipmentObstacles {
  obstacles: Rect[]
  obstacleIds: string[]
}

// Die Hindernisse aller Geraete, EINMAL je Stand von Geraeten, Intercom und
// Raster. Vorher baute jede Kante bei jedem Rendern dieselbe Liste aus allen
// Geraeten neu — bei 500 Kabeln und 300 Geraeten 150.000 Layout-Rechnungen
// je Renderdurchgang. Die Projekt-Arrays sind unveraenderlich, die Referenz
// ist also ein sicherer Schluessel; das Raster ist ein frisch gebautes Objekt
// und wird ueber seinen Inhalt verglichen.
let letzter:
  | { equipment: readonly EquipmentItem[]; intercom: IntercomPlan | undefined; raster: string; wert: EquipmentObstacles }
  | undefined

export const equipmentObstacles = (
  equipment: readonly EquipmentItem[],
  intercom: IntercomPlan | undefined,
  raster: Raster,
): EquipmentObstacles => {
  const rasterKey = JSON.stringify(raster)
  if (letzter && letzter.equipment === equipment && letzter.intercom === intercom && letzter.raster === rasterKey) {
    return letzter.wert
  }
  const obstacles: Rect[] = []
  const obstacleIds: string[] = []
  for (const item of equipment) {
    const { width, height } = computeEquipmentLayout(item, intercom, raster)
    obstacles.push({ x: item.x, y: item.y, width, height })
    obstacleIds.push(item.id)
  }
  const wert = { obstacles, obstacleIds }
  letzter = { equipment, intercom, raster: rasterKey, wert }
  return wert
}
