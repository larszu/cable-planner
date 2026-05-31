/**
 * #170 / Patchblende — Kategorisierter Connector-Katalog mit Symbolen.
 *
 * Ergänzt die flache `ALL_CONNECTOR_TYPES`-Liste um eine nach Funktion
 * gruppierte Auswahl (Audio / MIDI / Video / Data / Fiber / Power /
 * Multifunction / General) mit je einem schematischen Steckersymbol —
 * vorbildlich an Patchbay-CAD-Tools angelehnt. Genutzt vom
 * Patchblenden-Dialog im Rack-Builder (ConnectorPicker), damit der User
 * den Stecker visuell wählt statt aus einer langen Dropdown-Liste.
 *
 * WICHTIG: `id` ist der gespeicherte `connectorType`-String am Port. Wo ein
 * sauberes 1:1 zu einem bestehenden `ConnectorType` existiert (BNC, HDMI,
 * RJ45 …) wird die Legacy-ID wiederverwendet, damit Farb-Legende und
 * Kabel/BOM-Matching den Stecker weiter erkennen. Neue Stecker bekommen
 * eine eigene String-ID — `connectorType` ist eh ein freier String (vgl.
 * Custom-Connector-Typen), sodass das ohne Union-Erweiterung trägt.
 */
import type { ConnectorType } from '../types/equipment'
import { DEFAULT_CONNECTOR_TYPE_COLORS } from './cableColors'

export type ConnectorCategory =
  | 'audio'
  | 'midi'
  | 'video'
  | 'data'
  | 'fiber'
  | 'power'
  | 'multifunction'
  | 'general'

export interface ConnectorCategoryDef {
  id: ConnectorCategory
  /** Deutsche Quell-Bezeichnung (i18n-Fallback). */
  de: string
  /** Englische Bezeichnung. */
  en: string
  /** Akzentfarbe für Kategorie-Header / Tile-Rahmen. */
  color: string
}

export const CONNECTOR_CATEGORIES: ConnectorCategoryDef[] = [
  { id: 'audio', de: 'Audio', en: 'Audio', color: '#38bdf8' },
  { id: 'midi', de: 'MIDI', en: 'MIDI', color: '#e879f9' },
  { id: 'video', de: 'Video', en: 'Video', color: '#f59e0b' },
  { id: 'data', de: 'Daten', en: 'Data', color: '#22c55e' },
  { id: 'fiber', de: 'Glasfaser', en: 'Fibre', color: '#eab308' },
  { id: 'power', de: 'Strom', en: 'Power', color: '#ef4444' },
  { id: 'multifunction', de: 'Multifunktion', en: 'Multifunction', color: '#a78bfa' },
  { id: 'general', de: 'Allgemein', en: 'General', color: '#94a3b8' },
]

/** Symbol-Familie, die `ConnectorSymbol` zeichnen kann. */
export type ConnectorSymbolId =
  | 'xlr'
  | 'jack'
  | 'bantam'
  | 'combo'
  | 'speakon'
  | 'phono'
  | 'binding-post'
  | 'midi'
  | 'bnc'
  | 'vga'
  | 'mini-din'
  | 'hdmi'
  | 'f-conn'
  | 'displayport'
  | 'dvi'
  | 'dsub'
  | 'rj45'
  | 'usb-a'
  | 'usb-b'
  | 'firewire'
  | 'fiber-lc'
  | 'fiber-sc'
  | 'fiber-st'
  | 'toslink'
  | 'powercon'
  | 'lemo'
  | 'generic'
  | 'blank'

export interface ConnectorCatalogEntry {
  /** Gespeicherter `connectorType`-String (ggf. Legacy-ID zur Farb-/BOM-Wiederverwendung). */
  id: string
  /** Anzeige-Label (Patchbay-Schreibweise). Technischer Produktname — nicht lokalisiert. */
  label: string
  category: ConnectorCategory
  symbol: ConnectorSymbolId
  /** Pin-Anzahl (XLR 3-7, DIN/D-Sub) — vom Symbol ausgewertet. */
  pins?: number
  /** Pol-Anzahl (speakON 2/4, Klinke TS=2 / TRS=3). */
  poles?: number
  /** Steckverbinder-Geschlecht — wird beim Erzeugen auf den Port übernommen. */
  gender?: 'male' | 'female'
  /** Strom-Richtung (powerCON In/Out) — beeinflusst Symbol-Pfeil. */
  flow?: 'in' | 'out'
  /** Kompaktes Symbol (Mini-Klinke). */
  mini?: boolean
  /** Explizite Farb-Überschreibung (sonst Legacy-Farbe bzw. Kategorie-Farbe). */
  color?: string
}

