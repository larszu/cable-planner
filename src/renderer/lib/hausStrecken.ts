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
