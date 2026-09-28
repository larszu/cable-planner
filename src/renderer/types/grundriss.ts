// Hallenplan unter dem Canvas, mit Massstab.
//
// Uebernommen aus dem multicam-planner (Hintergrundplan + Zwei-Punkt-
// Kalibrierung, Venue2D) und um eine Vier-Punkt-Kalibrierung erweitert. Der
// Anlass war ein Orientierungsschild, abfotografiert: isometrisch gezeichnet
// und schraeg aufgenommen. Auf so einem Bild gibt es keinen einen Massstab —
// ein Meter nach rechts ist dort eine andere Strecke als ein Meter nach
// hinten. Zwei Punkte legen eine Zahl fest und rechnen jede andere Richtung
// falsch; vier Ecken einer bekannten Rechteckflaeche legen die Abbildung fest.

import type { VenueExchange } from '../lib/grundriss/venueExchange'

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

export interface Grundriss {
  /** data:-URL des Bildes. Reist in der Projektdatei mit. */
  src: string
  name?: string
  naturalWidth: number
  naturalHeight: number
  /** Lage und Groesse auf dem Canvas, in Canvas-Pixeln. */
  x: number
  y: number
  width: number
  height: number
  /** 0–1 */
  deckkraft: number
  gesperrt?: boolean
  /**
   * Punkte in CANVAS-Koordinaten, nicht in Bildpixeln. Wird der Plan
   * verschoben oder skaliert, verschiebt `grundrissVerschieben` die Punkte
   * mit — sonst gaelte die Kalibrierung fuer eine Stelle, an der das Bild
   * nicht mehr liegt.
   */
  kalibrierung?: PlanKalibrierung
  /**
   * Was eine Nachbar-App (multicam-, light-planner) ueber den Raum
   * mitgeschickt hat und dieser Planer nicht modelliert: Waende, Personen,
   * Buehnen. Wird beim Export unveraendert zurueckgegeben (ADR-005, Regel 2:
   * eine Projektion ueberschreibt den vollen Stand nicht).
   */
  fremd?: Omit<VenueExchange['venue'], 'floorPlan'>
  /** Bild-Ursprung im Raum der Nachbar-App, in Metern (`floorPlan.offsetX/Y`). */
  fremdVersatzM?: PlanPunkt
}
