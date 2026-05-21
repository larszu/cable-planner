import type { Port } from '../types/equipment'

/**
 * v7.9.130 / Issue #251 — Effektive Anzeige-Nummer eines Ports.
 *
 * Standard ist `arrayIndex + 1` (1-basiert wie der User es liest).
 * Wenn der User in den Properties einen `portNumber`-Override gesetzt
 * hat, gewinnt der. Damit kann z.B. bei einem Patchpanel der Slot 3
 * geloescht werden, ohne dass die uebrigen ihre Bezifferung verlieren —
 * Port an Index 2 behaelt Anzeige-Nummer 4 wenn 3 weg ist.
 *
 * Achtung: das hat KEINE Auswirkung auf Wire-Protokolle (Videohub,
 * ATEM). Die sprechen weiter ueber den Array-Index. `portNumber` ist
 * rein fuer die UI-Darstellung + Beschriftungen.
 */
export const effectivePortNumber = (port: Port, arrayIndex: number): number => {
  if (typeof port.portNumber === 'number' && port.portNumber > 0) {
    return port.portNumber
  }
  return arrayIndex + 1
}

/**
 * Pruefe ob in einer Port-Liste doppelte Anzeige-Nummern vorkommen.
 * Wird in der UI als Warnung angezeigt damit der User nicht versehentlich
 * zwei Ports mit gleicher Nummer hat — verwirrt die Geraete-Beschriftung.
 */
export const findDuplicatePortNumbers = (ports: Port[]): number[] => {
  const seen = new Map<number, number>()
  const duplicates = new Set<number>()
  ports.forEach((p, idx) => {
    const n = effectivePortNumber(p, idx)
    if (seen.has(n)) duplicates.add(n)
    else seen.set(n, idx)
  })
  return Array.from(duplicates).sort((a, b) => a - b)
}
