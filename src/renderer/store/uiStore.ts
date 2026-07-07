import { create } from 'zustand'

export type EdgeRouting = 'orthogonal' | 'straight' | 'curved'
export type Language = 'de' | 'en'

/** v7.9.59 — Pro Theme: die fünf Farb-Rollen einer Geräte-Karte.
 *  In Settings → Geräte-Darstellung kann der User jede Farbe per
 *  Color-Picker überschreiben. */
export interface EquipmentColorTokens {
  /** Karten-Body (Hintergrund). */
  body: string
  /** Header-Strip oben (Name, Icon, IP-Bereich). */
  header: string
  /** 1-px-Rand um die Karte. */
  border: string
  /** Haupttext (Name, Port-Labels). */
  text: string
  /** Sekundär-Text (Kategorie, IP, Connector-Typen). */
  subtext: string
}

/** Default-Theme-Farben. Konventionen aus modernen Design-Systemen
 *  (Material 3, Linear, Figma):
 *  - BODY ist das ruhige Fundament — sticht klar gegen Canvas ab
 *  - HEADER ist eine Stufe AKZENTIERT gegen Body, NICHT identisch (Strip
 *    muss als Abgrenzung wahrnehmbar sein)
 *    - Light: Header LEICHT GRAU gegen weißen Body
 *    - Dark: Header HELLER als Body (sonst optisch hinter dem Body
 *      versinkt — eine Header-Stripe oben dunkler als das Body wäre
 *      verkehrt herum)
 *  - BORDER ist eine Mitte-Stufe (slate-500) — kräftig genug für klare
 *    Silhouette, ohne dass die Karte technisch wirkt
 *  - TEXT immer max Kontrast gegen Body (WCAG AAA-Niveau)
 *  - SUBTEXT eine Stufe gedämpft, ≥ 4.5:1 (WCAG AA)
 *
 *  Konkrete Kontrast-Ratios (gerundet):
 *    Light: text/body 19:1, subtext/body 7:1, header/body 1.15:1
 *    Dark:  text/body 13:1, subtext/body 7:1, header/body 1.5:1
 *
 *  Per-Equipment-nodeColor (Properties → Gerätefarbe) überschreibt nur
 *  Body+Border alpha-blended — Header bleibt auf diesen Token-Werten. */
export const DEFAULT_EQUIPMENT_COLORS_LIGHT: EquipmentColorTokens = {
  body: '#ffffff',
  header: '#e2e8f0', // slate-200 — sichtbar gegen Body, nicht aufdringlich
  border: '#64748b', // slate-500 — kräftige Silhouette gegen helle Canvas
  text: '#0f172a',
  subtext: '#475569',
}
export const DEFAULT_EQUIPMENT_COLORS_DARK: EquipmentColorTokens = {
  body: '#1e293b', // slate-800 — zwei Stufen heller als Canvas (slate-950)
  header: '#334155', // slate-700 — HELLER als Body, Strip steht hervor
  border: '#64748b', // slate-500 — denselbe wie Light für visuelle Konsistenz
  text: '#f8fafc',
  subtext: '#cbd5e1',
}

/** Issue #80: globally stored device-config files (ATEM MV/audio configs,
 *  Videohub label & routing dumps, GreenGo .gg5 etc.) that the user can
 *  upload once and then assign to a specific equipment node on the canvas.
 *  Persisted in localStorage so the library survives across projects.
 *
 *  `kind` drives the upload picker and the icon in the list. `equipmentId`
 *  is the binding to a canvas device; null/undefined means "in library
 *  but not assigned". Content is stored as text — XML, JSON or plain
 *  text payload — so we don't need to deal with binary blob storage
 *  in localStorage. */
export type DeviceConfigKind =
  | 'atem-mv'
  | 'atem-audio'
  | 'videohub-labels'
  | 'videohub-routing'
  | 'greengo'
  | 'other'

export interface DeviceConfigEntry {
  id: string
  kind: DeviceConfigKind
  name: string
  fileName: string
  mimeType: string
  content: string
  notes?: string
  savedAt: string
  equipmentId?: string
}

import { STORAGE_KEYS } from '../lib/storageKeys'
import { PANEL_LIMITS, EQUIPMENT_LAYOUT } from '../lib/layoutConstants'

const KEY = STORAGE_KEYS.ui

