// @avplan/floorplan — Vektorzeichnung als gemeinsame Eingabe der
// Plan-Erkennung. PDF (pdf.js-Operatorliste) und DXF liefern dasselbe Format,
// damit Waende, Oeffnungen und Raeume nur einmal erkannt werden.
// Quelle aller Planer-Kopien (ADR-015). Nicht in der Kopie aendern.
//
// Koordinaten: x nach rechts, y nach unten, in Zeichnungseinheiten. Beim PDF
// sind das Millimeter auf dem Papier (der Massstab macht daraus Meter), beim
// DXF die Modelleinheit ($INSUNITS) — dort steht `meterJeEinheit` schon fest.

import type { PlanPunkt } from './typen'

export interface VektorPfad {
  /** Teilpfade als Punktfolgen; Kurven sind schon in Strecken zerlegt. */
  teile: PlanPunkt[][]
  /** Je Teilpfad: geschlossen (closePath oder Endpunkt = Anfang). */
  zu: boolean[]
  /** Pfad enthielt Bezier- oder Bogenstuecke (Tuerschwenk, Stuetze rund). */
  kurve: boolean
  gefuellt: boolean
  gezogen: boolean
  /** Strichstaerke in Zeichnungseinheiten, 0 = Haarlinie. */
  breite: number
  /** `#rrggbb`, wenn bekannt. */
  fuellfarbe?: string
  strichfarbe?: string
  /** DXF-Layer bzw. PDF-Ebene (optional content), falls vorhanden. */
  ebene?: string
}

export interface VektorText {
  text: string
  /** Linke Grundlinie. */
  x: number
  y: number
  /** Schrifthoehe. */
  hoehe: number
  /** Laufweite der Zeichenkette, falls bekannt. */
  laenge?: number
  /** Leserichtung in Grad, im Uhrzeigersinn (y nach unten). */
  winkel: number
}

export interface VektorZeichnung {
  quelle: 'pdf' | 'dxf'
  breite: number
  hoehe: number
  /** Linke obere Ecke der Zeichnung, falls sie nicht bei 0/0 liegt (DXF). */
  minX?: number
  minY?: number
  pfade: VektorPfad[]
  texte: VektorText[]
  /** Nur DXF: Meter je Einheit aus $INSUNITS. PDF: unbekannt, Massstab noetig. */
  meterJeEinheit?: number
}

/** Strecken eines Pfads (geschlossene Teile schliessen den Ring). */
export function pfadStrecken(p: VektorPfad): [PlanPunkt, PlanPunkt][] {
  const out: [PlanPunkt, PlanPunkt][] = []
  p.teile.forEach((t, i) => {
    for (let k = 1; k < t.length; k++) out.push([t[k - 1], t[k]])
    if (p.zu[i] && t.length > 2) {
      const a = t[t.length - 1]
      const b = t[0]
      if (a.x !== b.x || a.y !== b.y) out.push([a, b])
    }
  })
  return out
}

/** Flaeche eines Rings (Gauss), Vorzeichen nach Umlaufsinn. */
export function ringFlaeche(r: PlanPunkt[]): number {
  let s = 0
  for (let i = 0, j = r.length - 1; i < r.length; j = i++) s += (r[j].x + r[i].x) * (r[j].y - r[i].y)
  return s / 2
}

/** Punkt im Ring (gerade-ungerade). */
export function imRing(p: PlanPunkt, r: PlanPunkt[]): boolean {
  let drin = false
  for (let i = 0, j = r.length - 1; i < r.length; j = i++) {
    const a = r[i]
    const b = r[j]
    if (a.y > p.y !== b.y > p.y && p.x < ((b.x - a.x) * (p.y - a.y)) / (b.y - a.y) + a.x) drin = !drin
  }
  return drin
}

export interface Rahmen {
  minX: number
  minY: number
  maxX: number
  maxY: number
}

export function rahmenVon(punkte: Iterable<PlanPunkt>): Rahmen {
  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity
  for (const p of punkte) {
    if (p.x < minX) minX = p.x
    if (p.y < minY) minY = p.y
    if (p.x > maxX) maxX = p.x
    if (p.y > maxY) maxY = p.y
  }
  return { minX, minY, maxX, maxY }
}
