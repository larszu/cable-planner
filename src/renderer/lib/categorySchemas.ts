/**
 * #373 — Kategorie-spezifische Geräte-Eigenschaften (Property-Schema je Kategorie).
 *
 * Vorher trugen Kategorien wie Objektive/Kameras/Licht/Audio/Netzwerk/Strom
 * KEINE der Fachfelder, die diese Geräteklassen technisch besitzen — ein
 * Objektiv hatte im Modell dieselben Felder wie ein Switch.
 *
 * Dieses Modul definiert pro (canonical) Kategorie ein typisiertes Schema
 * (Feld · Einheit · Typ · Optionen). Die rohen Werte landen in
 * `equipment.categoryProps` (siehe `types/equipment.ts`) und wandern damit
 * automatisch mit Projekt-Datei und Library-Template mit. Gerendert wird das
 * Schema generisch von `CategoryPropsSection` — kein Einzelfall-Block mehr.
 *
 * Labels sind bilingual (DE Quell-Sprache, EN dazu) analog zu
 * `categoryTranslations.ts`. Die Feld-Werte (`focalLength` etc.) sind
 * sprach-neutrale Schlüssel und bleiben stabil.
 *
 * Quelle für die Fachfelder: BET-Fachwörterbuch (bet.de/lexikon) —
 * vgl. Issues #374 (Objektive), #375 (Kameras), #379 (Licht), #383 (Audio),
 * #391 (Netzwerk), #392 (Strom), #393 (Monitore), #394 (Stative/Rigging).
 */
import type { Lang } from './categoryTranslations'

export type CategoryFieldType = 'text' | 'number' | 'select' | 'boolean'

export interface CategoryFieldOption {
  value: string
  label: Record<Lang, string>
}

export interface CategoryFieldDef {
  /** Stabiler Schlüssel in `equipment.categoryProps`. */
  key: string
  label: Record<Lang, string>
  type: CategoryFieldType
  /** Optionale Einheit, hinter dem Feld angezeigt (mm, W, lx, K, …). */
  unit?: string
  /** Auswahl-Optionen für `type: 'select'`. */
  options?: CategoryFieldOption[]
  placeholder?: string
}

const L = (de: string, en: string): Record<Lang, string> => ({ de, en })
const opt = (value: string, de: string, en: string): CategoryFieldOption => ({
  value,
  label: { de, en },
})

/**
 * Canonical-Kategorie → Feld-Schema. Schlüssel = `DEFAULT_CATEGORIES`-Einträge.
 * Auflösung case-insensitiv + EN-Alias (siehe `schemaForCategory`).
 */
