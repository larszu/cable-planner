// ───────────────────────────────────────────────────────────────────────────
// #910 — die Optik einer Kamera als kurze Zeile („24–105 mm @ 85 mm · 2x").
//
// Rein, ohne Store: dieselbe Zeile steht im Canvas-Knoten und im
// Eigenschaften-Feld, und beide duerfen nicht auseinanderlaufen.
// ───────────────────────────────────────────────────────────────────────────
import type { KameraOptik } from '../types/equipment'

/** 7.80 → „7.8", 105 → „105" — Brennweiten werden nicht auf ganze mm gerundet. */
const mm = (n: number): string => String(Math.round(n * 10) / 10)

/** Zoombereich „24–105 mm", Festbrennweite „50 mm", oder undefined. */
export function zoombereich(o: KameraOptik): string | undefined {
  const { brennweiteMinMm: min, brennweiteMaxMm: max } = o
  if (min !== undefined && max !== undefined) return min === max ? `${mm(min)} mm` : `${mm(min)}–${mm(max)} mm`
  if (min !== undefined) return `${mm(min)} mm`
  if (max !== undefined) return `${mm(max)} mm`
  return undefined
}

/** Objektiv als Name („Fujinon UA24x7.8"), oder undefined. */
export function objektivName(o: KameraOptik): string | undefined {
  const name = [o.objektivHersteller, o.objektivModell].filter(Boolean).join(' ').trim()
  return name || undefined
}

/**
 * Die Kurzzeile fuer den Canvas: Zoombereich, eingestellte Brennweite,
 * Extender. Das Objektiv-Modell steht nur dann darin, wenn es keinen
 * Zoombereich gibt — sonst waere die Zeile breiter als der Knoten.
 */
export function optikKurz(o: KameraOptik | undefined): string | undefined {
  if (!o) return undefined
  const teile: string[] = []
  const bereich = zoombereich(o)
  if (bereich) teile.push(bereich)
  else {
    const name = objektivName(o)
    if (name) teile.push(name)
  }
  if (o.brennweiteMm !== undefined) teile.push(`@ ${mm(o.brennweiteMm)} mm`)
  if (o.extender !== undefined) teile.push(`${mm(o.extender)}x`)
  return teile.length > 0 ? teile.join(' ') : undefined
}
