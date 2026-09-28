// @avplan/floorplan — Typen des Grundrisses. Quelle aller Planer-Kopien:
// av-planner-suite/packages/floorplan (ADR-015). Nicht in der Kopie aendern.

export interface PlanPunkt {
  x: number
  y: number
}

/**
 * Wie Canvas-Pixel auf dem Plan zu Metern werden.
 *
 * `zweiPunkt`: eine Strecke bekannter Laenge. Gilt nur fuer Plaene, die
 * senkrecht von oben und unverzerrt vorliegen (CAD-Export, Scan).
 *
 * `rechteck`: die vier Ecken einer Flaeche bekannter Breite und Tiefe, im
 * Uhrzeigersinn ab links oben — so, wie sie auf dem Bild erscheinen. Daraus
 * entsteht eine Projektion (Homographie), die auch Perspektive und
 * Isometrie des Bodens richtig rechnet. Hoehen auf dem Bild (Waende einer
 * isometrischen Zeichnung) rechnet sie nicht: sie gilt fuer die Bodenebene.
 */
export type PlanKalibrierung =
  | { art: 'zweiPunkt'; a: PlanPunkt; b: PlanPunkt; meter: number }
  | { art: 'rechteck'; ecken: [PlanPunkt, PlanPunkt, PlanPunkt, PlanPunkt]; breiteM: number; tiefeM: number }
