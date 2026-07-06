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

// 'polar-pattern' = Select mit zusätzlichem Polardiagramm-Preview (Mikrofone).
export type CategoryFieldType = 'text' | 'number' | 'select' | 'boolean' | 'polar-pattern'

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
  /** Vom User im Feld-Builder angelegt (nicht Built-in). Nur UI-Markierung —
   *  die Werte liegen wie bei Built-ins in `equipment.categoryProps`. */
  userDefined?: boolean
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
      options: [
        opt('omni', 'Kugel', 'Omni'),
        opt('cardioid', 'Niere', 'Cardioid'),
        opt('super', 'Superniere', 'Supercardioid'),
        opt('hyper', 'Hyperniere', 'Hypercardioid'),
        opt('fig8', 'Acht', 'Figure-8'),
        opt('shotgun', 'Keule (Shotgun)', 'Shotgun/lobar'),
        opt('boundary', 'Grenzfläche', 'Boundary/half-omni'),
        opt('multi', 'umschaltbar (Multipattern)', 'Switchable (multi-pattern)'),
      ],
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
  // #Mikrofonierung — vollständiges Mic-Datenblatt-Schema (eigene Kategorie, damit
  // die Detailfelder nicht an Lautsprechern/DI-Boxen erscheinen). Max SPL + Speisung
  // sind die zwei Werte, die im Drum-Kontext echte Fehler verhindern (Kondensator
  // ohne Phantom = tot; zu niedriger Max SPL an der Kick = Verzerrung).
  Mikrofone: [
    {
      key: 'transducer',
      label: L('Wandlerprinzip', 'Transducer'),
      type: 'select',
      options: [opt('condenser', 'Kondensator', 'Condenser'), opt('dynamic', 'Dynamisch', 'Dynamic'), opt('ribbon', 'Bändchen', 'Ribbon'), opt('electret', 'Elektret', 'Electret')],
    },
    {
      // DPA-Taxonomie (mic-university/technology/facts-about-polar-patterns).
      key: 'polarPattern',
      label: L('Richtcharakteristik', 'Polar pattern'),
      type: 'polar-pattern',
      options: [
        opt('omni', 'Kugel', 'Omni'),
        opt('sub', 'Breite Niere (Sub-/Wide)', 'Subcardioid / wide'),
        opt('cardioid', 'Niere', 'Cardioid'),
        opt('super', 'Superniere', 'Supercardioid'),
        opt('hyper', 'Hyperniere', 'Hypercardioid'),
        opt('fig8', 'Acht', 'Figure-8'),
        opt('shotgun', 'Keule (Shotgun)', 'Shotgun/lobar'),
        opt('boundary', 'Grenzfläche', 'Boundary/half-omni'),
        opt('multi', 'umschaltbar (Multipattern)', 'Switchable (multi-pattern)'),
      ],
    },
    {
      key: 'powering',
      label: L('Speisung', 'Powering'),
      type: 'select',
      options: [opt('p48', '48V Phantom', '48V phantom'), opt('tpower', 'T-Power (12V)', 'T-power (12V)'), opt('plugin', 'Plug-in-Power', 'Plug-in power'), opt('battery', 'Batterie', 'Battery'), opt('none', 'keine (dynamisch)', 'none (dynamic)')],
    },
    {
      key: 'capsule',
      label: L('Kapsel / Bauform', 'Capsule / form factor'),
      type: 'select',
      options: [
        opt('largeDiaphragm', 'Großmembran', 'Large-diaphragm'),
        opt('smallDiaphragm', 'Kleinmembran', 'Small-diaphragm'),
        opt('clip', 'Clip-/Instrumenten-Mic', 'Clip-on / instrument'),
        opt('boundary', 'Grenzfläche (PZM)', 'Boundary (PZM)'),
        opt('shotgun', 'Richtrohr (Shotgun)', 'Shotgun'),
        opt('lavalier', 'Lavalier / Ansteck', 'Lavalier'),
        opt('handheld', 'Handmikrofon', 'Handheld'),
      ],
    },
    {
      key: 'micApplication',
      label: L('typ. Einsatz', 'Typical use'),
      type: 'select',
      options: [
        opt('kick', 'Kick / Bassdrum', 'Kick / bass drum'),
        opt('snare', 'Snare', 'Snare'),
        opt('tom', 'Tom', 'Tom'),
        opt('overhead', 'Overhead / Becken', 'Overhead / cymbals'),
        opt('hihat', 'HiHat', 'Hi-hat'),
        opt('room', 'Raum', 'Room'),
        opt('percussion', 'Percussion', 'Percussion'),
        opt('bass', 'Bass / Bassamp', 'Bass / bass amp'),
        opt('guitar', 'Gitarre / Amp', 'Guitar / amp'),
        opt('vocal', 'Gesang / Sprache', 'Vocal / speech'),
        opt('instrument', 'Instrument (allg.)', 'Instrument (general)'),
        opt('broadcast', 'Broadcast / Reportage', 'Broadcast / field'),
      ],
    },
    { key: 'maxSplDb', label: L('max. Schalldruck (Max SPL)', 'Max SPL'), type: 'number', unit: 'dB SPL' },
    { key: 'freqResponse', label: L('Frequenzgang', 'Frequency response'), type: 'text', unit: 'Hz', placeholder: '20-20000 / 40-16000' },
    { key: 'sensitivity', label: L('Empfindlichkeit', 'Sensitivity'), type: 'text', unit: 'mV/Pa', placeholder: '2.0 / -54 dBV' },
    { key: 'selfNoiseDb', label: L('Eigenrauschen (A)', 'Self-noise (A)'), type: 'number', unit: 'dB-A' },
    { key: 'dynamicRangeDb', label: L('Dynamikumfang', 'Dynamic range'), type: 'number', unit: 'dB' },
    { key: 'impedanceOhm', label: L('Impedanz', 'Impedance'), type: 'number', unit: 'Ω' },
    // ── Klang & Charakter (v.a. Gesang) — DPA Mic-University ──────────────────
    {
      // Klangfarbe/Timbre-Signatur. Subjektiv, aber Standard-Vokabular der
      // Mic-Auswahl (warm/hell/präsent …). Quelle: DPA + Broadcast-Praxis.
      key: 'tonalCharacter',
      label: L('Klangfarbe / Timbre', 'Tonal character'),
      type: 'select',
      options: [
        opt('neutral', 'neutral / linear', 'Neutral / flat'),
        opt('warm', 'warm', 'Warm'),
        opt('dark', 'dunkel', 'Dark'),
        opt('bright', 'hell / offen', 'Bright / open'),
        opt('present', 'präsent (Präsenz-Anhebung)', 'Present (presence boost)'),
        opt('scooped', 'gescoopt (Mitten zurück)', 'Scooped mids'),
        opt('vintage', 'vintage / seidig', 'Vintage / silky'),
      ],
    },
    {
      // Off-Axis-Verfärbung ("curtain effect", DPA). Wie sauber klingt Schall
      // von der Seite/hinten — entscheidend für Live-Rückkopplungsfestigkeit.
      key: 'offAxisResponse',
      label: L('Off-Axis-Klang', 'Off-axis response'),
      type: 'select',
      options: [
        opt('smooth', 'sauber / gleichmäßig', 'Smooth / natural'),
        opt('slightColor', 'leicht verfärbt', 'Slightly coloured'),
        opt('colored', 'verfärbt (Curtain-Effekt)', 'Coloured (curtain effect)'),
      ],
    },
    {
      // Naheffekt (Proximity). Nur Druckgradienten-Mics; Acht > Hyper > Super >
      // Niere > breite Niere; Kugel keiner. Quelle: DPA proximity-effect.
      key: 'proximityEffect',
      label: L('Naheffekt (Proximity)', 'Proximity effect'),
      type: 'select',
      options: [
        opt('none', 'keiner (Kugel)', 'None (omni)'),
        opt('low', 'gering', 'Low'),
        opt('moderate', 'mittel', 'Moderate'),
        opt('strong', 'stark', 'Strong'),
      ],
    },
    { key: 'presenceBoost', label: L('Präsenz-Anhebung', 'Presence boost'), type: 'text', unit: 'kHz', placeholder: '5 kHz +4 dB' },
    { key: 'sonicSignature', label: L('Klang-Notiz', 'Sonic notes'), type: 'text', placeholder: 'z. B. seidige Höhen, straffer Bass' },
    { key: 'switchPad', label: L('Pad-Schalter', 'Pad switch'), type: 'boolean' },
    { key: 'switchLowcut', label: L('Low-Cut-Schalter', 'Low-cut switch'), type: 'boolean' },
    {
      key: 'connectorOut',
      label: L('Anschluss', 'Connector'),
      type: 'select',
      options: [opt('xlr', 'XLR-3', 'XLR-3'), opt('miniXlr', 'Mini-XLR (TA3)', 'Mini-XLR (TA3)'), opt('ta4', 'TA4 (Mini-XLR 4-pol)', 'TA4'), opt('jack', '6,3 mm Klinke', '1/4" jack'), opt('fixed', 'fest verkabelt', 'hardwired')],
    },
  ],
  // #Mischpult — Fachfelder jenseits der Port-Liste (Kapazität ≠ physische I/O).
  // Recherche: Sweetwater/ProSoundWeb Digital-Console-Vergleiche. Eigene
  // Kategorie, damit diese Felder NICHT an jedem Mikrofon erscheinen.
  Mischpult: [
    { key: 'mixChannels', label: L('Verarbeitungs-Kanäle', 'Processing channels'), type: 'number' },
    { key: 'mixBuses', label: L('Busse', 'Mix buses'), type: 'number' },
    { key: 'auxSends', label: L('Aux / Sends', 'Aux / sends'), type: 'number' },
    { key: 'matrix', label: L('Matrix', 'Matrix'), type: 'text', placeholder: '6x8' },
    { key: 'dcaGroups', label: L('DCA/VCA-Gruppen', 'DCA/VCA groups'), type: 'number' },
    { key: 'motorFaders', label: L('Motor-Fader', 'Motorised faders'), type: 'number' },
    { key: 'sceneMemory', label: L('Szenen-/Snapshot-Speicher', 'Scene/snapshot memory'), type: 'number' },
    {
      key: 'autoMix',
      label: L('Automix', 'Automix'),
      type: 'select',
      options: [opt('none', 'keiner', 'none'), opt('dugan', 'Dan Dugan', 'Dan Dugan'), opt('gain', 'Gain-Sharing', 'Gain-sharing'), opt('gate', 'Gate-basiert', 'Gate-based')],
    },
    { key: 'sampleRate', label: L('Abtastrate', 'Sample rate'), type: 'text', unit: 'kHz', placeholder: '48 / 96' },
    { key: 'latencyMs', label: L('Latenz', 'Latency'), type: 'number', unit: 'ms' },
    { key: 'ioCardSlots', label: L('I/O-Karten-Slots', 'I/O card slots'), type: 'number' },
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
  microphones: 'mikrofone',
  'mixing console': 'mischpult',
  networking: 'netzwerk',
  power: 'strom',
  monitors: 'monitore',
  tripods: 'stative',
}

