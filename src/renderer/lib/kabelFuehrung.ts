// ───────────────────────────────────────────────────────────────────────────
// #1190 — Kabelfuehrung im Raum: Stuetzpunkte, Streckenlaenge, Einfuegen.
//
// REIN und ohne three.js (wie `gebaeudeSzene.ts`): die Ansicht in
// `components/Rack/Gebaeude3DDialog.tsx` zeichnet, gerechnet wird hier.
//
// Der Nutzen ist die LAENGE. Ein Kabel, das an der Traverse entlang, die
// Wand hinunter und durch den Bodenkanal laeuft, ist laenger als die
// Luftlinie und laenger als der Weg auf dem Schaltbild. Die Laengen-
// Schaetzung (`cableLengthEstimate.ts`) nimmt deshalb diese Strecke, sobald
// ein Kabel Stuetzpunkte hat — und mit ihr Stueckliste und Konfektionsliste.
// ───────────────────────────────────────────────────────────────────────────
import type { Fuehrungspunkt } from '../types/cable'
import type { Punkt3D } from './gebaeudeSzene'

/** Laenge eines Streckenzugs in Metern. */
export const streckenLaengeM = (punkte: readonly Punkt3D[]): number => {
  let summe = 0
  for (let i = 1; i < punkte.length; i++) {
    const a = punkte[i - 1]
    const b = punkte[i]
    summe += Math.hypot(b.x - a.x, b.y - a.y, b.z - a.z)
  }
  return summe
}

/** Stuetzpunkt (Canvas-px + Hoehe) → Szenenpunkt in Metern. */
export const punktAusFuehrung = (p: Fuehrungspunkt, metersPer100px: number): Punkt3D => {
  const m = metersPer100px / 100
  return { x: p.x * m, y: p.hoeheM, z: p.y * m }
}

/** Szenenpunkt in Metern → Stuetzpunkt (Canvas-px + Hoehe), auf cm gerundet. */
export const fuehrungAusPunkt = (p: Punkt3D, metersPer100px: number): Fuehrungspunkt => {
  const m = metersPer100px / 100
  const r = (v: number, s: number) => Math.round(v * s) / s
  return { x: r(p.x / m, 10), y: r(p.z / m, 10), hoeheM: r(p.y, 100) }
}

/**
 * Setzt einen neuen Stuetzpunkt dort in die Fuehrung, wo er den Weg am
 * wenigsten verlaengert — also zwischen die beiden Punkte, an deren Strecke
 * er liegt. Wer an der Traverse entlang klickt, muss nicht in der richtigen
 * Reihenfolge klicken.
 */
export const stuetzpunktEinfuegen = (
  fuehrung: readonly Fuehrungspunkt[],
  von: Punkt3D,
  nach: Punkt3D,
  neu: Fuehrungspunkt,
  metersPer100px: number,
): Fuehrungspunkt[] => {
  const kette = [von, ...fuehrung.map((p) => punktAusFuehrung(p, metersPer100px)), nach]
  const n = punktAusFuehrung(neu, metersPer100px)
  const d = (a: Punkt3D, b: Punkt3D) => Math.hypot(b.x - a.x, b.y - a.y, b.z - a.z)
  let bester = 0
  let umweg = Infinity
  for (let i = 0; i < kette.length - 1; i++) {
    const u = d(kette[i], n) + d(n, kette[i + 1]) - d(kette[i], kette[i + 1])
    if (u < umweg - 1e-9) {
      umweg = u
      bester = i
    }
  }
  return [...fuehrung.slice(0, bester), neu, ...fuehrung.slice(bester)]
}

/** Durchmesser, mit dem ein Kabel ohne Katalogangabe gezeichnet wird (mm). */
export const STANDARD_DURCHMESSER_MM = 6
