/**
 * #997 — Geometrie für Projektion und Display, Grundlage für 2D- und 3D-Vorschau.
 *
 * Koordinaten: Boden y = 0, Leinwand in der Ebene z = 0, Raum Richtung +z,
 * x = 0 ist die Leinwandmitte. Alle Längen in Metern.
 *
 * Lens-Shift nach Datenblatt-Konvention: Versatz der Bildmitte gegenüber der
 * Objektivachse in Prozent der Bildhöhe (vertikal) bzw. Bildbreite
 * (horizontal). +50 % vertikal heißt: Objektivachse liegt auf der Bildunterkante
 * (Tischaufstellung), −50 % auf der Oberkante (Deckenmontage).
 */

export interface Seitenverhaeltnis {
  a: number
  b: number
}

export const INCH_TO_M = 0.0254

/** Bildbreite und -höhe aus Diagonale (gleiche Einheit) und Seitenverhältnis. */
export function bildAusDiagonale(diag: number, s: Seitenverhaeltnis): { breite: number; hoehe: number } {
  const n = Math.hypot(s.a, s.b)
  return { breite: (diag * s.a) / n, hoehe: (diag * s.b) / n }
}

/** Sitzabstand, bei dem die Bildbreite den horizontalen Blickwinkel `grad` füllt. */
export function abstandFuerBlickwinkel(breite: number, grad: number): number {
  return breite / 2 / Math.tan((grad * Math.PI) / 360)
}

export interface ProjektionEingabe {
  art: 'projektor' | 'display'
  diagonaleZoll: number
  seiten: Seitenverhaeltnis
  /** Höhe der Bildunterkante über Boden. */
  unterkanteM: number
  /** Throw-Ratio = Projektionsabstand / Bildbreite. */
  throwRatio: number
  /** Vertikaler Lens-Shift in % der Bildhöhe. */
  shiftVProzent: number
  /** Horizontaler Lens-Shift in % der Bildbreite. */
  shiftHProzent: number
}

export interface ProjektionErgebnis {
  breite: number
  hoehe: number
  flaeche: number
  oberkante: number
  mitteY: number
  /** Projektionsabstand Objektiv → Leinwand (0 bei Display). */
  abstand: number
  /** Objektivposition (bei Display undefined). */
  objektiv?: { x: number; y: number; z: number }
  /** Sitzabstände ab Leinwand. */
  sitz: { min: number; optimal: number; max: number }
}

/** Erste Reihe nach THX (36° horizontal), optimal nach SMPTE EG-18 (30°), letzte Reihe 6 × Bildhöhe (AVIXA, allgemeines Lesen). */
export function berechneProjektion(e: ProjektionEingabe): ProjektionErgebnis {
  const { breite, hoehe } = bildAusDiagonale(e.diagonaleZoll * INCH_TO_M, e.seiten)
  const mitteY = e.unterkanteM + hoehe / 2
  const min = abstandFuerBlickwinkel(breite, 36)
  const res: ProjektionErgebnis = {
    breite,
    hoehe,
    flaeche: breite * hoehe,
    oberkante: e.unterkanteM + hoehe,
    mitteY,
    abstand: 0,
    sitz: { min, optimal: abstandFuerBlickwinkel(breite, 30), max: 6 * hoehe },
  }
  if (e.art === 'projektor') {
    res.abstand = e.throwRatio * breite
    res.objektiv = {
      x: -(e.shiftHProzent / 100) * breite,
      y: mitteY - (e.shiftVProzent / 100) * hoehe,
      z: res.abstand,
    }
  }
  return res
}

/** Größte Bildbreite, die bei verfügbarer Raumtiefe noch passt. */
export const maxBreiteFuerTiefe = (tiefe: number, throwRatio: number) => (throwRatio > 0 ? tiefe / throwRatio : 0)
