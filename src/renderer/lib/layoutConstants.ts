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

/** Equipment-Node-Layout (geteilt zwischen EquipmentNode + equipmentLayout.ts).
 *  v7.9.26 — Alle Werte sind Vielfache von 11 px (= gridSize). Dadurch:
 *    - Port-Handle (im Row-Center bei headerHeight + slot*PORT_ROW + 11)
 *      landet exakt auf einer Dot-Reihe → Kabel laufen sichtbar entlang
 *      der Gitter-Linien.
 *    - Geräte-Höhe = headerHeight + N·PORT_ROW + PADDING = mult of 11
 *      → die Karten-Unterkante liegt immer auf einer Dot-Reihe.
 *    - DEFAULT_WIDTH = 220 = 20·11 → Geräte-Außenkanten links/rechts
 *      decken sich mit Dot-Spalten.
 *  Snap der Geräte-Position erfolgt mit gridSize=11 (siehe uiStore-Default). */
export const EQUIPMENT_LAYOUT = {
  /** Höhe der Karten-Header-Zone ohne IP-Adresse. 4·11 = 44 px. */
  HEADER_HEIGHT: 44,
  /** Höhe wenn die Karte eine IP-Adresse als Subtitle zeigt. 6·11 = 66 px. */
  HEADER_HEIGHT_WITH_IP: 66,
  /** Höhe einer Port-Zeile (Input/Output mit Connector-Dot + Label).
   *  2·11 = 22 px — Port-Handle in der Mitte liegt damit auf jeder
   *  zweiten Dot-Reihe. */
  PORT_ROW: 22,
  /** Größe der ReactFlow-Handle-Hitzone (transparent, click area).
   *  Nicht grid-gebunden — rein visuelles UX-Element. */
  HANDLE_SIZE: 16,
  /** Inner-Padding der Equipment-Karte. 1·11 = 11 px. */
  PADDING: 11,
  /** Default-Breite eines Equipment-Items wenn nicht explizit gesetzt.
   *  20·11 = 220 px. Auto-Expand schnappt ebenfalls auf 11-px-Schritte. */
  DEFAULT_WIDTH: 220,
  /** Default-Grid-Step in CSS-Pixeln. Single source of truth — der
   *  uiStore-Default referenziert diesen Wert. */
  GRID_SIZE: 11,
} as const

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
  /** Grid-Size (Snap-Raster) in px. */
  gridSize: { MIN: 2, MAX: 100 },
} as const

/** Dialog-Drag-Grenzen. */
export const DIALOG_LIMITS = {
  /** Mindestens dieser Pixel-Strip muss vom Dialog im Viewport
   *  sichtbar bleiben, damit der User es auch nach off-screen-Drag
   *  zurückholen kann. */
  MIN_VISIBLE_STRIP_PX: 60,
} as const
