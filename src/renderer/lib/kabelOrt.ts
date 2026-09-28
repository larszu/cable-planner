// ───────────────────────────────────────────────────────────────────────────
// #912 — wo ein Kabelende sitzt: Etage · Raum · Geraet · Port.
//
// Fuer Messehallen und Festinstallation („Video in die 3. Etage") reichte
// „Videohub SDI 12" nicht: wer das Kabel zieht, braucht das Stockwerk und den
// Raum dazu, und der stand nur im Canvas.
//
// ABGELEITET, NICHT GESPEICHERT (ADR-001): der Raum ist der Rahmen, in dem
// das Geraet liegt (`locationForEquipment`), die Etage die des Rahmens. Ein
// gespeichertes Feld daneben waere eine zweite Wahrheit, die beim ersten
// Verschieben nicht mehr stimmt.
//
// REIN: kein Store.
// ───────────────────────────────────────────────────────────────────────────
import type { Cable } from '../types/cable'
import type { EquipmentItem } from '../types/equipment'
import type { Floor, LocationFrame } from '../types/location'
import { locationForEquipment } from './equipmentLocation'
import { etageVon } from './etagen'
import { portDisplayLabel } from './portLabel'

export interface EndeOrt {
  /** Etagen-Name; fehlt, wenn der Rahmen keine hat oder das Geraet in keinem liegt. */
  etage?: string
  /** Rahmen-Name; fehlt, wenn das Geraet in keinem Rahmen liegt. */
  raum?: string
  /** Id dieses Rahmens — der Name ist nicht eindeutig. */
  raumId?: string
  geraet: string
  port: string
  equipmentId: string
}

export interface OrtsKontext {
  equipment: readonly EquipmentItem[]
  locations: readonly LocationFrame[]
  floors: readonly Floor[]
}

/** Etage und Raum eines Geraets — beides optional. */
export function ortVonGeraet(
  e: Pick<EquipmentItem, 'x' | 'y' | 'width' | 'height'> | undefined,
  locations: readonly LocationFrame[],
  floors: readonly Floor[],
): { etage?: string; raum?: string; raumId?: string } {
  if (!e) return {}
  const loc = locationForEquipment(e, locations)
  if (!loc) return {}
  const etage = etageVon(loc, floors)?.name
  return etage ? { etage, raum: loc.name, raumId: loc.id } : { raum: loc.name, raumId: loc.id }
}

const ende = (equipmentId: string, portId: string, ctx: OrtsKontext, byId: Map<string, EquipmentItem>): EndeOrt => {
  const e = byId.get(equipmentId)
  const port = e ? [...e.outputs, ...e.inputs].find((p) => p.id === portId) : undefined
  return {
    ...ortVonGeraet(e, ctx.locations, ctx.floors),
    geraet: e?.name ?? '?',
    port: (port && portDisplayLabel(port)) || portId,
    equipmentId,
  }
}

/** Beide Enden eines Kabels mit Ort. */
export function kabelEnden(
  cable: Pick<Cable, 'fromEquipmentId' | 'fromPortId' | 'toEquipmentId' | 'toPortId'>,
  ctx: OrtsKontext,
): { von: EndeOrt; nach: EndeOrt } {
  const byId = new Map(ctx.equipment.map((e) => [e.id, e]))
  return {
    von: ende(cable.fromEquipmentId, cable.fromPortId, ctx, byId),
    nach: ende(cable.toEquipmentId, cable.toPortId, ctx, byId),
  }
}

/** „2.OG · Regie · Videohub · SDI 12" — fehlende Teile fallen weg, statt „?" zu zeigen. */
export const endeText = (o: EndeOrt): string =>
  [o.etage, o.raum, o.geraet, o.port].filter((x): x is string => !!x && x.trim() !== '').join(' · ')

/** Nur der Ort-Teil („2.OG · Regie"), oder ''. */
export const ortText = (o: Pick<EndeOrt, 'etage' | 'raum'>): string =>
  [o.etage, o.raum].filter((x): x is string => !!x && x.trim() !== '').join(' · ')