interface PersistedUiState {
  propertiesCollapsed: boolean
  libraryCollapsed: boolean
  snapToGrid: boolean
  gridSize: number
  defaultRouting: EdgeRouting
  defaultArrow: boolean
  libraryWidth: number
  propertiesWidth: number
  /** Whether cable color on the canvas is derived from the manually set color
   * or from the standard length-color coding. */
  cableColorMode: 'manual' | 'byLength'
  /** Canvas background theme. */
  canvasTheme: 'dark' | 'light'
  /** #453 — Wenn true, folgt canvasTheme automatisch dem OS-Theme
   *  (prefers-color-scheme). Manuelle Theme-Wahl schaltet das wieder ab. */
  followSystemTheme: boolean
  /** When true, port handle dots on equipment nodes are rendered in the
   * color associated with their connector type (SDI = amber, HDMI = purple,
   * Ethernet = green, …). When false, the input/output dichotomy palette
   * is used (cyan for inputs, green for outputs, purple for bidirectional). */
  colorPortsByType: boolean
  /** UI language. English is the default (full EN coverage in the `en`
   *  dict); German remains selectable and is the inline source/fallback. */
  language: Language
  /** Issue #70: When true the cable dialog will not block creation on
   *  connector-type incompatibilities — the user can connect any input
   *  to any output without the "needs converter" confirmation prompt.
   *  The cable is still flagged needsConverter for downstream warnings,
   *  it just doesn't interrupt the user mid-flow. */
  overrideConnectionWarnings: boolean
  // Modulares UI — Rentman ist jetzt ein Modul (settingsStore.enabledModules
  // .rentman, via useModule('rentman')). Das frühere uiStore-Flag
  // `rentmanEnabled` wurde dorthin migriert (siehe settingsStore).
  /** v7.9.5 — Library-Liste vs. Kachel-Ansicht. Kachel zeigt Front-
   *  Panel-Thumbnails wenn vorhanden. */
  libraryViewMode: 'list' | 'grid'
  /** v7.9.5 — Kategorien-Sortierung: 'manual' = User-Order via Drag&Drop,
   *  'asc' = alphabetisch A→Z, 'desc' = Z→A. */
  librarySortMode: 'manual' | 'asc' | 'desc'
  /** v7.9.5 — Persistent Author-Name für Annotations. Wird einmal
   *  abgefragt wenn der User die erste Annotation erstellt; danach
   *  bei jeder weiteren als Default verwendet. Leer-String bedeutet
   *  noch nicht gesetzt → beim nächsten Annotate-Versuch promptet. */
  annotationAuthor: string
  /** Issue #62: per-connector-type colour overrides. When a connector
   *  type is missing or its value is an empty string the built-in
   *  default from DEFAULT_CONNECTOR_TYPE_COLORS applies. Stored sparsely
   *  so we don't bloat localStorage with the full default palette. */
  connectorTypeColors: Record<string, string>
  /** Issue #274 — Geraete-Farben pro Kategorie. Wenn ein Geraet keine
   *  eigene `color`/`nodeColor` gesetzt hat, faellt EquipmentNode auf
   *  `categoryColors[category]` zurueck. Damit kriegt der User "alle
   *  Monitore blau" indem er einmal in Settings die Kategorie-Farbe
   *  setzt. Eigene per-Geraet-Farbe gewinnt weiter.
   *
   *  Leerer Eintrag = kein Override, Theme-Default greift. Stored als
   *  sparses Mapping damit localStorage nicht aufgeblaeht wird. */
  categoryColors: Record<string, string>
  /** Issue #240 — Kuerzere Kabel-Label-Darstellung. true (Default) entfernt
   *  beim Render aus dem Anzeige-Namen Format-Suffixe wie "(1080p50/60)";
   *  false zeigt den vollen Namen wieder.
   *  Wirkt rein visuell — gespeicherter Kabel.name bleibt unangetastet. */
  cableLabelShortForm: boolean
  /** v7.9.59 — Geräte-Karten-Farben pro Theme. User-anpassbar in
   *  Settings → Geräte-Darstellung. Defaults sind so gewählt dass die
   *  Karten optisch klar vom Canvas-Hintergrund abstehen (kontrastreich)
   *  ohne aufdringlich zu sein. Vorher: Light-Karten #f8fafc auf Canvas
   *  #e8edf4 fast unsichtbar; Dark-Karten #0f172a auf Canvas #0f172a
   *  komplett unsichtbar (gleiche Farbe). */
  equipmentColors: {
    light: EquipmentColorTokens
    dark: EquipmentColorTokens
  }
  /** v7.9.63 / #172 — Default-Farbe für neu hinzugefügte Geräte.
   *  undefined = kein Override (Theme-Default wird benutzt). User
   *  setzt das in Settings → Erscheinungsbild. */
  defaultDeviceColor: string | undefined
  /** Issue #71: canvas background pattern variant. 'dots' draws the
   *  ReactFlow dot grid (default), 'lines' draws orthogonal lines,
   *  'cross' draws a + at each grid intersection, 'none' disables. */
  bgVariant: 'dots' | 'lines' | 'cross' | 'none'
  /** Background grid opacity 0..1. Lower values make the dots/lines
   *  fainter — useful when zooming way out on large diagrams. */
  bgOpacity: number
  /** Issue #64: user-defined cable specs persisted across sessions.
   *  Each entry has the same shape as a built-in CableSpec but its
   *  `id` is prefixed with 'custom-cable:' so the cable dialog can
   *  visually distinguish them. They show up in the dropdown next
   *  to the built-in catalog and can be re-edited / deleted from
   *  Settings. */
  customCableSpecs: import('../types/cableSpec').CableSpec[]
  /** v7.9.2 — User-definierte Steckertypen (z.B. "BNC HD-Push-Lock",
   *  "Speakon NL4"), die zusätzlich zu ALL_CONNECTOR_TYPES verfügbar
   *  sind. Werden im Kabeltyp-Editor angelegt und persistiert. */
  customConnectorTypes: string[]
  /** v7.9.2 — User-definierte Signal-Standards (z.B. "Madi 64ch",
   *  "Dante Primary"), zusätzlich zu ALL_SIGNAL_STANDARDS. */
  customSignalStandards: string[]
  /** v7.9.6 — User-defined order of cable groups (SDI, HDMI, …) in the
   *  Kabel-Library. Empty array = natural order from groupOf(). Unknown
   *  groups land at the end so adding a new connector type doesn't lose
   *  visibility. */
  cableGroupOrder: string[]
  /** v7.9.7 — Built-in CableSpec overrides keyed by base-spec id. Stores
   *  only the fields the user changed (Partial) so future catalogue
   *  updates still flow through for untouched fields. Custom cable
   *  specs continue to live in customCableSpecs — they own their own
   *  id and don't need this layer. */
  cableSpecOverrides: Record<string, Partial<import('../types/cableSpec').CableSpec>>
  /** Issue #80: global library of device-config files (ATEM, Videohub,
   *  GreenGo). Each entry can optionally be bound to one equipment id. */
  deviceConfigLibrary: DeviceConfigEntry[]
  /** Issue #65: draw small jump-bumps when two orthogonal cables cross,
   *  the way yEd does, so the user can visually trace which cable is on
   *  top. The lower-id cable gets the bump. Off by default to preserve
   *  the existing visual baseline. */
  cableBumps: boolean
  /** #118 — Schwebende Inline-Selektions-Toolbar (Schnellaktionen direkt
   *  neben der Auswahl). Default an; abschaltbar in den Einstellungen. */
  inlineToolbarEnabled: boolean
  /** Position der schwebenden Canvas-Geräte-Suche (px, relativ zur
   *  Canvas-Fläche). `null` = Default oben mittig. Wird beim Verschieben
   *  per Grip gesetzt und merkt sich die Lage. */
  canvasSearchPos: { x: number; y: number } | null
  /** v7.9.112 / Issue #234 — Global Toggle der ALLE Kabel-Labels
   *  ausblendet, unabhaengig vom per-Kabel labelPosition. Praktisch
   *  fuer aufgeraeumte Plan-Ansicht beim Praesentieren ohne dass jedes
   *  Kabel einzeln umgestellt werden muss. */
  hideAllCableLabels: boolean
  /** #507 — Off-Page-Connector: Netzname/Gegenstück werden standardmäßig
   *  ausgeblendet (flacher, überlappt nicht), nur per Hover eingeblendet.
   *  Wenn true, sind sie dauerhaft sichtbar — praktisch für die Druck-
   *  ansicht. Default off. */
  offPageShowNames: boolean
  /** v7.9.127 — Endpoint-Labels: an jedem Kabelende ein kleines Label
   *  das zeigt zu welchem Geraet/Port das ANDERE Ende des Kabels geht.
   *  Am Source-Ende steht "→ Target-Device · Target-Port", am Target-
   *  Ende "← Source-Device · Source-Port". Nuetzlich um auf einen
   *  Blick zu sehen wohin ein Kabel zieht, ohne ihm visuell folgen
   *  zu muessen. Default off — gibt zusaetzliches Visual-Noise. */
  showCableEndpointLabels: boolean
  /** v7.9.113 / Issue #232 — Wenn aktiv, wird beim Cable-Reconnect der
   *  vom User vergebene Port-Name mit dem Kabel mitgenommen: alter Port
   *  bekommt seinen Template-default-Namen zurueck, neuer Port bekommt
   *  den User-Namen. Spart Copy-Paste beim Umstecken. Default off
   *  damit Reconnect nicht versehentlich Labels umbenennt. */
  swapLabelsOnReconnect: boolean
  /** v7.9.125 — Wenn aktiv (default), folgt Cable.type automatisch dem
   *  ConnectorType der angeschlossenen Ports: aendert der User in den
   *  Geraete-Eigenschaften den Connector eines Ports (z.B. BNC -> XLR),
   *  uebernehmen verbundene Kabel den neuen Typ. Gleiches gilt fuer
   *  Reconnect auf einen Port mit anderem ConnectorType. Cables mit
   *  needsConverter=true bleiben unberuehrt (User hat absichtlich einen
   *  abweichenden Typ gewaehlt). */
  inheritCableTypeFromPort: boolean
  /** Issue #53: when two orthogonal cables share an X- or Y-midline,
   *  shift one of them by a small offset so they're parallel instead of
   *  perfectly overlapping. */
  orthogonalCollisionShift: boolean
  /** Issue #69: customizable keyboard shortcuts. Map of action → key
   *  combo. Empty string disables the shortcut. */
  hotkeys: Record<string, string>
  /** v7.3.0 — floating side panels. When true the corresponding side
   *  panel is rendered as a draggable overlay instead of a grid
   *  column, so it doesn't push the canvas. Position survives
   *  reloads via {x,y}. */
  libraryFloating: boolean
  libraryFloatingPos: { x: number; y: number }
  propertiesFloating: boolean
  propertiesFloatingPos: { x: number; y: number }
  /** #426 — Annotations-Panel kann genauso wie Library/Properties
   *  abgedockt werden (frei verschiebbares Floating-Fenster). Default
   *  ist Sidebar (rechts angedockt) wie bisher. */
  annotationsPanelFloating: boolean
  annotationsPanelFloatingPos: { x: number; y: number }
  /** v7.3.0 — Custom canvas/UI palette override. When set, the
   *  canvas chrome (background, edge colors) uses these instead of
   *  the dark/light defaults. `null` means follow theme. */
  customPalette: {
    canvasBg: string
    gridColor: string
    accent: string
  } | null
  /** v7.4.0 — user-defined order of the accordion sections in the
   *  EquipmentProperties panel. Unknown ids fall back to the natural
   *  default position so adding new sections in future versions
   *  doesn't lose the user's existing ordering. */
  equipmentSectionOrder: string[]
  /** v7.7.1 — Custom canvas background image (Issue #71). Separate
   *  uploads for dark and light theme so the user can tune visibility.
   *  When set, the image replaces the radial gradient and tiles by
   *  default ('cover'). `null` falls back to the theme gradient. */
  canvasBgImageDark: string | null
  canvasBgImageLight: string | null
  /** How the custom image is sized on the canvas. */
  canvasBgImageFit: 'cover' | 'contain' | 'tile'
  /** #291 — Port-Label-Schriftgroesse in Pixel. Skaliert die in
   *  EquipmentNode gerenderten Input-/Output-Port-Beschriftungen.
   *  Default 11 entspricht dem historischen Hardcoded-Wert. Range
   *  8–18 ist durch den Slider in SettingsDialog limitiert. */
  portLabelFontSize: number
}

/**
 * #ux — Default-Sprache anhand der OS-/Browser-Locale wählen statt fix Englisch.
 * Greift NUR beim ersten Start (kein persistierter Wert in localStorage) — eine
 * vom User gespeicherte Sprache gewinnt weiter, weil load() sie über die Defaults
 * merged. Electron setzt navigator.language auf die System-Locale.
 */
const detectDefaultLanguage = (): Language => {
  try {
    const lang = (typeof navigator !== 'undefined' && navigator.language) || ''
    return lang.toLowerCase().startsWith('de') ? 'de' : 'en'
  } catch {
    return 'en'
  }
}

