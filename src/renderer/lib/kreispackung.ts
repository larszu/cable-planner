// ───────────────────────────────────────────────────────────────────────────
// #1178 — Kreispackung fuer den Buendelquerschnitt.
//
// Frage auf der Baustelle: „Passt das noch durch das Rohr?" Dafuer braucht es
// den Durchmesser des Buendels, also die kleinste Huelle um die dicht
// gepackten Kabelkreise. Exakt ist das ein schweres Problem; fuer die
// Kabelzahlen einer Trasse reicht eine gierige Packung, die jeden Kreis an
// zwei bereits gelegte anlegt und die Stelle nimmt, die die Huelle am
// wenigsten wachsen laesst. Fuer gleiche Kreise trifft sie die bekannten
// Optima bei 1, 2, 3, 6, 7 und 19 Kreisen; dazwischen liegt sie darueber
// (4 gleiche: 2,73 r statt 2,41 r). Das ist die sichere Seite: der Plan
// warnt eher zu frueh als zu spaet. Der Fuellgrad haengt ohnehin nicht an
// der Packung.
//
// Der FUELLGRAD dagegen haengt nicht an der Packung: Summe der Kabelflaechen
// durch die lichte Flaeche des Rohrs. Grenzwerte nach NFPA 70 (NEC),
// Chapter 9, Table 1: ein Leiter 53 %, zwei Leiter 31 %, mehr als zwei 40 %.
//
// REIN: keine Uhr, kein Store, kein IO.
// ───────────────────────────────────────────────────────────────────────────

export interface Kreis {
  x: number
  y: number
  r: number
}

export interface Packung {
  kreise: Kreis[]
  /** Huellkreis um alle Kreise. */
  huelle: Kreis
}

const EPS = 1e-9

const ueberlappt = (a: Kreis, b: Kreis): boolean => Math.hypot(a.x - b.x, a.y - b.y) < a.r + b.r - 1e-7

/** Kleinster Kreis, der die Kreise umschliesst (iterativ, fuer kleine n genau genug). */
export const huellkreis = (kreise: Kreis[]): Kreis => {
  if (kreise.length === 0) return { x: 0, y: 0, r: 0 }
  if (kreise.length === 1) return { ...kreise[0] }
  // Startpunkt: Mittelwert; dann Schritt zum weitesten Kreis mit fallender
  // Schrittweite (Badoiu-Clarkson fuer Kreise).
  let cx = kreise.reduce((s, k) => s + k.x, 0) / kreise.length
  let cy = kreise.reduce((s, k) => s + k.y, 0) / kreise.length
  for (let i = 1; i <= 4000; i++) {
    let weit = kreise[0]
    let d = -Infinity
    for (const k of kreise) {
      const dk = Math.hypot(k.x - cx, k.y - cy) + k.r
      if (dk > d) {
        d = dk
        weit = k
      }
    }
    const dist = Math.hypot(weit.x - cx, weit.y - cy)
    if (dist < EPS) break
    // Zielpunkt: der aeusserste Punkt des weitesten Kreises
    const tx = weit.x + ((weit.x - cx) / dist) * weit.r
    const ty = weit.y + ((weit.y - cy) / dist) * weit.r
    const f = 1 / (i + 1)
    cx += (tx - cx) * f
    cy += (ty - cy) * f
  }
  const r = Math.max(...kreise.map((k) => Math.hypot(k.x - cx, k.y - cy) + k.r))
  return { x: cx, y: cy, r }
}

/** Mittelpunkte, an denen ein Kreis mit Radius r beide Kreise a, b beruehrt. */
const anlegen = (a: Kreis, b: Kreis, r: number): { x: number; y: number }[] => {
  const ra = a.r + r
  const rb = b.r + r
  const dx = b.x - a.x
  const dy = b.y - a.y
  const d = Math.hypot(dx, dy)
  if (d < EPS || d > ra + rb || d < Math.abs(ra - rb)) return []
  const l = (ra * ra - rb * rb + d * d) / (2 * d)
  const h = Math.sqrt(Math.max(0, ra * ra - l * l))
  const mx = a.x + (dx * l) / d
  const my = a.y + (dy * l) / d
  return [
    { x: mx + (-dy * h) / d, y: my + (dx * h) / d },
    { x: mx - (-dy * h) / d, y: my - (dx * h) / d },
  ]
}