export const CONNECTOR_CATALOG: ConnectorCatalogEntry[] = [
  // ---- Audio ----
  { id: 'TT/Bantam', label: 'Bantam', category: 'audio', symbol: 'bantam' },
  { id: 'TS Jack', label: 'TS Jack', category: 'audio', symbol: 'jack', poles: 2 },
  { id: 'TRS Jack', label: 'TRS Jack', category: 'audio', symbol: 'jack', poles: 3 },
  { id: 'XLR 3 Male', label: 'XLR 3 Male', category: 'audio', symbol: 'xlr', pins: 3, gender: 'male' },
  { id: 'XLR 3 Female', label: 'XLR 3 Female', category: 'audio', symbol: 'xlr', pins: 3, gender: 'female' },
  { id: 'Combo XLR/Jack', label: 'Combo', category: 'audio', symbol: 'combo' },
  { id: 'Mini Jack', label: 'Mini Jack', category: 'audio', symbol: 'jack', poles: 3, mini: true },
  { id: 'speakON 2 Pole', label: 'speakON 2 Pole', category: 'audio', symbol: 'speakon', poles: 2 },
  { id: 'speakON 4 Pole', label: 'speakON 4 Pole', category: 'audio', symbol: 'speakon', poles: 4 },
  { id: 'Cinch/RCA', label: 'Phono', category: 'audio', symbol: 'phono' },
  { id: 'Binding Post', label: 'Binding Post', category: 'audio', symbol: 'binding-post' },
  { id: 'XLR 4 Male', label: 'XLR 4 Male', category: 'audio', symbol: 'xlr', pins: 4, gender: 'male' },
  { id: 'XLR 4 Female', label: 'XLR 4 Female', category: 'audio', symbol: 'xlr', pins: 4, gender: 'female' },
  { id: 'XLR 5 Male', label: 'XLR 5 Male', category: 'audio', symbol: 'xlr', pins: 5, gender: 'male' },
  { id: 'XLR 5 Female', label: 'XLR 5 Female', category: 'audio', symbol: 'xlr', pins: 5, gender: 'female' },
  { id: 'XLR 6 Male', label: 'XLR 6 Male', category: 'audio', symbol: 'xlr', pins: 6, gender: 'male' },
  { id: 'XLR 6 Female', label: 'XLR 6 Female', category: 'audio', symbol: 'xlr', pins: 6, gender: 'female' },
  { id: 'XLR 7 Male', label: 'XLR 7 Male', category: 'audio', symbol: 'xlr', pins: 7, gender: 'male' },
  { id: 'XLR 7 Female', label: 'XLR 7 Female', category: 'audio', symbol: 'xlr', pins: 7, gender: 'female' },

  // ---- MIDI ----
  { id: 'MIDI', label: 'MIDI', category: 'midi', symbol: 'midi', pins: 5 },

  // ---- Video ----
  { id: 'BNC', label: 'BNC', category: 'video', symbol: 'bnc' },
  { id: 'VGA', label: 'VGA', category: 'video', symbol: 'vga' },
  { id: 'S-Video', label: 'S-Video', category: 'video', symbol: 'mini-din', pins: 4 },
  { id: 'S-VHS', label: 'SVHS', category: 'video', symbol: 'mini-din', pins: 4 },
  { id: 'HDMI', label: 'HDMI', category: 'video', symbol: 'hdmi' },
  { id: 'F-Connector', label: 'F', category: 'video', symbol: 'f-conn' },
  { id: 'DisplayPort', label: 'Display Port', category: 'video', symbol: 'displayport' },
  { id: 'DVI', label: 'DVI', category: 'video', symbol: 'dvi' },

  // ---- Data ----
  { id: 'DB9', label: 'Dsub 9', category: 'data', symbol: 'dsub', pins: 9 },
  { id: 'Ethernet/RJ45', label: 'RJ45', category: 'data', symbol: 'rj45' },
  { id: 'USB Type A', label: 'USB Type A', category: 'data', symbol: 'usb-a' },
  { id: 'USB Type B', label: 'USB Type B', category: 'data', symbol: 'usb-b' },
  { id: 'USB 3 Type A', label: 'USB 3 Type A', category: 'data', symbol: 'usb-a', color: '#3b82f6' },
  { id: 'USB 3 Type B', label: 'USB 3 Type B', category: 'data', symbol: 'usb-b', color: '#3b82f6' },
  { id: 'FireWire 400', label: 'FireWire 400', category: 'data', symbol: 'firewire', pins: 6 },
  { id: 'FireWire 800', label: 'FireWire 800', category: 'data', symbol: 'firewire', pins: 9 },
  { id: 'PS/2', label: 'PS/2', category: 'data', symbol: 'mini-din', pins: 6 },

  // ---- Fiber ----
  { id: 'Fiber Optic LC', label: 'Fiber Optic LC', category: 'fiber', symbol: 'fiber-lc' },
  { id: 'Fiber Optic SC', label: 'Fibre Optic SC', category: 'fiber', symbol: 'fiber-sc' },
  { id: 'Fiber Optic ST', label: 'Fiber Optic ST', category: 'fiber', symbol: 'fiber-st' },
  { id: 'Toslink', label: 'Toslink', category: 'fiber', symbol: 'toslink' },

  // ---- Power ----
  { id: 'powerCON Input', label: 'powerCON Input', category: 'power', symbol: 'powercon', flow: 'in', color: '#0ea5e9' },
  { id: 'powerCON Output', label: 'powerCON Output', category: 'power', symbol: 'powercon', flow: 'out', color: '#64748b' },

  // ---- Multifunction ----
  { id: 'Lemo', label: 'Lemo', category: 'multifunction', symbol: 'lemo' },
  { id: 'Tourine 25', label: 'Tourine 25', category: 'multifunction', symbol: 'dsub', pins: 25 },
  { id: 'Tourine 37', label: 'Tourine 37', category: 'multifunction', symbol: 'dsub', pins: 37 },

  // ---- General ----
  { id: 'Generic', label: 'Generic', category: 'general', symbol: 'generic' },
  { id: 'Blanking Panel', label: 'Blanking Panel', category: 'general', symbol: 'blank' },
]