const defaults: PersistedUiState = {
  propertiesCollapsed: false,
  libraryCollapsed: false,
  snapToGrid: true,
  gridSize: EQUIPMENT_LAYOUT.GRID_SIZE,
  defaultRouting: 'orthogonal',
  defaultArrow: true,
  libraryWidth: 260,
  propertiesWidth: 280,
  cableColorMode: 'manual',
  canvasTheme: 'dark',
  followSystemTheme: false,
  colorPortsByType: false,
  language: detectDefaultLanguage(),
  overrideConnectionWarnings: false,
  libraryViewMode: 'list',
  librarySortMode: 'manual',
  annotationAuthor: '',
  connectorTypeColors: {},
  categoryColors: {},
  cableLabelShortForm: true,
  equipmentColors: {
    light: { ...DEFAULT_EQUIPMENT_COLORS_LIGHT },
    dark: { ...DEFAULT_EQUIPMENT_COLORS_DARK },
  },
  defaultDeviceColor: undefined,
  bgVariant: 'dots',
  bgOpacity: 0.5,
  customCableSpecs: [],
  customConnectorTypes: [],
  customSignalStandards: [],
  cableGroupOrder: [],
  cableSpecOverrides: {},
  deviceConfigLibrary: [],
  cableBumps: false,
  inlineToolbarEnabled: true,
  canvasSearchPos: null,
  hideAllCableLabels: false,
  offPageShowNames: false,
  showCableEndpointLabels: false,
  swapLabelsOnReconnect: false,
  inheritCableTypeFromPort: true,
  orthogonalCollisionShift: false,
  hotkeys: {
    undo: 'Ctrl+Z',
    redo: 'Ctrl+Y',
    save: 'Ctrl+S',
    saveAs: 'Ctrl+Shift+S',
    newProject: 'Ctrl+N',
    openProject: 'Ctrl+O',
    deleteSelected: 'Delete',
    clearSelection: 'Escape',
    toggleLibrary: 'Ctrl+B',
    toggleProperties: 'Ctrl+I',
    showLegend: 'L',
    jumpToPatches: 'P',
    toggleArrows: 'A',
    toggleRouting: 'R',
  },
  libraryFloating: false,
  libraryFloatingPos: { x: 80, y: 80 },
  propertiesFloating: false,
  propertiesFloatingPos: { x: 80, y: 80 },
  annotationsPanelFloating: false,
  annotationsPanelFloatingPos: { x: 120, y: 80 },
  customPalette: null,
  canvasBgImageDark: null,
  canvasBgImageLight: null,
  canvasBgImageFit: 'cover',
  portLabelFontSize: 11,
  equipmentSectionOrder: [
    'modes',
    'ports',
    'network',
    'sdi',
    'power',
    'dimensions',
    'display',
    'network-config',
    'optional',
    'flags',
    'rack',
    'library',
    'configs',
    'rack-instance',
    'print',
  ],
}

const load = (): PersistedUiState => {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return defaults
    let parsed: Partial<PersistedUiState>
    try {
      parsed = JSON.parse(raw) as Partial<PersistedUiState>
    } catch {
      // Malformed JSON — wipe and start fresh. Keeping the bad string
      // around would trip every subsequent boot.
      try {
        localStorage.removeItem(KEY)
      } catch {
        /* ignore */
      }
      return defaults
    }
    if (!parsed || typeof parsed !== 'object') return defaults
    // Defensive: ensure every field has the right TYPE, otherwise React
    // selectors that expect arrays/objects can crash on first render and
    // trigger an infinite mount loop (React #185 / #310). Replace any
    // field with the wrong type by the default. This protects users who
    // updated from a much older version with a different schema.
    const merged: PersistedUiState = { ...defaults, ...parsed }
    if (!Array.isArray(merged.customCableSpecs)) merged.customCableSpecs = []
    if (!Array.isArray(merged.customConnectorTypes)) merged.customConnectorTypes = []
    if (!Array.isArray(merged.customSignalStandards)) merged.customSignalStandards = []
    if (!Array.isArray(merged.deviceConfigLibrary)) merged.deviceConfigLibrary = []
    if (typeof merged.cableBumps !== 'boolean') merged.cableBumps = defaults.cableBumps
    if (typeof merged.inlineToolbarEnabled !== 'boolean') merged.inlineToolbarEnabled = defaults.inlineToolbarEnabled
    if (
      merged.canvasSearchPos != null &&
      !(
        typeof merged.canvasSearchPos === 'object' &&
        typeof merged.canvasSearchPos.x === 'number' &&
        typeof merged.canvasSearchPos.y === 'number'
      )
    ) {
      merged.canvasSearchPos = defaults.canvasSearchPos
    }
    if (merged.libraryViewMode !== 'list' && merged.libraryViewMode !== 'grid')
      merged.libraryViewMode = defaults.libraryViewMode
    if (
      merged.librarySortMode !== 'manual' &&
      merged.librarySortMode !== 'asc' &&
      merged.librarySortMode !== 'desc'
    )
      merged.librarySortMode = defaults.librarySortMode
    if (typeof merged.annotationAuthor !== 'string')
      merged.annotationAuthor = defaults.annotationAuthor
    if (typeof merged.orthogonalCollisionShift !== 'boolean')
      merged.orthogonalCollisionShift = defaults.orthogonalCollisionShift
    if (!merged.hotkeys || typeof merged.hotkeys !== 'object') merged.hotkeys = defaults.hotkeys
    else merged.hotkeys = { ...defaults.hotkeys, ...merged.hotkeys }
    if (typeof merged.libraryFloating !== 'boolean') merged.libraryFloating = false
    if (typeof merged.propertiesFloating !== 'boolean') merged.propertiesFloating = false
    if (typeof merged.annotationsPanelFloating !== 'boolean')
      merged.annotationsPanelFloating = false
    if (
      !merged.libraryFloatingPos ||
      typeof merged.libraryFloatingPos.x !== 'number' ||
      typeof merged.libraryFloatingPos.y !== 'number'
    )
      merged.libraryFloatingPos = defaults.libraryFloatingPos
    if (
      !merged.propertiesFloatingPos ||
      typeof merged.propertiesFloatingPos.x !== 'number' ||
      typeof merged.propertiesFloatingPos.y !== 'number'
    )
      merged.propertiesFloatingPos = defaults.propertiesFloatingPos
    if (
      !merged.annotationsPanelFloatingPos ||
      typeof merged.annotationsPanelFloatingPos.x !== 'number' ||
      typeof merged.annotationsPanelFloatingPos.y !== 'number'
    )
      merged.annotationsPanelFloatingPos = defaults.annotationsPanelFloatingPos
    if (
      merged.customPalette &&
      (typeof merged.customPalette.canvasBg !== 'string' ||
        typeof merged.customPalette.gridColor !== 'string' ||
        typeof merged.customPalette.accent !== 'string')
    )
      merged.customPalette = null
    if (!Array.isArray(merged.equipmentSectionOrder)) {
      merged.equipmentSectionOrder = defaults.equipmentSectionOrder
    } else {
      // v7.8.2 — also strip non-string entries and duplicates. SortableContext
      // tolerates extra IDs but a non-string in `items` could throw inside
      // dnd-kit's matching during a drag.
      const seen = new Set<string>()
      const cleaned = merged.equipmentSectionOrder.filter((id): id is string => {
        if (typeof id !== 'string' || !id) return false
        if (seen.has(id)) return false
        seen.add(id)
        return true
      })
      // Make sure every default ID is present so newly-added sections
      // (e.g. 'modes' added in v7.5, 'power' in v7.4) appear for users
      // upgrading from older versions.
      for (const def of defaults.equipmentSectionOrder) {
        if (!seen.has(def)) {
          cleaned.push(def)
          seen.add(def)
        }
      }
      merged.equipmentSectionOrder = cleaned
    }
    if (merged.connectorTypeColors === null || typeof merged.connectorTypeColors !== 'object')
      merged.connectorTypeColors = {}
    if (merged.categoryColors === null || typeof merged.categoryColors !== 'object')
      merged.categoryColors = {}
    // v7.9.59 — Equipment-Karten-Farben mergen.
    // v7.9.60 — Defaults wurden überarbeitet. Wenn ein User noch die
    // v7.9.59-Old-Defaults im localStorage hat (Body=#ffffff/header=
    // #f1f5f9/border=#94a3b8/text=#0f172a/subtext=#64748b für Light
    // bzw. Body=#1e293b/header=#0f172a/border=#475569/text=#f1f5f9/
    // subtext=#94a3b8 für Dark), wird automatisch auf v7.9.60-Defaults
    // migriert. Custom-Farben (alles andere) bleiben unangetastet.
    const eqc = (merged as { equipmentColors?: unknown }).equipmentColors
    const validTokens = (v: unknown): v is EquipmentColorTokens =>
      !!v && typeof v === 'object' &&
      typeof (v as Record<string, unknown>).body === 'string' &&
      typeof (v as Record<string, unknown>).header === 'string' &&
      typeof (v as Record<string, unknown>).border === 'string' &&
      typeof (v as Record<string, unknown>).text === 'string' &&
      typeof (v as Record<string, unknown>).subtext === 'string'
    const isV59LightDefault = (v: EquipmentColorTokens) =>
      v.body === '#ffffff' &&
      v.header === '#f1f5f9' &&
      v.border === '#94a3b8' &&
      v.text === '#0f172a' &&
      v.subtext === '#64748b'
    const isV59DarkDefault = (v: EquipmentColorTokens) =>
      v.body === '#1e293b' &&
      v.header === '#0f172a' &&
      v.border === '#475569' &&
      v.text === '#f1f5f9' &&
      v.subtext === '#94a3b8'
    if (!eqc || typeof eqc !== 'object') {
      ;(merged as { equipmentColors: unknown }).equipmentColors = {
        light: { ...DEFAULT_EQUIPMENT_COLORS_LIGHT },
        dark: { ...DEFAULT_EQUIPMENT_COLORS_DARK },
      }
    } else {
      const obj = eqc as Record<string, unknown>
      const lightTok = validTokens(obj.light) ? obj.light : { ...DEFAULT_EQUIPMENT_COLORS_LIGHT }
      const darkTok = validTokens(obj.dark) ? obj.dark : { ...DEFAULT_EQUIPMENT_COLORS_DARK }
      ;(merged as { equipmentColors: unknown }).equipmentColors = {
        light: isV59LightDefault(lightTok) ? { ...DEFAULT_EQUIPMENT_COLORS_LIGHT } : lightTok,
        dark: isV59DarkDefault(darkTok) ? { ...DEFAULT_EQUIPMENT_COLORS_DARK } : darkTok,
      }
    }
    if (typeof merged.bgOpacity !== 'number' || !Number.isFinite(merged.bgOpacity))
      merged.bgOpacity = defaults.bgOpacity
    // v7.9.30 — Snap-to-Grid und gridSize sind nicht mehr user-konfigurierbar
    // (Toolbar-Toggle entfernt). Werte werden bei jedem Hydrate auf die
    // Defaults gezwungen — alte localStorage-Stände werden überschrieben.
    merged.snapToGrid = defaults.snapToGrid
    merged.gridSize = defaults.gridSize
    if (typeof merged.libraryWidth !== 'number') merged.libraryWidth = defaults.libraryWidth
    if (typeof merged.propertiesWidth !== 'number') merged.propertiesWidth = defaults.propertiesWidth
    if (merged.canvasBgImageDark != null && typeof merged.canvasBgImageDark !== 'string')
      merged.canvasBgImageDark = null
    if (merged.canvasBgImageLight != null && typeof merged.canvasBgImageLight !== 'string')
      merged.canvasBgImageLight = null
    if (!['cover', 'contain', 'tile'].includes(merged.canvasBgImageFit))
      merged.canvasBgImageFit = defaults.canvasBgImageFit
    if (!Array.isArray(merged.cableGroupOrder)) merged.cableGroupOrder = []
    else
      merged.cableGroupOrder = merged.cableGroupOrder.filter(
        (n): n is string => typeof n === 'string' && !!n,
      )
    if (
      !merged.cableSpecOverrides ||
      typeof merged.cableSpecOverrides !== 'object' ||
      Array.isArray(merged.cableSpecOverrides)
    )
      merged.cableSpecOverrides = {}
    return merged
  } catch {
    return defaults
  }
}

