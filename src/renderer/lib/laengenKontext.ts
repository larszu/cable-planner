import type { CablePlannerProject } from '../types/project'
import type { LaengenKontext } from './cableLengthEstimate'
import { computeEquipmentLayout } from './equipmentLayout'

/** Buchsen-Lage und Hallenplan fuer die Laengenrechnung — mit derselben
 *  Geraete-Geometrie, die der Canvas zeichnet und der A*-Router benutzt. */
export const laengenKontext = (
  project: Pick<CablePlannerProject, 'grundriss' | 'intercom'>,
): LaengenKontext => ({
  grundriss: project.grundriss,
  buchse: (eq, portId, richtung) => {
    const p = computeEquipmentLayout(eq, project.intercom).portPos(portId, richtung)
    return p ? { x: p.x, y: p.y } : null
  },
})