export const CATEGORY_SCHEMAS: Record<string, CategoryFieldDef[]> = {
  Objektive: [
    { key: 'focalLength', label: L('Brennweite', 'Focal length'), type: 'text', unit: 'mm', placeholder: '17-120' },
    { key: 'aperture', label: L('Lichtstärke', 'Aperture'), type: 'text', placeholder: 'T2.8 / f2.8' },
    {
      key: 'mount',
      label: L('Anschluss', 'Mount'),
      type: 'select',
      options: [opt('PL', 'PL', 'PL'), opt('EF', 'EF', 'EF'), opt('B4', 'B4 (2/3")', 'B4 (2/3")'), opt('E', 'E', 'E'), opt('LPL', 'LPL', 'LPL'), opt('MFT', 'MFT', 'MFT')],
    },
    {
      key: 'imageCircle',
      label: L('Bildkreis', 'Image circle'),
      type: 'select',
      options: [opt('23', '2/3"', '2/3"'), opt('s35', 'Super 35', 'Super 35'), opt('ff', 'Full-Frame', 'Full-frame')],
    },
    { key: 'minFocus', label: L('Naheinstellgrenze', 'Min. focus'), type: 'number', unit: 'm' },
    { key: 'frontDiameter', label: L('Filtergewinde', 'Front thread'), type: 'number', unit: 'mm' },
  ],
  Kameras: [
    {
      key: 'sensor',
      label: L('Sensorgröße', 'Sensor size'),
      type: 'select',
      options: [opt('23', '2/3"', '2/3"'), opt('s35', 'Super 35', 'Super 35'), opt('ff', 'Full-Frame', 'Full-frame'), opt('mft', 'MFT', 'MFT')],
    },
    {
      key: 'mount',
      label: L('Objektivanschluss', 'Lens mount'),
      type: 'select',
      options: [opt('PL', 'PL', 'PL'), opt('EF', 'EF', 'EF'), opt('B4', 'B4 (2/3")', 'B4 (2/3")'), opt('E', 'E', 'E')],
    },
    {
      key: 'connection',
      label: L('Anbindung', 'Connection'),
      type: 'select',
      options: [opt('triax', 'Triax', 'Triax'), opt('fiber', 'Glasfaser (SMPTE 311M)', 'Fibre (SMPTE 311M)'), opt('sdi', 'SDI', 'SDI'), opt('wireless', 'Drahtlos', 'Wireless')],
    },
    { key: 'baseIso', label: L('Empfindlichkeit (Base ISO)', 'Base ISO'), type: 'number' },
    { key: 'dynamicRange', label: L('Dynamikumfang', 'Dynamic range'), type: 'number', unit: 'Stops' },
    { key: 'maxFps', label: L('max. Bildrate', 'Max. frame rate'), type: 'number', unit: 'fps' },
    { key: 'genlock', label: L('Genlock-Eingang', 'Genlock input'), type: 'boolean' },
  ],
  Licht: [
    {
      key: 'fixtureType',
      label: L('Typ', 'Fixture type'),
      type: 'select',
      options: [opt('fresnel', 'Fresnel', 'Fresnel'), opt('par', 'PAR', 'PAR'), opt('profile', 'Profiler', 'Profile'), opt('movinghead', 'Moving Head', 'Moving head'), opt('ledpanel', 'LED-Panel', 'LED panel'), opt('floor', 'Floor/Flood', 'Floor/flood')],
    },
    { key: 'luminousFlux', label: L('Lichtstrom', 'Luminous flux'), type: 'number', unit: 'lm' },
    { key: 'colorTemp', label: L('Farbtemperatur', 'Colour temperature'), type: 'text', unit: 'K', placeholder: '3200 / 2700-6500' },
    { key: 'cri', label: L('Farbwiedergabe (CRI/TLCI)', 'CRI/TLCI'), type: 'number' },
    { key: 'beamAngle', label: L('Abstrahlwinkel', 'Beam angle'), type: 'text', unit: '°', placeholder: '15-60' },
    { key: 'dmxChannels', label: L('DMX-Kanäle', 'DMX channels'), type: 'number' },
    { key: 'dmxAddress', label: L('DMX-Adresse', 'DMX address'), type: 'number' },
  ],
  Audio: [
    {
      key: 'audioType',
      label: L('Typ', 'Type'),
      type: 'select',
      options: [opt('mic', 'Mikrofon', 'Microphone'), opt('speaker', 'Lautsprecher', 'Loudspeaker'), opt('amp', 'Endstufe', 'Amplifier'), opt('mixer', 'Mischpult', 'Mixer'), opt('di', 'DI-Box', 'DI box')],
    },
    {
      key: 'polarPattern',
      label: L('Richtcharakteristik', 'Polar pattern'),
      type: 'select',
      options: [opt('omni', 'Kugel', 'Omni'), opt('cardioid', 'Niere', 'Cardioid'), opt('super', 'Superniere', 'Supercardioid'), opt('fig8', 'Acht', 'Figure-8')],
    },
    {
      key: 'transducer',
      label: L('Wandlerprinzip', 'Transducer'),
      type: 'select',
      options: [opt('condenser', 'Kondensator', 'Condenser'), opt('dynamic', 'Dynamisch', 'Dynamic'), opt('ribbon', 'Bändchen', 'Ribbon')],
    },
    {
      key: 'powering',
      label: L('Speisung', 'Powering'),
      type: 'select',
      options: [opt('p48', '48V Phantom', '48V phantom'), opt('tpower', 'T-Power', 'T-power'), opt('plugin', 'Plug-in', 'Plug-in'), opt('none', 'keine', 'none')],
    },
    { key: 'channels', label: L('Kanäle', 'Channels'), type: 'number' },
    { key: 'impedanceOhm', label: L('Impedanz', 'Impedance'), type: 'number', unit: 'Ω' },
    { key: 'sampleRate', label: L('Abtastrate', 'Sample rate'), type: 'text', unit: 'kHz', placeholder: '48 / 96' },
  ],
  Netzwerk: [
    {
      key: 'managed',
      label: L('Management', 'Management'),
      type: 'select',
      options: [opt('unmanaged', 'Unmanaged', 'Unmanaged'), opt('l2', 'Managed L2', 'Managed L2'), opt('l3', 'Managed L3', 'Managed L3')],
    },
    { key: 'poeBudgetW', label: L('PoE-Budget', 'PoE budget'), type: 'number', unit: 'W' },
    {
      key: 'poeStandard',
      label: L('PoE-Standard', 'PoE standard'),
      type: 'select',
      options: [opt('none', 'keine', 'none'), opt('af', '802.3af', '802.3af'), opt('at', '802.3at', '802.3at'), opt('bt', '802.3bt', '802.3bt')],
    },
    { key: 'switchingGbps', label: L('Switching-Kapazität', 'Switching capacity'), type: 'number', unit: 'Gbit/s' },
    { key: 'portSpeeds', label: L('Ports / Speeds', 'Ports / speeds'), type: 'text', placeholder: '48x1G + 4x10G SFP+' },
  ],
  Strom: [
    {
      key: 'phases',
      label: L('Phasen', 'Phases'),
      type: 'select',
      options: [opt('1p', '1~ (230V)', '1~ (230V)'), opt('3p', '3~ (400V)', '3~ (400V)')],
    },
    { key: 'maxCurrentA', label: L('max. Strom', 'Max. current'), type: 'number', unit: 'A' },
    {
      key: 'powerConnector',
      label: L('Anschluss', 'Connector'),
      type: 'select',
      options: [opt('schuko', 'Schuko', 'Schuko'), opt('iec', 'IEC C13/14', 'IEC C13/14'), opt('powercon', 'powerCON', 'powerCON'), opt('cee16', 'CEE16', 'CEE16'), opt('cee32', 'CEE32', 'CEE32'), opt('cee63', 'CEE63', 'CEE63'), opt('powerlock', 'Powerlock', 'Powerlock'), opt('socapex', 'Socapex', 'Socapex')],
    },
    { key: 'upsRuntimeMin', label: L('USV-Laufzeit', 'UPS runtime'), type: 'number', unit: 'min' },
    { key: 'powerFactor', label: L('Leistungsfaktor (cos φ)', 'Power factor (cos φ)'), type: 'number' },
  ],
  // #393 — Monitor-Fachfelder zusätzlich zu Auflösung/Diagonale
  // (die bleiben im DisplayPropertiesBlock).
  Monitore: [
    {
      key: 'panelType',
      label: L('Panel-Typ', 'Panel type'),
      type: 'select',
      options: [opt('oled', 'OLED', 'OLED'), opt('lcdips', 'LCD-IPS', 'LCD-IPS'), opt('ledwall', 'LED-Wall', 'LED wall'), opt('tft', 'LCD-TFT', 'LCD-TFT')],
    },
    {
      key: 'hdr',
      label: L('HDR', 'HDR'),
      type: 'select',
      options: [opt('none', 'keine', 'none'), opt('hdr10', 'HDR10', 'HDR10'), opt('hlg', 'HLG', 'HLG'), opt('pq', 'PQ', 'PQ'), opt('dolby', 'Dolby Vision', 'Dolby Vision')],
    },
    { key: 'brightnessNits', label: L('Helligkeit', 'Brightness'), type: 'number', unit: 'nits' },
    { key: 'refreshHz', label: L('Bildrate', 'Refresh rate'), type: 'number', unit: 'Hz' },
    {
      key: 'colorSpace',
      label: L('Farbraum / Kalibrierung', 'Colour space / calibration'),
      type: 'select',
      options: [opt('rec709', 'Rec.709', 'Rec.709'), opt('rec2020', 'Rec.2020', 'Rec.2020'), opt('dcip3', 'DCI-P3', 'DCI-P3'), opt('srgb', 'sRGB', 'sRGB')],
    },
    { key: 'reference', label: L('Class-1 / Referenz', 'Class-1 / reference'), type: 'boolean' },
  ],
  // #394 — Stativ-/Support-Mechanik (Traglast/WLL, Höhe, Kopf, Gewicht).
  Stative: [
    { key: 'payloadKg', label: L('Traglast / WLL', 'Payload / WLL'), type: 'number', unit: 'kg' },
    { key: 'heightRange', label: L('Höhenbereich', 'Height range'), type: 'text', unit: 'm', placeholder: '0.7-2.1' },
    {
      key: 'headType',
      label: L('Stativkopf-Typ', 'Head type'),
      type: 'select',
      options: [opt('fluid', 'Fluid', 'Fluid'), opt('bowl75', 'Schale 75 mm', 'Bowl 75 mm'), opt('bowl100', 'Schale 100 mm', 'Bowl 100 mm'), opt('flat', 'Flat-Base', 'Flat base')],
    },
    { key: 'weightKg', label: L('Eigengewicht', 'Weight'), type: 'number', unit: 'kg' },
  ],
  // #394 — Rigging/Traversen (WLL + Eigengewicht fliessen in #351).
  Rigging: [
    { key: 'wllKg', label: L('Traglast / WLL', 'WLL'), type: 'number', unit: 'kg' },
    {
      key: 'riggingType',
      label: L('Typ', 'Type'),
      type: 'select',
      options: [opt('truss', 'Traverse', 'Truss'), opt('hoist', 'Motor/Kettenzug', 'Hoist'), opt('clamp', 'Schelle/Clamp', 'Clamp'), opt('bumper', 'Bumper/Frame', 'Bumper/frame'), opt('steel', 'Stahlseil/Schäkel', 'Steel/shackle')],
    },
    { key: 'weightKg', label: L('Eigengewicht', 'Weight'), type: 'number', unit: 'kg' },
  ],
}

const norm = (s: string) => s.trim().toLowerCase()

const BY_LC: Record<string, CategoryFieldDef[]> = {}
for (const [k, v] of Object.entries(CATEGORY_SCHEMAS)) BY_LC[norm(k)] = v

/** EN-Anzeigenamen der DEFAULT_CATEGORIES → canonical DE-Schlüssel. */
const EN_ALIAS: Record<string, string> = {
  cameras: 'kameras',
  lenses: 'objektive',
  lighting: 'licht',
  audio: 'audio',
  networking: 'netzwerk',
  power: 'strom',
  monitors: 'monitore',
  tripods: 'stative',
}

/** Feld-Schema für eine Kategorie (case-insensitiv, DE + EN). Leeres Array = keine Fachfelder. */
export const schemaForCategory = (category: string | undefined): CategoryFieldDef[] => {
  if (!category) return []
  const lc = norm(category)
  return BY_LC[lc] ?? BY_LC[EN_ALIAS[lc] ?? ''] ?? []
}