const CATALOG_BY_ID = new Map(CONNECTOR_CATALOG.map((e) => [e.id, e]))
const CATEGORY_BY_ID = new Map(CONNECTOR_CATEGORIES.map((c) => [c.id, c]))

/** Katalog-Eintrag zu einer gespeicherten connectorType-ID (oder undefined). */
export const findConnectorEntry = (id: string): ConnectorCatalogEntry | undefined =>
  CATALOG_BY_ID.get(id)

/** Anzeige-Label für eine connectorType-ID — Katalog-Label oder die ID selbst. */
export const connectorLabel = (id: string): string => CATALOG_BY_ID.get(id)?.label ?? id

/** Geschlecht aus dem Katalog (für Port-Erzeugung). */
export const connectorGender = (id: string): 'male' | 'female' | undefined =>
  CATALOG_BY_ID.get(id)?.gender

/** Farbe für einen Eintrag: explizit → Legacy-Palette → Kategorie-Akzent. */
export const connectorColor = (entry: ConnectorCatalogEntry): string =>
  entry.color ??
  DEFAULT_CONNECTOR_TYPE_COLORS[entry.id as ConnectorType] ??
  CATEGORY_BY_ID.get(entry.category)?.color ??
  '#94a3b8'

/** Farbe direkt zu einer connectorType-ID (Fallback grau für unbekannte). */
export const connectorColorById = (id: string): string => {
  const entry = CATALOG_BY_ID.get(id)
  if (entry) return connectorColor(entry)
  return DEFAULT_CONNECTOR_TYPE_COLORS[id as ConnectorType] ?? '#94a3b8'
}

export interface ConnectorGroup {
  category: ConnectorCategoryDef
  entries: ConnectorCatalogEntry[]
}

/**
 * Katalog nach Kategorien gruppiert (in CONNECTOR_CATEGORIES-Reihenfolge),
 * plus optional weitere/Legacy/Custom-Typen die NICHT im Katalog stehen.
 * Letztere landen mit Generic-Symbol unter "Allgemein", damit nichts aus
 * der bisherigen Auswahl verloren geht.
 */
export const buildConnectorGroups = (extraTypes: string[] = []): ConnectorGroup[] => {
  const groups: ConnectorGroup[] = CONNECTOR_CATEGORIES.map((category) => ({
    category,
    entries: CONNECTOR_CATALOG.filter((e) => e.category === category.id),
  }))
  const seen = new Set(CONNECTOR_CATALOG.map((e) => e.id))
  const extras: ConnectorCatalogEntry[] = []
  for (const t of extraTypes) {
    if (!t || seen.has(t)) continue
    seen.add(t)
    extras.push({ id: t, label: t, category: 'general', symbol: 'generic' })
  }
  if (extras.length) {
    const general = groups.find((g) => g.category.id === 'general')
    if (general) general.entries = [...general.entries, ...extras]
  }
  return groups.filter((g) => g.entries.length > 0)
}