/** v7.8.4 — setState rate guard. When a store mutates more than
 *  RATE_THRESHOLD times within RATE_WINDOW_MS, we throw an Error so
 *  the React error boundary captures it (with stack + component
 *  stack) instead of letting the silent #185 loop chew the renderer.
 *  Throwing at the first pathological set freezes the loop early and
 *  surfaces the actual call site in the stack — much easier to debug
 *  than React's "Maximum update depth exceeded" with no offending
 *  setter. */
const RATE_THRESHOLD = 80
const RATE_WINDOW_MS = 250
let recentSetTimestamps: number[] = []
const checkSetRate = (label: string) => {
  const now = Date.now()
  recentSetTimestamps.push(now)
  // Keep only the timestamps within the window.
  recentSetTimestamps = recentSetTimestamps.filter((t) => now - t <= RATE_WINDOW_MS)
  if (recentSetTimestamps.length > RATE_THRESHOLD) {
    const count = recentSetTimestamps.length
    recentSetTimestamps = []
    throw new Error(
      `[CablePlanner] uiStore set-rate guard tripped: ${count} mutations in ${RATE_WINDOW_MS} ms (last setter: ${label}). Likely a render-loop. Captured stack pinpoints the offending caller.`,
    )
  }
}

const persist = (state: PersistedUiState) => {
  try {
    localStorage.setItem(KEY, JSON.stringify(state))
  } catch {
    /* ignore */
  }
}

