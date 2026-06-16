// v7.9.23 — Zentrale Registry aller localStorage-Keys.
//
// Vorher waren ~16 Keys quer durch die Codebase verstreut, mit
// inkonsistenter Namensgebung (kebab-case vs. dot-case, mit/ohne
// Versions-Suffix). Tippfehler beim Lesen/Schreiben hätten zu
// stillem Datenverlust geführt — und das Auffinden aller benutzten
// Keys für ein "Lösche alle App-Daten"-Flow war mühsam.
//
// Jetzt: ein einziges `STORAGE_KEYS`-Objekt mit allen Keys, importiert
// wo benötigt. Auto-Complete im Editor verhindert Typos.
//
// Konvention: 'cable-planner:<scope>:<feature>:v<n>' wo möglich. Das
// `:v<n>`-Suffix wird genutzt wenn das Schema gebrochen wurde und
// alte Daten ignoriert werden sollen.

export const STORAGE_KEYS = {
  /** Project-Autosave: schreibt das aktuelle Project bei jeder Mutation. */
  projectAutosave: 'cable-planner:projectAutosave',
  /** User-defined Equipment-Templates (Bibliothek). */
  customLibrary: 'cable-planner:customLibrary',
  /** Bekannte Kategorien (DnD-Reihenfolge persistiert). */
  knownCategories: 'cable-planner:knownCategories',
  /** Group-Presets (Racks + freie Gruppen). */
  groupPresets: 'cable-planner:groupPresets',
  /** Migrations-Marker für ein-malige Catalog-Seeds. */
  libMigration: 'cable-planner:libMigration',
  /** UI-Store (Panel-Sichtbarkeit, Defaults, Theme). */
  ui: 'cable-planner:ui',
  /** Settings-Store (App-weite Settings, Autosave-Intervall etc.). */
  settings: 'cable-planner:settings',
  /** Inventory-Store (Phase 2 — zentraler, planübergreifender Bestand). */
  inventory: 'cable-planner:inventory',
  /** ATEM-Switcher Discovery-Cache. */
  rentmanTemplateCacheV1: 'cable-planner:rentmanTemplateCache:v1',
  /** NetBox device-type-library Index-Cache. */
  netboxIndexV1: 'cable-planner:netbox:index:v1',
  /** GreenGo Intercom-Preset-Library. */
  greengoPresets: 'cable-planner:greengoPresets',
  /** Gemini-API-Key (User-supplied, kein .env-Eintrag). */
  geminiApiKey: 'cable-planner:geminiApiKey',
  /** Mobile-Share Web-Token (Pairing-Code). */
  webToken: 'cable-planner:web:token',
  /** Mobile-Share zuletzt geöffnete Projekte. */
  webRecents: 'cable-planner:web:recents',
  /** Onboarding-Tour: einmal gesehen Flag. */
  tourSeenV1: 'cable-planner.tour.seen.v1',
  /** Welcome-Dialog: gesehen Flag. */
  welcomed: 'cable-planner:welcomed',
  /** Rack-Builder Draft (Auto-Save während Bearbeitung). */
  rackBuilderDraftV2: 'cable-planner:rack-builder:draft:v2',
  /** Rack-Builder: Breite der Bibliotheks-Spalte (resizable, px). */
  rackBuilderLibColV1: 'cable-planner:rack-builder:libcol:v1',
  /** Letzte Boot-Crash Zeit (für ErrorBoundary Loop-Detection). */
  bootErrorTs: 'cable-planner:boot-error-ts',
  /** Dialog-Position-Persistenz (per-storageKey-Suffix). */
  modalPosPrefix: 'cable-planner:modal-pos:',
  /** Toolbar-Position. */
  canvasToolbarPos: 'cable-planner:canvas-toolbar-pos',
  /** Electron-Window-Geometrie (persistiert über Sessions). */
  windowGeometry: 'cable-planner:window-geometry',
  /** #309 — Bilinguale Kategorie-Anzeigenamen (de/en Map). */
  categoryTranslations: 'cable-planner:categoryTranslations',
  /** #499 — Gelernte Zuordnung Rentman-Kategorie → lokale Kategorie. */
  rentmanCategoryMap: 'cable-planner:rentman:category-map:v1',
} as const

export type StorageKey = (typeof STORAGE_KEYS)[keyof typeof STORAGE_KEYS]

/** Alle Keys + Prefix-basierte Keys für "Lösche alle Daten"-Flows. */
export const STORAGE_KEY_PREFIXES = [
  'cable-planner:',
  'cable-planner.',
] as const
