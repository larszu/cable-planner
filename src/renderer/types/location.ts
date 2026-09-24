export interface LocationFrame {
  id: string
  name: string
  x: number
  y: number
  width: number
  height: number
  color: string // hex colour for border / title accent
  /** Optional floor / level (e.g. "EG", "1.OG", "Basement").
   *  #911 — der NAME einer Etage aus `project.floors`; dort stehen Reihenfolge
   *  und Hoehe. Ein Name ohne Eintrag dort wird beim Laden nachgetragen. */
  floor?: string
  /** Free-form notes about the location. */
  notes?: string
  /** When true, dragging the frame also moves contained equipment (group drag). Defaults to false. */
  moveContents?: boolean
  /** v7.9.67 / #178 — When true the frame can't be dragged or resized.
   *  Per-frame opt-in via Rechtsklick → "Position sperren". */
  positionLocked?: boolean
}

/**
 * #911 — eine Etage des Projekts.
 *
 * Der Name ist der Schluessel: die Rahmen tragen ihn in `floor`, und das
 * bleibt so, weil Viewer, Mobil-Ansicht, Asset-Register und die Live-
 * Kollaboration (die nur Rahmen abgleicht) ihn dort lesen. Die Liste fuegt
 * hinzu, was ein Freitext nicht kann: eine Reihenfolge (von unten nach oben
 * = Reihenfolge in `project.floors`) und eine Hoehe. Ein Tippfehler ist
 * damit keine neue Etage mehr, sondern eine Auswahl.
 */
export interface Floor {
  name: string
  /** Fussbodenhoehe ueber dem Bezugspunkt in Metern, wenn bekannt. Fehlt sie,
   *  ist sie nicht angegeben — nicht 0. */
  elevationM?: number
}