/**
 * Packt Kreise der gegebenen Durchmesser dicht. Groesste zuerst; die
 * Reihenfolge der Ergebnis-Kreise folgt der Eingabe.
 */
export const packeKreise = (durchmesser: number[]): Packung => {
  const reihe = durchmesser
    .map((d, i) => ({ r: Math.max(0, d) / 2, i }))
    .sort((a, b) => b.r - a.r || a.i - b.i)
  const gelegt: (Kreis & { i: number })[] = []
  for (const { r, i } of reihe) {
    if (gelegt.length === 0) {
      gelegt.push({ x: 0, y: 0, r, i })
      continue
    }
    if (gelegt.length === 1) {
      const a = gelegt[0]
      gelegt.push({ x: a.x + a.r + r, y: a.y, r, i })
      continue
    }
    // Bewertung gegen die AKTUELLE Huelle: wie weit ragt der neue Kreis ueber
    // sie hinaus? Das kostet je Kandidat eine Rechnung statt einer ganzen
    // Huellkreis-Suche; die Huelle wird nach jedem gelegten Kreis neu bestimmt.
    const h0 = huellkreis(gelegt)
    let best: { x: number; y: number } | undefined
    let bestR = Infinity
    let bestD = Infinity
    for (let p = 0; p < gelegt.length; p++) {
      for (let q = p + 1; q < gelegt.length; q++) {
        for (const c of anlegen(gelegt[p], gelegt[q], r)) {
          const k = { ...c, r }
          if (gelegt.some((g) => ueberlappt(g, k))) continue
          const dz = Math.hypot(c.x - h0.x, c.y - h0.y)
          const h = Math.max(h0.r, dz + r)
          if (h < bestR - 1e-6 || (Math.abs(h - bestR) <= 1e-6 && dz < bestD)) {
            best = c
            bestR = h
            bestD = dz
          }
        }
      }
    }
    if (!best) {
      // kann bei r = 0 passieren; dann in die Mitte
      best = { x: gelegt[0].x, y: gelegt[0].y }
    }
    gelegt.push({ ...best, r, i })
  }
  const huelle = huellkreis(gelegt)
  const kreise = [...gelegt]
    .sort((a, b) => a.i - b.i)
    .map((k) => ({ x: k.x - huelle.x, y: k.y - huelle.y, r: k.r }))
  return { kreise, huelle: { x: 0, y: 0, r: huelle.r } }
}

/** Summe der Kreisflaechen aus Durchmessern, mm². */
export const kabelFlaeche = (durchmesser: number[]): number =>
  durchmesser.reduce((s, d) => s + (Math.PI * d * d) / 4, 0)

/** Grenzwert des Fuellgrads nach NEC Chapter 9 Table 1 (Anteil 0..1). */
export const fuellgradGrenze = (anzahl: number): number => (anzahl <= 1 ? 0.53 : anzahl === 2 ? 0.31 : 0.4)

export interface Fuellgrad {
  anteil: number
  grenze: number
  passt: boolean
}

/** Fuellgrad gegen den lichten Innendurchmesser des Rohrs/Kanals. */
export const fuellgrad = (durchmesser: number[], innenDurchmesserMm: number): Fuellgrad | undefined => {
  if (!(innenDurchmesserMm > 0) || durchmesser.length === 0) return undefined
  const anteil = kabelFlaeche(durchmesser) / ((Math.PI * innenDurchmesserMm * innenDurchmesserMm) / 4)
  const grenze = fuellgradGrenze(durchmesser.length)
  return { anteil, grenze, passt: anteil <= grenze }
}