interface UiState extends PersistedUiState {
  togglePropertiesCollapsed: () => void
  toggleLibraryCollapsed: () => void
  // #444 — explizite Setter für die viewport-getriebene Auto-Einklappung
  // (App.tsx klappt Seiten-Panels < lg-Breakpoint ein und wieder aus).
  setPropertiesCollapsed: (value: boolean) => void
  setLibraryCollapsed: (value: boolean) => void
  setSnapToGrid: (value: boolean) => void
  setGridSize: (value: number) => void
  setDefaultRouting: (value: EdgeRouting) => void
  setDefaultArrow: (value: boolean) => void
  setLibraryWidth: (value: number) => void
  setPropertiesWidth: (value: number) => void
  setCableColorMode: (value: 'manual' | 'byLength') => void
  setCanvasTheme: (value: 'dark' | 'light') => void
  setFollowSystemTheme: (value: boolean) => void
  setColorPortsByType: (value: boolean) => void
  setLanguage: (value: Language) => void
  setOverrideConnectionWarnings: (value: boolean) => void
  setLibraryViewMode: (mode: 'list' | 'grid') => void
  setLibrarySortMode: (mode: 'manual' | 'asc' | 'desc') => void
  setAnnotationAuthor: (name: string) => void
  setConnectorTypeColor: (connectorType: string, color: string | null) => void
  resetConnectorTypeColors: () => void
  setCategoryColor: (category: string, color: string | null) => void
  resetCategoryColors: () => void
  setCableLabelShortForm: (value: boolean) => void
  setEquipmentColors: (theme: 'light' | 'dark', patch: Partial<EquipmentColorTokens>) => void
  resetEquipmentColors: (theme?: 'light' | 'dark') => void
  setDefaultDeviceColor: (color: string | undefined) => void
  setBgVariant: (value: 'dots' | 'lines' | 'cross' | 'none') => void
  setBgOpacity: (value: number) => void
  /** Add a new custom cable spec. The store assigns a `custom-cable:`
   *  id automatically; if a spec with the same name already exists
   *  it's replaced (so re-saving keeps the library clean). */
  addCustomCableSpec: (spec: Omit<import('../types/cableSpec').CableSpec, 'id'>) => import('../types/cableSpec').CableSpec
  /** Patch an existing custom spec in place. No-op if `id` doesn't
   *  start with 'custom-cable:' — built-ins are read-only. */
  updateCustomCableSpec: (
    id: string,
    patch: Partial<Omit<import('../types/cableSpec').CableSpec, 'id'>>,
  ) => void
  removeCustomCableSpec: (id: string) => void
  /** v7.9.2 — User-definierte Stecker- und Signal-Typ Helpers. Used
   *  by the Kabeltyp-Editor und vom EquipmentProperties wo immer
   *  ALL_CONNECTOR_TYPES / ALL_SIGNAL_STANDARDS gerendert wird. */
  addCustomConnectorType: (name: string) => void
  removeCustomConnectorType: (name: string) => void
  addCustomSignalStandard: (name: string) => void
  removeCustomSignalStandard: (name: string) => void
  setCableGroupOrder: (order: string[]) => void
  /** v7.9.7 — Override-Schicht für eingebaute CableSpec-Einträge. Erlaubt
   *  Umbenennen/Recolor/Notes-Editing ohne den globalen cableCatalog
   *  anzufassen. `clearCableSpecOverride` setzt die Defaults wieder her. */
  setCableSpecOverride: (
    id: string,
    patch: Partial<import('../types/cableSpec').CableSpec>,
  ) => void
  clearCableSpecOverride: (id: string) => void
  /** Issue #80: device-config library (ATEM / Videohub / GreenGo configs). */
  addDeviceConfig: (entry: Omit<DeviceConfigEntry, 'id' | 'savedAt'>) => DeviceConfigEntry
  updateDeviceConfig: (id: string, patch: Partial<Omit<DeviceConfigEntry, 'id' | 'savedAt'>>) => void
  removeDeviceConfig: (id: string) => void
  /** Bulk-replace the entire library. Used by the JSON-bundle importer. */
  replaceDeviceConfigLibrary: (entries: DeviceConfigEntry[]) => void
  setCableBumps: (value: boolean) => void
  setInlineToolbarEnabled: (value: boolean) => void
  setCanvasSearchPos: (value: { x: number; y: number } | null) => void
  setHideAllCableLabels: (value: boolean) => void
  setOffPageShowNames: (value: boolean) => void
  setShowCableEndpointLabels: (value: boolean) => void
  setSwapLabelsOnReconnect: (value: boolean) => void
  setInheritCableTypeFromPort: (value: boolean) => void
  setOrthogonalCollisionShift: (value: boolean) => void
  setHotkey: (action: string, combo: string) => void
  resetHotkeys: () => void
  setLibraryFloating: (value: boolean) => void
  setLibraryFloatingPos: (pos: { x: number; y: number }) => void
  setPropertiesFloating: (value: boolean) => void
  setPropertiesFloatingPos: (pos: { x: number; y: number }) => void
  setAnnotationsPanelFloating: (value: boolean) => void
  setAnnotationsPanelFloatingPos: (pos: { x: number; y: number }) => void
  setCustomPalette: (palette: { canvasBg: string; gridColor: string; accent: string } | null) => void
  setEquipmentSectionOrder: (order: string[]) => void
  setCanvasBgImage: (theme: 'dark' | 'light', dataUri: string | null) => void
  setCanvasBgImageFit: (fit: 'cover' | 'contain' | 'tile') => void
  setPortLabelFontSize: (value: number) => void
  pdfExportThemeOverride: 'dark' | 'light' | null
  setPdfExportThemeOverride: (value: 'dark' | 'light' | null) => void
  cableEdit: { open: boolean; cableId?: string }
  openCableEdit: (cableId: string) => void
  closeCableEdit: () => void
  /** v7.9.3 — Annotations-Sidebar (Viewer-Modus + Finalized + Editing). */
  annotationsPanelOpen: boolean
  setAnnotationsPanelOpen: (open: boolean) => void
  /** v7.9.8 — Sichtbarkeit der Annotation-Badges auf dem Canvas. Wenn
   *  false werden die farbigen Kreise und Detail-Karten nicht gerendert
   *  — Daten bleiben erhalten, nur die visuelle Überlagerung ist
   *  ausgeblendet. Praktisch um den Canvas kurz "sauber" zu sehen. */
  annotationsVisible: boolean
  setAnnotationsVisible: (visible: boolean) => void
  /** v7.9.67 / #177 — Toolbar-Modi zum Sperren ganzer Objektarten gegen
   *  Verschieben/Resize. Wirkt zusätzlich zur per-Device-Sperre (#178) und
   *  zum Plan-Lock. Session-only (nicht persistiert), weil das ein
   *  temporärer Schutz während des Editierens ist. */
  /** #427 — Panel ist in ein separates OS-Fenster ausgelagert. Solange true
   *  rendert das Hauptfenster das Panel NICHT (sonst doppelt offen). Beim
   *  Schließen des OS-Fensters wird das Flag zurückgesetzt → Panel kommt
   *  zurück. Session-only (nicht persistiert) — nach Reload sind etwaige
   *  Popout-Fenster ohnehin weg. */
  libraryPoppedOut: boolean
  propertiesPoppedOut: boolean
  annotationsPoppedOut: boolean
  setPanelPoppedOut: (panel: 'library' | 'properties' | 'annotations', value: boolean) => void
  lockFrames: boolean
  lockEquipment: boolean
  lockCables: boolean
  setLockFrames: (v: boolean) => void
  setLockEquipment: (v: boolean) => void
  setLockCables: (v: boolean) => void
  /** v7.9.85 / #123 — Cable-Layer-Sichtbarkeit. Pro Top-Level-Layer
   *  (video / audio / control / network / power + custom) ein
   *  Boolean. Fehlende Keys = sichtbar (so dass neue Custom-Layer
   *  nicht versehentlich versteckt sind). Session-only. */
  layerVisibility: Record<string, boolean>
  setLayerVisibility: (layer: string, visible: boolean) => void
  resetLayerVisibility: () => void
  /** v7.9.85 / #123 — User-definierte Custom-Layer (z.B. "intercom",
   *  "lighting"). Werden in der Toolbar-Chip-Strip mit angezeigt und
   *  in der Cable-Properties-Dropdown auswählbar. */
  customLayers: string[]
  addCustomLayer: (name: string) => void
  removeCustomLayer: (name: string) => void
  videohubExport: { open: boolean; deviceId?: string; initialShowMatrix?: boolean }
  openVideohubExport: (deviceId?: string, initialShowMatrix?: boolean) => void
  closeVideohubExport: () => void
  greengoExport: { open: boolean }
  openGreenGoExport: () => void
  closeGreenGoExport: () => void
  atemDialog: { open: boolean; deviceId?: string }
  openAtemDialog: (deviceId?: string) => void
  closeAtemDialog: () => void
  /** Drum-Mikrofonierungs-Dialog. */
  drumMicingOpen: boolean
  setDrumMicingOpen: (open: boolean) => void
  /** Wireless-Rig-Dialog (Funkstrecken-Kanalplan). */
  wirelessRigOpen: boolean
  setWirelessRigOpen: (open: boolean) => void
  atemMvLayout: { open: boolean }
  openAtemMvLayout: () => void
  closeAtemMvLayout: () => void
  atemMvConfig: { open: boolean; deviceId?: string }
  openAtemMvConfig: (deviceId?: string) => void
  closeAtemMvConfig: () => void
  /** Issue #45 — ATEM Fairlight audio router dialog. */
  atemAudioConfig: { open: boolean; deviceId?: string }
  openAtemAudioConfig: (deviceId?: string) => void
  closeAtemAudioConfig: () => void
  /** Issue #39 — frame-scoped BOM export dialog. */
  locationBom: { open: boolean; locationId?: string }
  openLocationBom: (locationId: string) => void
  closeLocationBom: () => void
  /** Issue #61 — Rack-Editor sub-canvas. `rackInstanceId` is the tag
   *  written by `placeGroupPreset` on every device that belongs to the
   *  same rack instance. */
  rackEditor: { open: boolean; rackInstanceId?: string }
  openRackEditor: (rackInstanceId: string) => void
  closeRackEditor: () => void
  /** v7.9.0 / Issue #120 — Trigger that the RackBuilder should open
   *  seeded with these equipment ids (converted to placements). Null
   *  when no seed is pending. Set by the canvas "Als Rack speichern"
   *  toolbar button, consumed by LibraryPanel's RackBuilder mount. */
  rackBuilderSeedTrigger: string[] | null
  triggerRackBuilderFromSelection: (equipmentIds: string[]) => void
  clearRackBuilderSeedTrigger: () => void
  /** #401 — Trigger fuer "Werkzeuge → Rack Builder": oeffnet einen
   *  leeren RackBuilderDialog (kein Seed-Preset). LibraryPanel
   *  switched auf Racks-Tab und oeffnet den Dialog. Wert ist ein
   *  monotoner Counter (timestamp), damit jeder Klick den Trigger
   *  neu feuert auch wenn der vorherige Open schon abgewickelt ist. */
  newRackBuilderTrigger: number
  triggerNewRackBuilder: () => void
  /** v7.9.51 — Trigger zum Bearbeiten eines bereits platzierten Black-
   *  Box-Racks auf dem Canvas. Anders als rackBuilderSeedTrigger geht
   *  es hier nicht um eine neue Rack-Erzeugung aus Auswahl, sondern
   *  um das Editieren des Source-Presets des selektierten Black-Box-
   *  Equipments. LibraryPanel sucht die zugehörige GroupPreset anhand
   *  des Equipment-Namens (preset.name + " (Rack)" === equipment.name)
   *  oder via rackInstanceLabel. */
  rackBuilderEditFromBlackBoxTrigger: string | null
  triggerRackBuilderEditFromBlackBox: (equipmentId: string) => void
  clearRackBuilderEditFromBlackBoxTrigger: () => void
  /** v7.9.108 / Issue #225 — Drag eines Equipments OHNE Ports auf den
   *  Canvas. Statt direkt addEquipment aufzurufen, oeffnet LibraryPanel
   *  den 'Eigenes Geraet anlegen'-Dialog mit Name/Kategorie vorbefuellt
   *  und ruft beim Speichern addEquipment AT THE STORED DROP POSITION
   *  auf. So muss der User die Ports erst definieren (oder AI fragen)
   *  bevor das Geraet auf dem Canvas landet. */
  pendingEmptyDeviceDrop: {
    name: string
    category: string
    x: number
    y: number
  } | null
  triggerEmptyDeviceDrop: (info: { name: string; category: string; x: number; y: number }) => void
  clearEmptyDeviceDrop: () => void
  /** v7.8.7 / Issues #106 + #117 — context-menu state for cables.
   *  `cableId` identifies the right-clicked cable; `screenX/screenY` is
   *  where the menu pops up; `flowX/flowY` is the click position in
   *  flow coordinates so an "add waypoint here" action lands exactly
   *  where the user clicked. */
  cableContextMenu:
    | { open: true; cableId: string; screenX: number; screenY: number; flowX: number; flowY: number }
    | { open: false }
  openCableContextMenu: (args: {
    cableId: string
    screenX: number
    screenY: number
    flowX: number
    flowY: number
  }) => void
  closeCableContextMenu: () => void
  /** Phone-share dialog (LAN HTTP server + QR code, v7.2.1). */
  mobileShare: { open: boolean }
  openMobileShare: () => void
  closeMobileShare: () => void
  aboutDialog: { open: boolean }
  openAboutDialog: () => void
  closeAboutDialog: () => void
  patchList: { open: boolean }
  openPatchList: () => void
  closePatchList: () => void
  /** Festinstallation — Doku-/Übergabe-Dialog (Installateur-Listen,
   *  Asset-Register, QR-IDs, Übergabe-Paket, Änderungsprotokoll). */
  installDocs: { open: boolean }
  openInstallDocs: () => void
  closeInstallDocs: () => void
  calculators: { open: boolean; tab?: 'bandwidth' | 'power' }
  openCalculators: (tab?: 'bandwidth' | 'power') => void
  closeCalculators: () => void
  /** #403 — Bandbreite und Stromverbrauch sind jetzt zwei getrennte
   *  Dialoge mit eigenem Open-State, damit der User beide gleichzeitig
   *  offen halten kann. Der alte `calculators`-State bleibt als
   *  Fallback fuer Backwards-Kompatibilitaet (Shortcuts/Hotkeys); die
   *  MenuBar nutzt jetzt openBandwidthCalc / openPowerCalc. */
  bandwidthCalc: { open: boolean }
  openBandwidthCalc: () => void
  closeBandwidthCalc: () => void
  powerCalc: { open: boolean }
  openPowerCalc: () => void
  closePowerCalc: () => void
  /** #404 — Recording-Speicherplatz-Rechner. Eigenstaendiger Dialog im
   *  Werkzeuge-Menue; wird zusaetzlich in der Properties-Sidebar
   *  eingebettet wenn die Geraete-Kategorie ein Recorder ist. */
  recordingStorageCalc: { open: boolean }
  openRecordingStorageCalc: () => void
  closeRecordingStorageCalc: () => void
  /** #480/#481 — Projektion & Display: Beamer-Throw-Distance + Bildgrößen-/
   *  LED-Wall-Rechner. Eigenständiger Dialog im Werkzeuge-Menü. */
  projectionCalc: { open: boolean }
  openProjectionCalc: () => void
  closeProjectionCalc: () => void
  /** Einstellungen-Dialog (zentral, damit auch StatusBar/Tools es zu einem
   *  bestimmten Tab öffnen können). `settingsSection` = initialer Tab. */
  settingsOpen: boolean
  settingsSection?: string
  openSettings: (section?: string) => void
  closeSettings: () => void
  /** #378 — Bulk-Cable-Connect-Dialog (mehrere Kabel auf einmal). */
  bulkConnect: { open: boolean }
  openBulkConnect: () => void
  closeBulkConnect: () => void
  /** Projekt-Analysen (read-only Reports): Strom/Phasen, Netzwerk, Gewicht/
   *  Wärme, Redundanz. Issues #345/#346/#351/#352. */
  analysis: { open: boolean }
  openAnalysis: () => void
  closeAnalysis: () => void
  /** Vereinte „Plan-Check"-Palette: Live-Validierung des Plans (#411). */
  planCheck: { open: boolean }
  openPlanCheck: () => void
  closePlanCheck: () => void
  togglePlanCheck: () => void
  /** Zentraler Lager-/Bestands-Dialog (Phase 2 — gated durch `rental`-Modul). */
  inventory: { open: boolean }
  openInventory: () => void
  closeInventory: () => void
  /** Revisionen/Snapshots-Verwaltung (#412). */
  revisions: { open: boolean }
  openRevisions: () => void
  closeRevisions: () => void
  /** KI-Plan-Generierung aus Text-Prompt (#414). */
  aiPlanGen: { open: boolean }
  openAiPlanGen: () => void
  closeAiPlanGen: () => void
  /** Generischer Equipment-CSV-Import in die Library (#354). */
  csvImport: { open: boolean }
  openCsvImport: () => void
  closeCsvImport: () => void
  /** "Neu aus Vorlage" — Projekt-Vorlagen-Galerie (#343). */
  templates: { open: boolean }
  openTemplates: () => void
  closeTemplates: () => void
  /** Rentman equipment import dialog (cross-component trigger). */
  rentmanImport: { open: boolean }
  openRentmanImport: () => void
  closeRentmanImport: () => void
  /** Rentman cable export dialog (push canvas cable BOM to Rentman). */
  rentmanCableExport: { open: boolean }
  openRentmanCableExport: () => void
  closeRentmanCableExport: () => void
  /** Issue #68: id of the cable currently under the mouse cursor (on
   *  the canvas OR in the cables legend). CableEdge highlights itself
   *  when its id matches; EquipmentNode highlights any handle whose
   *  port id matches the hovered cable's endpoints. Cleared on mouse
   *  leave. */
  hoveredCableId: string | null
  setHoveredCableId: (id: string | null) => void
  /** #221 — Netz-Schlüssel des aktuell hervorgehobenen Off-Page-Netzes.
   *  Wird beim Selektieren eines Off-Page-Kabels gesetzt (CanvasArea-Effekt);
   *  jedes CableEdge mit passendem Netz-Schlüssel leuchtet dann mit. So
   *  werden „alle verbundenen Segmente" auf einen Klick sichtbar. */
  highlightedNetKey: string | null
  setHighlightedNetKey: (key: string | null) => void
  /**
   * When the user is drawing a cable by clicking (draw.io-style), this holds
   * the start handle and the list of waypoints the user has placed on the
   * pane so far. `null` while no cable is being drawn.
   */
  pendingCable: {
    nodeId: string
    handleId: string
    handleType: 'source' | 'target'
    waypoints: { x: number; y: number }[]
  } | null
  startPendingCable: (start: { nodeId: string; handleId: string; handleType: 'source' | 'target' }) => void
  addPendingWaypoint: (pt: { x: number; y: number }) => void
  clearPendingCable: () => void
}

