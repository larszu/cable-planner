// Massstab eines Hallenplans: Canvas-Pixel → Meter auf dem Boden.
//
// Planer-uebergreifend gedacht wie `venueExchange.ts`: rein, ohne Store und
// ohne DOM, damit multicam- und light-planner dieselbe Datei uebernehmen
// koennen. Die Zwei-Punkt-Form ist die Rechnung aus multicam `Venue2D`
// (Strecke bekannter Laenge → Meter je Pixel); die Vier-Punkt-Form ist neu.
//
// WARUM EINE HOMOGRAPHIE. Ein Foto eines Plans, ein schraeg aufgenommenes
// Schild oder eine isometrische Zeichnung bildet den Boden nicht mit einem
// Massstab ab: parallele Kanten laufen zusammen, eine Achse ist gestaucht.
// Die Abbildung einer Ebene auf eine Ebene unter Zentralprojektion ist
// genau eine Homographie (8 Freiheitsgrade), und vier Punkte mit bekannter
// Lage legen sie fest. Gerade Linien bleiben dabei gerade — deshalb ist die
// Laenge eines Kabelstuecks der Abstand seiner beiden abgebildeten
// Endpunkte, ohne Naeherung.

import type { PlanKalibrierung, PlanPunkt } from '../../types/grundriss'

export type Homographie = [number, number, number, number, number, number, number, number, number]

/** Loest A·x = b (n×n) mit Pivotsuche. `null`, wenn A singulaer ist. */
const loese = (A: number[][], b: number[]): number[] | null => {
  const n = b.length
  const M = A.map((zeile, i) => [...zeile, b[i]])
  for (let s = 0; s < n; s++) {
    let p = s
    for (let z = s + 1; z < n; z++) if (Math.abs(M[z][s]) > Math.abs(M[p][s])) p = z
    if (Math.abs(M[p][s]) < 1e-12) return null
    ;[M[s], M[p]] = [M[p], M[s]]
    for (let z = 0; z < n; z++) {
      if (z === s) continue
      const f = M[z][s] / M[s][s]
      for (let k = s; k <= n; k++) M[z][k] -= f * M[s][k]
    }
  }
  return M.map((zeile, i) => zeile[n] / zeile[i])
}

/** Homographie, die `von[i]` auf `nach[i]` abbildet (je vier Punkte). */
export const homographie = (von: PlanPunkt[], nach: PlanPunkt[]): Homographie | null => {
  if (von.length !== 4 || nach.length !== 4) return null
  const A: number[][] = []
  const b: number[] = []
  for (let i = 0; i < 4; i++) {
    const { x, y } = von[i]
    const { x: u, y: v } = nach[i]
    A.push([x, y, 1, 0, 0, 0, -u * x, -u * y])
    b.push(u)
    A.push([0, 0, 0, x, y, 1, -v * x, -v * y])
    b.push(v)
  }
  const h = loese(A, b)
  return h ? ([...h, 1] as Homographie) : null
}

/** Bildet einen Punkt ab. `null` hinter dem Horizont (w ≤ 0): dort liegt
 *  auf dem Foto kein Boden mehr, und eine Zahl waere erfunden. */
export const abbilden = (h: Homographie, p: PlanPunkt): PlanPunkt | null => {
  const w = h[6] * p.x + h[7] * p.y + h[8]
  if (!(w > 1e-12)) return null
  return { x: (h[0] * p.x + h[1] * p.y + h[2]) / w, y: (h[3] * p.x + h[4] * p.y + h[5]) / w }
}

/** Die vier Ecken bilden ein echtes Viereck: konvex, ohne Kreuzung, mit
 *  Flaeche. Ein „Z" aus vertauschten Ecken ergaebe ebenfalls eine
 *  Homographie — eine, die den Plan umklappt. */
export const eckenGueltig = (e: PlanPunkt[]): boolean => {
  if (e.length !== 4) return false
  let vorzeichen = 0
  for (let i = 0; i < 4; i++) {
    const a = e[i]
    const b = e[(i + 1) % 4]
    const c = e[(i + 2) % 4]
    const kreuz = (b.x - a.x) * (c.y - b.y) - (b.y - a.y) * (c.x - b.x)
    if (Math.abs(kreuz) < 1) return false
    const s = Math.sign(kreuz)
    if (vorzeichen === 0) vorzeichen = s
    else if (s !== vorzeichen) return false
  }
  return true
}

/**
 * Canvas-Punkt → Bodenpunkt in Metern. `null`, wenn die Kalibrierung nicht
 * rechenbar ist (Strecke null lang, Ecken entartet) oder der Punkt hinter
 * dem Horizont liegt.
 */
export const meterAbbildung = (k: PlanKalibrierung): ((p: PlanPunkt) => PlanPunkt | null) | null => {
  if (k.art === 'zweiPunkt') {
    const px = Math.hypot(k.b.x - k.a.x, k.b.y - k.a.y)
    if (px < 1 || !(k.meter > 0)) return null
    const s = k.meter / px
    return (p) => ({ x: p.x * s, y: p.y * s })
  }
  if (!eckenGueltig(k.ecken) || !(k.breiteM > 0) || !(k.tiefeM > 0)) return null
  const h = homographie(k.ecken, [
    { x: 0, y: 0 },
    { x: k.breiteM, y: 0 },
    { x: k.breiteM, y: k.tiefeM },
    { x: 0, y: k.tiefeM },
  ])
  return h ? (p) => abbilden(h, p) : null
}

/** Meter je Canvas-Pixel — nur die Zwei-Punkt-Form hat EINE solche Zahl. */
export const meterJePixel = (k: PlanKalibrierung): number | null => {
  if (k.art !== 'zweiPunkt') return null
  const px = Math.hypot(k.b.x - k.a.x, k.b.y - k.a.y)
  return px >= 1 && k.meter > 0 ? k.meter / px : null
}

/** Laenge eines Streckenzugs in Metern; `null`, sobald ein Punkt nicht
 *  abbildbar ist. */
export const wegLaengeM = (
  abbildung: (p: PlanPunkt) => PlanPunkt | null,
  punkte: PlanPunkt[],
): number | null => {
  let summe = 0
  let vorher: PlanPunkt | null = null
  for (const p of punkte) {
    const m = abbildung(p)
    if (!m) return null
    if (vorher) summe += Math.hypot(m.x - vorher.x, m.y - vorher.y)
    vorher = m
  }
  return summe
}

/**
 * Die Kalibrierung mit dem Plan mitfuehren, wenn er verschoben oder
 * skaliert wird. `alt`/`neu` sind Lage und Groesse vor und nach der
 * Aenderung.
 */
export const kalibrierungMitfuehren = (
  k: PlanKalibrierung,
  alt: { x: number; y: number; width: number; height: number },
  neu: { x: number; y: number; width: number; height: number },
): PlanKalibrierung => {
  const sx = alt.width > 0 ? neu.width / alt.width : 1
  const sy = alt.height > 0 ? neu.height / alt.height : 1
  const f = (p: PlanPunkt): PlanPunkt => ({ x: neu.x + (p.x - alt.x) * sx, y: neu.y + (p.y - alt.y) * sy })
  if (k.art === 'zweiPunkt') return { ...k, a: f(k.a), b: f(k.b) }
  return { ...k, ecken: k.ecken.map(f) as [PlanPunkt, PlanPunkt, PlanPunkt, PlanPunkt] }
}