// ── User-Feld-Overlay (EAV-/Dynamic-Schema-Pattern) ─────────────────────────
// Der Feld-Builder (Settings-Tab) macht aus dem hartkodierten Schema
// erweiterbare Daten: pro Kategorie kann der User eigene `CategoryFieldDef`
// hinzufügen. Diese Overlay-Map wird vom settingsStore beim Laden/Ändern
// gesetzt; `schemaForCategory` mischt Built-in + User-Felder. Die Werte selbst
// liegen unverändert in `equipment.categoryProps` (offener Beutel), sodass beim
// Löschen eines User-Felds keine Daten verloren gehen (MVR-Grundsatz).
export type UserSchemaMap = Record<string, CategoryFieldDef[]>

let userOverlay: UserSchemaMap = {}

/** Vom settingsStore aufgerufen. Schlüssel = kanonische (lowercase) Kategorie. */
export const setUserSchemaOverlay = (map: UserSchemaMap): void => {
  const normed: UserSchemaMap = {}
  for (const [k, v] of Object.entries(map ?? {})) normed[norm(k)] = v
  userOverlay = normed
}

/** Kanonischer (lowercase) Schlüssel einer Kategorie — für Overlay-Zugriff. */
export const canonicalCategoryKey = (category: string): string => {
  const lc = norm(category)
  return EN_ALIAS[lc] ?? lc
}