// #296 — Persistenz-Schluessel werden aus `defaults` abgeleitet, sodass
// jedes neue Feld in PersistedUiState automatisch durchgereicht wird.
// Vorher war hier eine manuelle Zeilenliste die schon viermal vergessen
// wurde (language, overrideConnectionWarnings, hideAllCableLabels,
// swapLabelsOnReconnect) — User-sichtbare Toggle-Resets waren die Folge.
const PERSISTED_KEYS = Object.keys(defaults) as (keyof PersistedUiState)[]

const applyPatch =
  (patch: Partial<PersistedUiState>) =>
  (state: UiState): Partial<UiState> => {
    checkSetRate(Object.keys(patch).join(','))
    // Two-step cast (via unknown) damit TS die dynamische Index-
    // Zuweisung unten erlaubt — direkter Cast PersistedUiState ⇄
    // Record<string, unknown> verlangt strukturelle Kompatibilitaet.
    const next = {} as unknown as Record<string, unknown>
    for (const key of PERSISTED_KEYS) {
      next[key] = state[key]
    }
    Object.assign(next, patch)
    const result = next as unknown as PersistedUiState
    persist(result)
    return result
  }

export const useUiStore = create<UiState>((set) => ({
  ...load(),
  togglePropertiesCollapsed: () =>
    set((state) => applyPatch({ propertiesCollapsed: !state.propertiesCollapsed })(state)),
  toggleLibraryCollapsed: () =>
    set((state) => applyPatch({ libraryCollapsed: !state.libraryCollapsed })(state)),
  setPropertiesCollapsed: (value) => set(applyPatch({ propertiesCollapsed: value })),
  setLibraryCollapsed: (value) => set(applyPatch({ libraryCollapsed: value })),
  setSnapToGrid: (value) => set(applyPatch({ snapToGrid: value })),
  setGridSize: (value) => set(applyPatch({ gridSize: Math.max(PANEL_LIMITS.gridSize.MIN, Math.min(PANEL_LIMITS.gridSize.MAX, value)) })),
  setDefaultRouting: (value) => set(applyPatch({ defaultRouting: value })),
  setDefaultArrow: (value) => set(applyPatch({ defaultArrow: value })),
  setLibraryWidth: (value) =>
    set(applyPatch({ libraryWidth: Math.max(PANEL_LIMITS.library.MIN, Math.min(PANEL_LIMITS.library.MAX, Math.round(value))) })),
  setPropertiesWidth: (value) =>
    set(applyPatch({ propertiesWidth: Math.max(PANEL_LIMITS.properties.MIN, Math.min(PANEL_LIMITS.properties.MAX, Math.round(value))) })),
  setCableColorMode: (value) => set(applyPatch({ cableColorMode: value })),
  setCanvasTheme: (value) => set(applyPatch({ canvasTheme: value })),
  setFollowSystemTheme: (value) => set(applyPatch({ followSystemTheme: value })),
  setColorPortsByType: (value) => set(applyPatch({ colorPortsByType: value })),
  setLanguage: (value) => set(applyPatch({ language: value })),
  setOverrideConnectionWarnings: (value) => set(applyPatch({ overrideConnectionWarnings: value })),
  setLibraryViewMode: (mode) => set(applyPatch({ libraryViewMode: mode })),
  setLibrarySortMode: (mode) => set(applyPatch({ librarySortMode: mode })),
  setAnnotationAuthor: (name) => set(applyPatch({ annotationAuthor: name })),
  setConnectorTypeColor: (connectorType, color) =>
    set((state) => {
      const next = { ...state.connectorTypeColors }
      if (!color) delete next[connectorType]
      else next[connectorType] = color
      return applyPatch({ connectorTypeColors: next })(state)
    }),
  resetConnectorTypeColors: () => set(applyPatch({ connectorTypeColors: {} })),
  setCategoryColor: (category, color) =>
    set((state) => {
      const next = { ...state.categoryColors }
      if (!color) delete next[category]
      else next[category] = color
      return applyPatch({ categoryColors: next })(state)
    }),
  resetCategoryColors: () => set(applyPatch({ categoryColors: {} })),
  setCableLabelShortForm: (value) => set(applyPatch({ cableLabelShortForm: value })),
  setEquipmentColors: (theme, patch) =>
    set((state) => {
      const next = {
        ...state.equipmentColors,
        [theme]: { ...state.equipmentColors[theme], ...patch },
      }
      return applyPatch({ equipmentColors: next })(state)
    }),
  setDefaultDeviceColor: (color) => set(applyPatch({ defaultDeviceColor: color || undefined })),
  resetEquipmentColors: (theme) =>
    set((state) => {
      if (theme === 'light') {
        return applyPatch({
          equipmentColors: {
            ...state.equipmentColors,
            light: { ...DEFAULT_EQUIPMENT_COLORS_LIGHT },
          },
        })(state)
      }
      if (theme === 'dark') {
        return applyPatch({
          equipmentColors: {
            ...state.equipmentColors,
            dark: { ...DEFAULT_EQUIPMENT_COLORS_DARK },
          },
        })(state)
      }
      return applyPatch({
        equipmentColors: {
          light: { ...DEFAULT_EQUIPMENT_COLORS_LIGHT },
          dark: { ...DEFAULT_EQUIPMENT_COLORS_DARK },
        },
      })(state)
    }),
  setBgVariant: (value) => set(applyPatch({ bgVariant: value })),
  setBgOpacity: (value) => set(applyPatch({ bgOpacity: Math.max(0, Math.min(1, value)) })),
  addCustomCableSpec: (spec) => {
    const id = `custom-cable:${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`
    const entry = { ...spec, id }
    set((state) => {
      // Drop any existing spec with the same name so the user can re-save
      // an edited definition without duplicating it in the dropdown.
      const filtered = state.customCableSpecs.filter((s) => s.name !== spec.name)
      return applyPatch({ customCableSpecs: [...filtered, entry] })(state)
    })
    return entry
  },
  updateCustomCableSpec: (id, patch) =>
    set((state) => {
      if (!id.startsWith('custom-cable:')) return state
      const next = state.customCableSpecs.map((s) =>
        s.id === id ? { ...s, ...patch, id: s.id } : s,
      )
      return applyPatch({ customCableSpecs: next })(state)
    }),
  removeCustomCableSpec: (id) =>
    set((state) =>
      applyPatch({ customCableSpecs: state.customCableSpecs.filter((s) => s.id !== id) })(state),
    ),
  addCustomConnectorType: (name) =>
    set((state) => {
      const trimmed = name.trim()
      if (!trimmed) return state
      if (state.customConnectorTypes.includes(trimmed)) return state
      return applyPatch({
        customConnectorTypes: [...state.customConnectorTypes, trimmed],
      })(state)
    }),
  removeCustomConnectorType: (name) =>
    set((state) =>
      applyPatch({
        customConnectorTypes: state.customConnectorTypes.filter((n) => n !== name),
      })(state),
    ),
  addCustomSignalStandard: (name) =>
    set((state) => {
      const trimmed = name.trim()
      if (!trimmed) return state
      if (state.customSignalStandards.includes(trimmed)) return state
      return applyPatch({
        customSignalStandards: [...state.customSignalStandards, trimmed],
      })(state)
    }),
  removeCustomSignalStandard: (name) =>
    set((state) =>
      applyPatch({
        customSignalStandards: state.customSignalStandards.filter((n) => n !== name),
      })(state),
    ),
  setCableGroupOrder: (order) => set(applyPatch({ cableGroupOrder: order })),
  setCableSpecOverride: (id, patch) =>
    set((state) => {
      const current = state.cableSpecOverrides[id] ?? {}
      const merged = { ...current, ...patch }
      // Strip undefined to keep storage compact.
      for (const k of Object.keys(merged) as (keyof typeof merged)[]) {
        if (merged[k] === undefined) delete merged[k]
      }
      const nextMap = { ...state.cableSpecOverrides, [id]: merged }
      return applyPatch({ cableSpecOverrides: nextMap })(state)
    }),
  clearCableSpecOverride: (id) =>
    set((state) => {
      if (!(id in state.cableSpecOverrides)) return state
      const nextMap = { ...state.cableSpecOverrides }
      delete nextMap[id]
      return applyPatch({ cableSpecOverrides: nextMap })(state)
    }),
  addDeviceConfig: (entry) => {
    const id = `cfg:${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`
    const created: DeviceConfigEntry = {
      ...entry,
      id,
      savedAt: new Date().toISOString(),
    }
    set((state) =>
      applyPatch({ deviceConfigLibrary: [...state.deviceConfigLibrary, created] })(state),
    )
    return created
  },
  updateDeviceConfig: (id, patch) =>
    set((state) => {
      const next = state.deviceConfigLibrary.map((e) =>
        e.id === id ? { ...e, ...patch, id: e.id, savedAt: e.savedAt } : e,
      )
      return applyPatch({ deviceConfigLibrary: next })(state)
    }),
  removeDeviceConfig: (id) =>
    set((state) =>
      applyPatch({ deviceConfigLibrary: state.deviceConfigLibrary.filter((e) => e.id !== id) })(
        state,
      ),
    ),
  replaceDeviceConfigLibrary: (entries) =>
    set((state) => applyPatch({ deviceConfigLibrary: entries })(state)),
  setCableBumps: (value) => set(applyPatch({ cableBumps: value })),
  setInlineToolbarEnabled: (value) => set(applyPatch({ inlineToolbarEnabled: value })),
  setCanvasSearchPos: (value) => set(applyPatch({ canvasSearchPos: value })),
  setHideAllCableLabels: (value) => set(applyPatch({ hideAllCableLabels: value })),
  setOffPageShowNames: (value) => set(applyPatch({ offPageShowNames: value })),
  setShowCableEndpointLabels: (value) => set(applyPatch({ showCableEndpointLabels: value })),
  setSwapLabelsOnReconnect: (value) => set(applyPatch({ swapLabelsOnReconnect: value })),
  setInheritCableTypeFromPort: (value) => set(applyPatch({ inheritCableTypeFromPort: value })),
  setOrthogonalCollisionShift: (value) => set(applyPatch({ orthogonalCollisionShift: value })),
  setHotkey: (action, combo) =>
    set((state) => applyPatch({ hotkeys: { ...state.hotkeys, [action]: combo } })(state)),
  resetHotkeys: () => set(applyPatch({ hotkeys: defaults.hotkeys })),
  setLibraryFloating: (value) => set(applyPatch({ libraryFloating: value })),
  setLibraryFloatingPos: (pos) => set(applyPatch({ libraryFloatingPos: pos })),
  setPropertiesFloating: (value) => set(applyPatch({ propertiesFloating: value })),
  setPropertiesFloatingPos: (pos) => set(applyPatch({ propertiesFloatingPos: pos })),
  setAnnotationsPanelFloating: (value) =>
    set(applyPatch({ annotationsPanelFloating: value })),
  setAnnotationsPanelFloatingPos: (pos) =>
    set(applyPatch({ annotationsPanelFloatingPos: pos })),
  setCustomPalette: (palette) => set(applyPatch({ customPalette: palette })),
  setEquipmentSectionOrder: (order) => set(applyPatch({ equipmentSectionOrder: order })),
  setCanvasBgImage: (theme, dataUri) =>
    set(applyPatch(
      theme === 'dark'
        ? { canvasBgImageDark: dataUri }
        : { canvasBgImageLight: dataUri },
    )),
  setCanvasBgImageFit: (fit) => set(applyPatch({ canvasBgImageFit: fit })),
  setPortLabelFontSize: (value) =>
    set(applyPatch({ portLabelFontSize: Math.max(8, Math.min(18, Math.round(value))) })),
  pdfExportThemeOverride: null,
  setPdfExportThemeOverride: (value) => set({ pdfExportThemeOverride: value }),
  cableEdit: { open: false },
  openCableEdit: (cableId) => set({ cableEdit: { open: true, cableId } }),
  closeCableEdit: () => set({ cableEdit: { open: false } }),
  annotationsPanelOpen: false,
  setAnnotationsPanelOpen: (open) => set({ annotationsPanelOpen: open }),
  annotationsVisible: true,
  setAnnotationsVisible: (visible) => set({ annotationsVisible: visible }),
  libraryPoppedOut: false,
  propertiesPoppedOut: false,
  annotationsPoppedOut: false,
  setPanelPoppedOut: (panel, value) =>
    set(
      panel === 'library'
        ? { libraryPoppedOut: value }
        : panel === 'properties'
          ? { propertiesPoppedOut: value }
          : { annotationsPoppedOut: value },
    ),
  lockFrames: false,
  lockEquipment: false,
  lockCables: false,
  setLockFrames: (v) => set({ lockFrames: v }),
  setLockEquipment: (v) => set({ lockEquipment: v }),
  setLockCables: (v) => set({ lockCables: v }),
  layerVisibility: {
    video: true,
    audio: true,
    control: true,
    network: true,
    power: true,
    other: true,
  },
  setLayerVisibility: (layer, visible) =>
    set((state) => ({
      layerVisibility: { ...state.layerVisibility, [layer]: visible },
    })),
  resetLayerVisibility: () =>
    set({
      layerVisibility: {
        video: true,
        audio: true,
        control: true,
        network: true,
        power: true,
        other: true,
      },
    }),
  customLayers: [],
  addCustomLayer: (name) =>
    set((state) => {
      const clean = name.trim().toLowerCase()
      if (!clean) return {}
      if (state.customLayers.includes(clean)) return {}
      return {
        customLayers: [...state.customLayers, clean],
        // Neu hinzugefügt = standardmäßig sichtbar.
        layerVisibility: { ...state.layerVisibility, [clean]: true },
      }
    }),
  removeCustomLayer: (name) =>
    set((state) => {
      const next = { ...state.layerVisibility }
      delete next[name]
      return {
        customLayers: state.customLayers.filter((l) => l !== name),
        layerVisibility: next,
      }
    }),
  videohubExport: { open: false },
  openVideohubExport: (deviceId, initialShowMatrix) => set({ videohubExport: { open: true, deviceId, initialShowMatrix } }),
  closeVideohubExport: () => set({ videohubExport: { open: false } }),
  greengoExport: { open: false },
  openGreenGoExport: () => set({ greengoExport: { open: true } }),
  closeGreenGoExport: () => set({ greengoExport: { open: false } }),
  atemDialog: { open: false },
  openAtemDialog: (deviceId) => set({ atemDialog: { open: true, deviceId } }),
  closeAtemDialog: () => set({ atemDialog: { open: false } }),
  drumMicingOpen: false,
  setDrumMicingOpen: (open) => set({ drumMicingOpen: open }),
  wirelessRigOpen: false,
  setWirelessRigOpen: (open) => set({ wirelessRigOpen: open }),
  atemMvLayout: { open: false },
  openAtemMvLayout: () => set({ atemMvLayout: { open: true } }),
  closeAtemMvLayout: () => set({ atemMvLayout: { open: false } }),
  atemMvConfig: { open: false },
  openAtemMvConfig: (deviceId) => set({ atemMvConfig: { open: true, deviceId } }),
  closeAtemMvConfig: () => set({ atemMvConfig: { open: false } }),
  atemAudioConfig: { open: false },
  openAtemAudioConfig: (deviceId) => set({ atemAudioConfig: { open: true, deviceId } }),
  closeAtemAudioConfig: () => set({ atemAudioConfig: { open: false } }),
  locationBom: { open: false },
  openLocationBom: (locationId) => set({ locationBom: { open: true, locationId } }),
  closeLocationBom: () => set({ locationBom: { open: false } }),
  rackEditor: { open: false },
  openRackEditor: (rackInstanceId) => set({ rackEditor: { open: true, rackInstanceId } }),
  closeRackEditor: () => set({ rackEditor: { open: false } }),
  rackBuilderSeedTrigger: null,
  triggerRackBuilderFromSelection: (equipmentIds) =>
    set({ rackBuilderSeedTrigger: equipmentIds.length > 0 ? equipmentIds : null }),
  clearRackBuilderSeedTrigger: () => set({ rackBuilderSeedTrigger: null }),
  newRackBuilderTrigger: 0,
  triggerNewRackBuilder: () => set({ newRackBuilderTrigger: Date.now() }),
  rackBuilderEditFromBlackBoxTrigger: null,
  triggerRackBuilderEditFromBlackBox: (equipmentId) =>
    set({ rackBuilderEditFromBlackBoxTrigger: equipmentId }),
  clearRackBuilderEditFromBlackBoxTrigger: () =>
    set({ rackBuilderEditFromBlackBoxTrigger: null }),
  pendingEmptyDeviceDrop: null,
  triggerEmptyDeviceDrop: (info) => set({ pendingEmptyDeviceDrop: info }),
  clearEmptyDeviceDrop: () => set({ pendingEmptyDeviceDrop: null }),
  cableContextMenu: { open: false },
  openCableContextMenu: ({ cableId, screenX, screenY, flowX, flowY }) =>
    set({ cableContextMenu: { open: true, cableId, screenX, screenY, flowX, flowY } }),
  closeCableContextMenu: () => set({ cableContextMenu: { open: false } }),
  mobileShare: { open: false },
  openMobileShare: () => set({ mobileShare: { open: true } }),
  closeMobileShare: () => set({ mobileShare: { open: false } }),
  aboutDialog: { open: false },
  openAboutDialog: () => set({ aboutDialog: { open: true } }),
  closeAboutDialog: () => set({ aboutDialog: { open: false } }),
  patchList: { open: false },
  openPatchList: () => set({ patchList: { open: true } }),
  closePatchList: () => set({ patchList: { open: false } }),
  installDocs: { open: false },
  openInstallDocs: () => set({ installDocs: { open: true } }),
  closeInstallDocs: () => set({ installDocs: { open: false } }),
  calculators: { open: false },
  openCalculators: (tab) => set({ calculators: { open: true, tab } }),
  closeCalculators: () => set({ calculators: { open: false } }),
  bandwidthCalc: { open: false },
  openBandwidthCalc: () => set({ bandwidthCalc: { open: true } }),
  closeBandwidthCalc: () => set({ bandwidthCalc: { open: false } }),
  powerCalc: { open: false },
  openPowerCalc: () => set({ powerCalc: { open: true } }),
  closePowerCalc: () => set({ powerCalc: { open: false } }),
  recordingStorageCalc: { open: false },
  openRecordingStorageCalc: () => set({ recordingStorageCalc: { open: true } }),
  closeRecordingStorageCalc: () => set({ recordingStorageCalc: { open: false } }),
  projectionCalc: { open: false },
  openProjectionCalc: () => set({ projectionCalc: { open: true } }),
  closeProjectionCalc: () => set({ projectionCalc: { open: false } }),
  settingsOpen: false,
  settingsSection: undefined,
  openSettings: (section) => set({ settingsOpen: true, settingsSection: section }),
  closeSettings: () => set({ settingsOpen: false }),
  bulkConnect: { open: false },
  openBulkConnect: () => set({ bulkConnect: { open: true } }),
  closeBulkConnect: () => set({ bulkConnect: { open: false } }),
  analysis: { open: false },
  openAnalysis: () => set({ analysis: { open: true } }),
  closeAnalysis: () => set({ analysis: { open: false } }),
  planCheck: { open: false },
  openPlanCheck: () => set({ planCheck: { open: true } }),
  closePlanCheck: () => set({ planCheck: { open: false } }),
  togglePlanCheck: () => set((s) => ({ planCheck: { open: !s.planCheck.open } })),
  inventory: { open: false },
  openInventory: () => set({ inventory: { open: true } }),
  closeInventory: () => set({ inventory: { open: false } }),
  revisions: { open: false },
  openRevisions: () => set({ revisions: { open: true } }),
  closeRevisions: () => set({ revisions: { open: false } }),
  aiPlanGen: { open: false },
  openAiPlanGen: () => set({ aiPlanGen: { open: true } }),
  closeAiPlanGen: () => set({ aiPlanGen: { open: false } }),
  csvImport: { open: false },
  openCsvImport: () => set({ csvImport: { open: true } }),
  closeCsvImport: () => set({ csvImport: { open: false } }),
  templates: { open: false },
  openTemplates: () => set({ templates: { open: true } }),
  closeTemplates: () => set({ templates: { open: false } }),
  rentmanImport: { open: false },
  openRentmanImport: () => set({ rentmanImport: { open: true } }),
  closeRentmanImport: () => set({ rentmanImport: { open: false } }),
  rentmanCableExport: { open: false },
  openRentmanCableExport: () => set({ rentmanCableExport: { open: true } }),
  closeRentmanCableExport: () => set({ rentmanCableExport: { open: false } }),
  hoveredCableId: null,
  setHoveredCableId: (id) => set({ hoveredCableId: id }),
  highlightedNetKey: null,
  setHighlightedNetKey: (key) => set({ highlightedNetKey: key }),
  pendingCable: null,
  startPendingCable: (start) =>
    set({ pendingCable: { ...start, waypoints: [] } }),
  addPendingWaypoint: (pt) =>
    set((state) =>
      state.pendingCable
        ? { pendingCable: { ...state.pendingCable, waypoints: [...state.pendingCable.waypoints, pt] } }
        : state,
    ),
  clearPendingCable: () => set({ pendingCable: null }),
}))
