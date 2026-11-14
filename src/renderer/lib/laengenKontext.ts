import type { CablePlannerProject } from '../types/project'
import type { LaengenKontext } from './cableLengthEstimate'
import { computeEquipmentLayout } from './equipmentLayout'
import { gebaeudeSzene, STANDARD_GESCHOSSHOEHE_M, type GebaeudeSzene } from './gebaeudeSzene'

/** Buchsen-Lage und Hallenplan fuer die Laengenrechnung — mit derselben
 *  Geraete-Geometrie, die der Canvas zeichnet und der A*-Router benutzt.
 *
 *  #1190 — mit Geraeten, Kabeln, Rahmen und Etagen kommt die Fuehrung im
 *  Raum dazu: dieselbe Szene, die der 3D-Plan zeichnet, mit der Standard-
 *  Geschosshoehe fuer Etagen ohne Hoehe. Gebaut wird sie erst, wenn ein Kabel
 *  eine Fuehrung hat, und je Massstab nur einmal. */
export const laengenKontext = (
  project: Pick<CablePlannerProject, 'grundriss' | 'intercom'> &
    Partial<Pick<CablePlannerProject, 'equipment' | 'cables' | 'locations' | 'floors'>>,
): LaengenKontext => {
  const szenen = new Map<number, GebaeudeSzene>()
  const { equipment, cables } = project
  return {
    grundriss: project.grundriss,
    buchse: (eq, portId, richtung) => {
      const p = computeEquipmentLayout(eq, project.intercom).portPos(portId, richtung)
      return p ? { x: p.x, y: p.y } : null
    },
    ...(equipment && cables
      ? {
          fuehrungM: (cable, metersPer100px) => {
            let szene = szenen.get(metersPer100px)
            if (!szene) {
              szene = gebaeudeSzene(
                {
                  equipment,
                  cables: cables.filter((c) => c.fuehrung3d?.length),
                  locations: project.locations ?? [],
                  floors: project.floors ?? [],
                },
                { metersPer100px, geschosshoeheM: STANDARD_GESCHOSSHOEHE_M },
              )
              szenen.set(metersPer100px, szene)
            }
            const k = szene.kabel.find((x) => x.id === cable.id)
            return k?.gefuehrt ? k.laengeM : null
          },
        }
      : {}),
  }
}