/** Nur die Built-in-Felder einer Kategorie (ohne User-Overlay). */
export const builtInSchemaForCategory = (category: string | undefined): CategoryFieldDef[] => {
  if (!category) return []
  const lc = norm(category)
  return BY_LC[lc] ?? BY_LC[EN_ALIAS[lc] ?? ''] ?? []
}

/**
 * Feld-Schema für eine Kategorie (case-insensitiv, DE + EN) inkl. User-Felder.
 * Built-in-Felder zuerst, dann User-Felder deren Key NICHT mit einem Built-in
 * kollidiert (Built-in gewinnt — der Builder validiert das zusätzlich).
 * Leeres Array = keine Fachfelder.
 */
export const schemaForCategory = (category: string | undefined): CategoryFieldDef[] => {
  if (!category) return []
  const builtIn = builtInSchemaForCategory(category)
  const extra = userOverlay[canonicalCategoryKey(category)] ?? []
  if (extra.length === 0) return builtIn
  const seen = new Set(builtIn.map((f) => f.key))
  const merged = [...builtIn]
  for (const f of extra) {
    if (!seen.has(f.key)) {
      seen.add(f.key)
      merged.push({ ...f, userDefined: true })
    }
  }
  return merged
}

/**
 * #373 — Fachdaten eines Geräts als lesbarer String fürs BOM/Export/Print
 * ("Brennweite: 17-120 mm · Anschluss: PL"). Labels + Select-Optionen + Einheit
 * sprach-aufgelöst, Schema-Reihenfolge. Leerer String, wenn keine Fachdaten
 * gesetzt sind oder die Kategorie kein Schema hat.
 */
export const formatCategoryProps = (
  category: string | undefined,
  props: Record<string, string | number | boolean> | undefined,
  lang: Lang,
): string => {
  if (!props || Object.keys(props).length === 0) return ''
  const schema = schemaForCategory(category)
  if (schema.length === 0) return ''
  const parts: string[] = []
  for (const f of schema) {
    const v = props[f.key]
    if (v === undefined || v === '' || v === false) continue
    let val: string
    if (f.type === 'boolean') val = lang === 'de' ? 'ja' : 'yes'
    else if ((f.type === 'select' || f.type === 'polar-pattern') && f.options) {
      val = f.options.find((o) => o.value === String(v))?.label[lang] ?? String(v)
    } else {
      val = String(v)
    }
    parts.push(`${f.label[lang]}: ${val}${f.unit ? ' ' + f.unit : ''}`)
  }
  return parts.join(' · ')
}
