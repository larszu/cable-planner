// ───────────────────────────────────────────────────────────────────────────
// #911 — die Etagen des Projekts: Liste, Heilung, Zuordnung.
//
// Die Rahmen tragen den Etagen-NAMEN (`LocationFrame.floor`), die Liste in
// `project.floors` Reihenfolge und Hoehe. Warum der Name und keine Id: siehe
// `Floor` in types/location.ts.
//
// REIN: kein Store, keine Uhr.
// ───────────────────────────────────────────────────────────────────────────
import type { Floor, LocationFrame } from '../types/location'

/** Vergleichsschluessel: „1.OG" und „ 1.og " sind dieselbe Etage. */
export const etagenSchluessel = (name: string): string => name.trim().toLowerCase()

/**
 * Die Etagenliste, wie sie gelten soll: ungueltige und doppelte Eintraege
 * fallen (der erste gewinnt), und jede Etage, die ein Rahmen nennt, die
 * Liste aber nicht, wird hinten angehaengt — in der Reihenfolge ihres ersten
 * Auftretens. So wird ein altes Projekt mit Freitext-Etagen beim Laden zur
 * Liste, ohne dass ein Rahmen seine Angabe verliert.
 *
 * Idempotent: zweimal geheilt ist einmal geheilt.
 */
export function heileEtagen(floors: unknown, locations: readonly Pick<LocationFrame, 'floor'>[]): Floor[] {
  const aus: Floor[] = []
  const gesehen = new Set<string>()
  if (Array.isArray(floors)) {
    for (const roh of floors) {
      if (!roh || typeof roh !== 'object') continue
      const f = roh as Partial<Floor>
      if (typeof f.name !== 'string' || !f.name.trim()) continue
      const key = etagenSchluessel(f.name)
      if (gesehen.has(key)) continue
      gesehen.add(key)
      const e: Floor = { name: f.name.trim() }
      if (typeof f.elevationM === 'number' && Number.isFinite(f.elevationM)) e.elevationM = f.elevationM
      aus.push(e)
    }
  }
  for (const loc of locations) {
    const name = loc.floor?.trim()
    if (!name) continue
    const key = etagenSchluessel(name)
    if (gesehen.has(key)) continue
    gesehen.add(key)
    aus.push({ name })
  }
  return aus
}

/** Die Etage eines Rahmens aus der Liste, oder undefined (keine Angabe). */
export function etageVon(loc: Pick<LocationFrame, 'floor'> | undefined, floors: readonly Floor[]): Floor | undefined {
  const name = loc?.floor?.trim()
  if (!name) return undefined
  const key = etagenSchluessel(name)
  return floors.find((f) => etagenSchluessel(f.name) === key) ?? { name }
}

/** Position einer Etage in der Liste (0 = unterste), -1 wenn sie nicht darin steht. */
export function etagenIndex(name: string | undefined, floors: readonly Floor[]): number {
  if (!name?.trim()) return -1
  const key = etagenSchluessel(name)
  return floors.findIndex((f) => etagenSchluessel(f.name) === key)
}

/** Wie viele Rahmen auf dieser Etage liegen. */
export function rahmenAufEtage(name: string, locations: readonly Pick<LocationFrame, 'floor'>[]): number {
  const key = etagenSchluessel(name)
  return locations.filter((l) => l.floor?.trim() && etagenSchluessel(l.floor) === key).length
}
