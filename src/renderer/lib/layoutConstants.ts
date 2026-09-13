// v7.9.23 — Geteilte Layout-Konstanten + Business-Limits.
//
// Vorher waren Layout-Werte wie HEADER_HEIGHT, PORT_ROW oder die
// Default-Equipment-Breite (220 px) in 4-5 Dateien dupliziert — eine
// Änderung an einer Stelle führte zu inkonsistenten Visuals bis man
// alle Duplikate fand. Plus Business-Limits wie maximale Rack-Höhe
// (60 HE), maximale Matrix-Zellzahl, Sidebar-Breiten standen hardcoded
// quer durch den Code.
//
// Jetzt: ein zentrales `LAYOUT` + `LIMITS` Objekt. Wer die Werte
// ändern will fasst genau eine Stelle an.

import { RASTER_MAX, RASTER_MIN, RASTER_VORGABE } from './raster'

/**
 * Equipment-Node-Layout der VORGABE-Rastergroesse.
 *
 * Hier standen bis 2026-09-12 die Zahlen selbst: 44, 66, 22, 11, 220. Alle
 * Vielfache von 11, mit genau der Begruendung, die jetzt in `raster.ts` als
 * Rechnung steht — die Port-Reihe muss auf einer Punktreihe landen, die
 * Karten-Unterkante auch. Nur liess sich die Rastergroesse im Menue aendern
 * (Einstellungen > Bearbeiten), und dann stimmte die Begruendung nicht mehr:
 * die Geraete rasteten auf dem neuen Mass ein, ihr Innenleben blieb auf 11.
 *
 * Deshalb wird gerechnet statt geschrieben. Dieses Objekt ist das Ergebnis fuer
 * die Vorgabe und bleibt exakt wie vorher (44/66/22/11/220) — es ist der
 * Rueckfall fuer Aufrufer ohne Zugriff auf die Einstellung. Wer die
 * EINGESTELLTE Groesse braucht, nimmt `aktuellesRaster()` bzw. `useRaster()`.
 */
export const EQUIPMENT_LAYOUT = RASTER_VORGABE

/** Default-Werte für Viewport-Berechnungen (zoom-to-fit etc.). */
export const VIEWPORT_DEFAULTS = {
  /** Annahme der Canvas-Breite wenn beim Laden noch nicht gemessen. */
  FALLBACK_WIDTH: 1200,
  /** Annahme der Canvas-Höhe wenn beim Laden noch nicht gemessen. */
  FALLBACK_HEIGHT: 700,
} as const

/** Business-/Domain-Limits — bewusst weit gefasst, mit Begründung. */
export const LIMITS = {
  /** Max Rack-Höhe in HE. 60 deckt typische 19"-Racks ab (42U/47U/54U).
   *  Wer ein größeres Rack braucht (Tele-Center, Datacenter-Rows mit
   *  84U) sollte das hier hochsetzen + sicherstellen dass das UI noch
   *  performant bleibt. */
  MAX_RACK_HEIGHT_HE: 60,
  /** Max Port-Höhe in HE pro Gerät (Quad-Link-Set, Stack-Switch). */
  MAX_PORT_HEIGHT_HE: 20,
  /** Atem-Matrix-Größe ab der das UI auf eine paginierte Liste umstellt
   *  (zu viele Cells = Browser-DOM überlastet). */
  MAX_ATEM_MATRIX_CELLS: 12_000,
  /** Autosave-Intervall-Grenzen (ms). */
  AUTOSAVE_INTERVAL: {
    DEFAULT_MS: 400,
    MIN_MS: 100,
    MAX_MS: 30_000,
  },
} as const

/** UI-Panel-Breiten-Grenzen. */
export const PANEL_LIMITS = {
  /** Library-Sidebar (links). Min 180px reicht für die kleinsten
   *  Kategorie-Header inkl. Suchfeld; max 600px wirkt visuell nicht
   *  mehr wie ein "Side-Panel". */
  library: { MIN: 180, MAX: 600 },
  /** Properties-Sidebar (rechts). Min 220px weil Properties-Forms
   *  längere Labels haben als die Library; max 600px Symmetrie. */
  properties: { MIN: 220, MAX: 600 },
  /** Grid-Size (Snap-Raster) in px. Die Grenzen stehen in `raster.ts`: dort
   *  haengt an ihnen seit 2026-09-12 auch das Zellmass des Wegfinders, und
   *  zwei Zahlenpaare fuer dieselbe Grenze waeren genau der Fehler, den diese
   *  Aenderung behebt. */
  gridSize: { MIN: RASTER_MIN, MAX: RASTER_MAX },
} as const

/** Dialog-Drag-Grenzen. */
export const DIALOG_LIMITS = {
  /** Mindestens dieser Pixel-Strip muss vom Dialog im Viewport
   *  sichtbar bleiben, damit der User es auch nach off-screen-Drag
   *  zurückholen kann. */
  MIN_VISIBLE_STRIP_PX: 60,
} as const
