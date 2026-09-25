// ───────────────────────────────────────────────────────────────────────────
// facility#15 — welche Kabel des Plans welche Hausstrecke und Ader belegen.
//
// Der Plan erklaert am Kabel (`hausStreckeId`, `hausAder`), welche feste
// Leitung des Hauses es benutzt — dieselbe Form wie `hausPunktId` am Geraet.
// Die Strecke selbst (Raeume, Blenden, Adern) steht in der Auskunft des
// Hauses und wird hier nur NACHGESCHLAGEN, nicht abgeschrieben.
//
// REIN: kein Store.
// ───────────────────────────────────────────────────────────────────────────
import type { Cable } from '../types/cable'
import type { HausAuskunft, HausStrecke, HausStreckenAder } from '../types/hausAuskunft'
import type { CablePlannerProject } from '../types/project'
import type { CsvCell, CsvTable } from './csv'

export interface AderBelegung {
  ader: HausStreckenAder
  /** Kabel-Ids des Plans auf dieser Ader. Mehr als eines ist ein Konflikt. */
  kabel: string[]
}

export interface StreckenBelegung {
  strecke: HausStrecke
  adern: AderBelegung[]
  /** Kabel, die die Strecke ohne Ader-Angabe benutzen. */
  ohneAder: string[]
  /** Kabel, die eine Ader nennen, die die Strecke laut Haus nicht hat. */
  unbekannteAder: Array<{ kabelId: string; ader: string }>
}

export const hausStrecke = (a: HausAuskunft | undefined, id: string | undefined): HausStrecke | undefined =>
  a && id ? a.strecken.find((s) => s.id === id) : undefined

export function streckenBelegung(
  auskunft: HausAuskunft | undefined,
  cables: readonly Pick<Cable, 'id' | 'hausStreckeId' | 'hausAder'>[],
  streckeId: string,
): StreckenBelegung | undefined {
  const strecke = hausStrecke(auskunft, streckeId)
  if (!strecke) return undefined
  const adern: AderBelegung[] = (strecke.adern ?? []).map((ader) => ({ ader, kabel: [] }))
  const byNr = new Map(adern.map((a) => [a.ader.nr, a]))
  const ohneAder: string[] = []
  const unbekannteAder: StreckenBelegung['unbekannteAder'] = []
  for (const c of cables) {
    if (c.hausStreckeId !== streckeId) continue
    const nr = c.hausAder?.trim()
    if (!nr) {
      ohneAder.push(c.id)
      continue
    }
    const belegung = byNr.get(nr)
    if (belegung) belegung.kabel.push(c.id)
    else unbekannteAder.push({ kabelId: c.id, ader: nr })
  }
  return { strecke, adern, ohneAder, unbekannteAder }
}

/** „Halle 3 (B2) → Regie (W-12)" — Raeume laut Haus, Blenden in Klammern. */
export function streckenWeg(a: HausAuskunft | undefined, s: HausStrecke): string {
  const raum = (id: string | undefined) => (id ? a?.raeume.find((r) => r.id === id) : undefined)
  const seite = (raumId: string | undefined, blende: string | undefined) => {
    const r = raum(raumId)
    const name = r ? (r.etage ? `${r.etage} · ${r.name}` : r.name) : raumId ?? '?'
    return blende ? `${name} (${blende})` : name
  }
  return `${seite(s.vonRaumId, s.vonBlende)} → ${seite(s.nachRaumId, s.nachBlende)}`
}

/**
 * Die Belegung aller Hausstrecken als Blatt: je Ader eine Zeile, dazu die
 * Kabel, die eine Strecke ohne Ader oder mit einer unbekannten Ader nennen.
 *
 * Der Inspector zeigt die Belegung je Kabel; die Haustechnik braucht sie je
 * Strecke — welche Ader frei ist, bevor jemand eine vierte Kamera anschliesst.
 * Kanonisches Deutsch in den Kopfzeilen, weil das Blatt gestempelt wird.
 */
export function hausStreckenTable(
  project: Pick<CablePlannerProject, 'hausAuskunft' | 'cables'>,
): CsvTable {
  const headers = ['Strecke', 'Weg', 'Ader', 'Stecker', 'Signal', 'Belegt durch', 'Befund']
  const rows: CsvCell[][] = []
  const auskunft = project.hausAuskunft
  const name = (id: string) => {
    const c = project.cables.find((x) => x.id === id)
    return c ? c.cableNumber || c.name || id : id
  }
  for (const s of auskunft?.strecken ?? []) {
    const b = streckenBelegung(auskunft, project.cables, s.id)
    if (!b) continue
    const weg = streckenWeg(auskunft, s)
    for (const a of b.adern) {
      rows.push([
        s.bezeichnung,
        weg,
        a.ader.nr,
        a.ader.stecker ?? '',
        a.ader.signal ?? '',
        a.kabel.map(name).join(', '),
        a.kabel.length === 0 ? 'frei' : a.kabel.length > 1 ? 'mehrfach belegt' : '',
      ])
    }
    for (const id of b.ohneAder) rows.push([s.bezeichnung, weg, '', '', '', name(id), 'ohne Ader'])
    for (const u of b.unbekannteAder) {
      rows.push([s.bezeichnung, weg, u.ader, '', '', name(u.kabelId), 'Ader laut Haus unbekannt'])
    }
  }
  const bekannt = new Set((auskunft?.strecken ?? []).map((s) => s.id))
  for (const c of project.cables) {
    if (c.hausStreckeId && !bekannt.has(c.hausStreckeId)) {
      rows.push([c.hausStreckeId, '', c.hausAder ?? '', '', '', c.cableNumber || c.name, 'Strecke nicht mehr in der Auskunft'])
    }
  }
  return { headers, rows }
}
