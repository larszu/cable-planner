// ───────────────────────────────────────────────────────────────────────────
// #1180 — Kabelausstattung: was um das Kabel herum sitzt, und wo.
//
// Geflechtschlauch, Wellrohr, Gewebeband, Schrumpfschlauch — je Abschnitt
// des Kabels, mit Anfang und Laenge in Metern ab Ende A. Das ist die
// Bauanleitung fuer Peitschen und Kamerazoepfe („wo faengt das Geflecht
// an?") und im Verleih die Antwort auf „was war an dem Zopf dran".
//
// Fehlt die Laenge, reicht der Abschnitt bis zum Ende des Kabels; fehlt der
// Anfang, beginnt er bei A. Ohne Kabellaenge laesst sich ein offener
// Abschnitt nicht messen und zaehlt in der Stueckliste nur als Stueck.
//
// REIN: keine Uhr, kein Store, kein IO.
// ───────────────────────────────────────────────────────────────────────────
import type { AusstattungsArt, Cable, KabelAusstattung } from '../types/cable'

export const AUSSTATTUNGS_ARTEN: AusstattungsArt[] = ['braid', 'conduit', 'tape', 'shrink']

export interface AbschnittMeter {
  vonM: number
  /** undefined: Ende unbekannt (keine Kabellaenge). */
  bisM?: number
}

/** Anfang und Ende eines Abschnitts in Metern ab Ende A, begrenzt aufs Kabel. */
export const abschnittMeter = (a: KabelAusstattung, kabelLaengeM: number | undefined): AbschnittMeter => {
  const von = Math.max(0, a.vonM ?? 0)
  const L = kabelLaengeM && kabelLaengeM > 0 ? kabelLaengeM : undefined
  let bis = a.laengeM !== undefined && a.laengeM > 0 ? von + a.laengeM : L
  if (bis !== undefined && L !== undefined) bis = Math.min(bis, L)
  const vonBegrenzt = L !== undefined ? Math.min(von, L) : von
  return bis === undefined ? { vonM: vonBegrenzt } : { vonM: vonBegrenzt, bisM: Math.max(vonBegrenzt, bis) }
}

/** Laenge eines Abschnitts in m, oder undefined, wenn sie nicht bestimmbar ist. */
export const abschnittLaenge = (a: KabelAusstattung, kabelLaengeM: number | undefined): number | undefined => {
  const m = abschnittMeter(a, kabelLaengeM)
  return m.bisM === undefined ? undefined : Math.round((m.bisM - m.vonM) * 100) / 100
}

export interface AusstattungsZeile {
  art: AusstattungsArt
  /** Freitext: Produkt/Durchmesser, z. B. „Geflecht 10 mm". Leer = ohne Angabe. */
  material: string
  stueck: number
  /** Summe der bestimmbaren Laengen, m. */
  laengeM: number
  /** Stuecke ohne bestimmbare Laenge. */
  ohneLaenge: number
}

/** Stueckliste der Ausstattung: je Art und Material, Laengen summiert. */
export const ausstattungsStueckliste = (cables: Pick<Cable, 'ausstattung' | 'length'>[]): AusstattungsZeile[] => {
  const map = new Map<string, AusstattungsZeile>()
  for (const c of cables) {
    for (const a of c.ausstattung ?? []) {
      const material = a.material?.trim() ?? ''
      const key = `${a.art}|${material}`
      const z = map.get(key) ?? { art: a.art, material, stueck: 0, laengeM: 0, ohneLaenge: 0 }
      z.stueck += 1
      const l = abschnittLaenge(a, c.length)
      if (l === undefined) z.ohneLaenge += 1
      else z.laengeM = Math.round((z.laengeM + l) * 100) / 100
      map.set(key, z)
    }
  }
  return [...map.values()].sort(
    (a, b) => AUSSTATTUNGS_ARTEN.indexOf(a.art) - AUSSTATTUNGS_ARTEN.indexOf(b.art) || a.material.localeCompare(b.material),
  )
}

/**
 * Strichmuster fuer die Zeichnung: der Abschnitt als Anteil der Pfadlaenge.
 * Mit `pathLength = 1` am SVG-Pfad wird daraus ein `strokeDasharray`, das
 * genau den Abschnitt zeigt. Ohne bestimmbare Laenge: das ganze Kabel.
 */
export const abschnittDash = (a: KabelAusstattung, kabelLaengeM: number | undefined): { dasharray: string; offset: number } => {
  const L = kabelLaengeM && kabelLaengeM > 0 ? kabelLaengeM : undefined
  const m = abschnittMeter(a, L)
  if (L === undefined || m.bisM === undefined) {
    return { dasharray: '1 0', offset: 0 }
  }
  const von = m.vonM / L
  const len = (m.bisM - m.vonM) / L
  return { dasharray: `${len.toFixed(4)} ${(1 - len + 0.0001).toFixed(4)}`, offset: -von }
}
