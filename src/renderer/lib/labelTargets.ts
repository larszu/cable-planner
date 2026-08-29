// ADR-001, Inkrement 1 — Zeichenbudgets externer Systeme an EINER Stelle.
//
// Jedes System, an das der Plan Namen abgibt, hat ein eigenes, hartes Limit:
// der ATEM speichert 20 Byte Langname und 4 Byte Kurzname, TSL-UMD v3.1
// transportiert genau 16 ASCII-Zeichen pro Display, Dante erlaubt 31 Zeichen
// aus einem engen Zeichensatz. Bisher lagen diese Zahlen als verstreute
// `slice(0, n)`-Aufrufe in den Emittern — jeder Aufruf schnitt still ab, und
// ob zwei Geraete nach dem Abschneiden denselben Text tragen, fiel erst auf
// dem Multiviewer auf.
//
// Diese Tabelle macht daraus einen pruefbaren Fakt. Sie persistiert nichts und
// kennt keine Domaenen-Typen: rein Text rein, Text raus. Die Zuordnung
// „welches Geraet spricht mit welchem Ziel" liegt in `labelDerivation.ts`.
//
// AUFNAHMEKRITERIUM: Ein Ziel kommt nur mit einem BELEGTEN Budget in die
// Tabelle (`source` nennt den Beleg). Green-GO-Kanalnamen z. B. fehlen hier
// bewusst — fuer sie ist kein Limit belegt, und eine geratene Zahl waere
// schlechter als gar keine, weil sie Befunde erzeugt, die niemand nachpruefen
// kann.

import { DANTE_MAX_LENGTH } from './danteNaming'

export type LabelTargetId =
  | 'atem-input-long'
  | 'atem-input-short'
  | 'videohub-label'
  | 'tsl-umd-v31'
  | 'dante-device'

/** In welcher Einheit das Zielsystem sein Limit zaehlt. */
export type BudgetUnit = 'chars' | 'bytes'

export interface LabelTargetSpec {
  id: LabelTargetId
  /** Zielsystem, wie es im Befund genannt wird ("ATEM", "Videohub"). */
  system: string
  /** Feld im Zielsystem ("Langname", "Port-Label"). */
  field: string
  /** Hartes Limit. `null` = das Ziel dokumentiert keins. */
  budget: number | null
  budgetUnit: BudgetUnit
  /** true: alles ausserhalb 0x20–0x7E ist im Zielformat nicht darstellbar. */
  asciiOnly: boolean
  /** Zeichen, die das Transportformat selbst zerlegen wuerden. */
  forbidden?: RegExp
  /** false: das Ziel unterscheidet Gross-/Kleinschreibung NICHT — "CAM1" und
   *  "cam1" landen dort auf demselben Eintrag. */
  caseSensitive: boolean
  /** Woher das Limit stammt. Steht hier fuer die Review, nicht fuer die UI. */
  source: string
}

export const LABEL_TARGETS: Record<LabelTargetId, LabelTargetSpec> = {
  'atem-input-long': {
    id: 'atem-input-long',
    system: 'ATEM',
    field: 'Langname',
    budget: 20,
    budgetUnit: 'bytes',
    asciiOnly: true,
    caseSensitive: true,
    source:
      'ATEM-Protokoll: InCm-Block traegt den Langnamen als 20-Byte-Feld. ' +
      'Gleiche Zahl bereits im Kommentar von lib/portLabel.ts.',
  },
  'atem-input-short': {
    id: 'atem-input-short',
    system: 'ATEM',
    field: 'Kurzname',
    budget: 4,
    budgetUnit: 'bytes',
    asciiOnly: true,
    caseSensitive: true,
    source:
      'ATEM-Protokoll: InCm-Block traegt den Kurznamen als 4-Byte-Feld. ' +
      'Der Kurzname ist das, was Multiviewer-Fenster beschriftet.',
  },
  'videohub-label': {
    id: 'videohub-label',
    system: 'Videohub',
    field: 'Port-Label',
    // Das Videohub-Ethernet-Protokoll definiert KEINE Maximallaenge fuer
    // Labels — nur die Front-Panel-Anzeige kuerzt. Wir erfinden hier keine
    // Zahl, pruefen aber das Transportformat.
    budget: null,
    budgetUnit: 'chars',
    asciiOnly: false,
    // lib/exportVideohub.ts schreibt "Input, <n>, <label>" zeilenweise —
    // ein Komma oder Zeilenumbruch im Label zerlegt genau diese Datei.
    forbidden: /[,\r\n]/,
    caseSensitive: true,
    source:
      'Kein dokumentiertes Laengenlimit im Videohub-Ethernet-Protokoll. ' +
      'Die Zeichen-Einschraenkung folgt aus dem Labels.txt-Format in ' +
      'lib/exportVideohub.ts (Komma-getrennt, zeilenbasiert).',
  },
  'tsl-umd-v31': {
    id: 'tsl-umd-v31',
    system: 'TSL UMD v3.1',
    field: 'Display-Text',
    budget: 16,
    budgetUnit: 'bytes',
    asciiOnly: true,
    caseSensitive: true,
    source:
      'TSL-UMD-Protokoll v3.1: Nachricht ist 18 Byte — 1 Adress-, 1 Steuer- ' +
      'und exakt 16 Zeichen Display-Daten (7-Bit-ASCII).',
  },
  'dante-device': {
    id: 'dante-device',
    system: 'Dante',
    field: 'Geraetename',
    budget: DANTE_MAX_LENGTH,
    budgetUnit: 'chars',
    asciiOnly: true,
    // DNS-SD-Regeln: nur a-z, A-Z, 0-9 und Bindestrich (lib/danteNaming.ts).
    forbidden: /[^a-zA-Z0-9-]/,
    // mDNS-Namen werden case-insensitiv aufgeloest: "Cam-1" und "cam-1"
    // sind im selben Netz derselbe Name.
    caseSensitive: false,
    source:
      'Audinate-Namensregeln (1–31 Zeichen, DNS-SD-konform) — dieselbe ' +
      'Konstante wie lib/danteNaming.ts, nicht dupliziert.',
  },
}

export const allLabelTargets = (): LabelTargetSpec[] => Object.values(LABEL_TARGETS)

/** UTF-8-Bytelaenge eines Strings — ein Umlaut kostet 2, ein Emoji 4. */
export const utf8Length = (text: string): number => {
  let bytes = 0
  for (const ch of text) {
    const cp = ch.codePointAt(0) ?? 0
    if (cp < 0x80) bytes += 1
    else if (cp < 0x800) bytes += 2
    else if (cp < 0x10000) bytes += 3
    else bytes += 4
  }
  return bytes
}

const measure = (text: string, unit: BudgetUnit): number =>
  unit === 'bytes' ? utf8Length(text) : [...text].length

/**
 * Schneidet auf das Budget ab, OHNE ein Mehr-Byte-Zeichen zu zerlegen: es
 * werden ganze Code-Points genommen, solange sie noch ins Budget passen.
 */
const clampToBudget = (text: string, spec: LabelTargetSpec): string => {
  if (spec.budget === null) return text
  const chars = [...text]
  let used = 0
  let out = ''
  for (const ch of chars) {
    const cost = spec.budgetUnit === 'bytes' ? utf8Length(ch) : 1
    if (used + cost > spec.budget) break
    used += cost
    out += ch
  }
  return out
}

export interface FittedLabel {
  targetId: LabelTargetId
  /** Text, den der Plan liefern will (nach der Aufbereitung des Exporters). */
  raw: string
  /** Text, wie er IM PLAN steht — vor jeder Aufbereitung. Daran wird
   *  gemessen, ob zwei Eintraege ueberhaupt unterschiedlich gemeint sind:
   *  "1 SDI 3G" und "2 SDI 3G" sind es, ihre ATEM-Aufbereitung ("3G") nicht
   *  mehr. Ohne diese Trennung verschluckt die Kollisionspruefung genau die
   *  Faelle, fuer die es sie gibt. Default: `raw`. */
  origin: string
  /** Text, den das Zielsystem tatsaechlich speichert. */
  value: string
  /** true wenn `value` kuerzer ist als `raw`. */
  truncated: boolean
  /** Zeichen aus `raw`, die das Ziel nicht transportieren kann (dedupliziert,
   *  in Vorkommensreihenfolge). */
  invalidChars: string[]
  /** Verbrauch in der Einheit des Ziels — auch wenn kein Budget existiert. */
  used: number
}

/**
 * Bildet einen Wunschtext auf das ab, was beim Ziel wirklich ankommt.
 * Reine Funktion, kein Zustand, keine Domaenen-Typen.
 */
export const fitToTarget = (
  raw: string,
  spec: LabelTargetSpec,
  origin?: string,
): FittedLabel => {
  const text = raw ?? ''
  const invalid: string[] = []
  const seen = new Set<string>()
  for (const ch of text) {
    const cp = ch.codePointAt(0) ?? 0
    const badAscii = spec.asciiOnly && (cp < 0x20 || cp > 0x7e)
    const badFormat = spec.forbidden?.test(ch) ?? false
    if ((badAscii || badFormat) && !seen.has(ch)) {
      seen.add(ch)
      invalid.push(ch)
    }
  }
  const value = clampToBudget(text, spec)
  return {
    targetId: spec.id,
    raw: text,
    origin: origin ?? text,
    value,
    truncated: value !== text,
    invalidChars: invalid,
    used: measure(text, spec.budgetUnit),
  }
}

/** Vergleichsform fuer die Kollisionspruefung. */
const foldFor = (value: string, spec: LabelTargetSpec): string =>
  spec.caseSensitive ? value : value.toLowerCase()

export interface LabelCollision {
  targetId: LabelTargetId
  /** Der Wert, auf dem mehrere unterschiedliche Wunschtexte landen. */
  value: string
  /** Mindestens zwei Eintraege mit UNTERSCHIEDLICHEM `raw`. */
  members: FittedLabel[]
}

/**
 * Findet Wunschtexte, die im Zielsystem ununterscheidbar werden.
 *
 * Gemeldet wird nur, was die ABBILDUNG verursacht hat: zwei verschiedene
 * Wunschtexte, ein Zielwert. Zwei Geraete, die schon im Plan gleich heissen,
 * sind ein anderer Befund (doppelter Name) und gehoeren nicht hierher — sonst
 * meldete jedes Ziel denselben Fehler noch einmal.
 */
export const collisionsForTarget = (
  fitted: FittedLabel[],
  spec: LabelTargetSpec,
): LabelCollision[] => {
  const byValue = new Map<string, FittedLabel[]>()
  for (const f of fitted) {
    if (f.value === '') continue
    const key = foldFor(f.value, spec)
    const list = byValue.get(key)
    if (list) list.push(f)
    else byValue.set(key, [f])
  }
  const out: LabelCollision[] = []
  for (const group of byValue.values()) {
    if (group.length < 2) continue
    // Unterschiedlichkeit wird an `origin` gemessen, also wie der PLAN sie
    // sieht (exakt) — der Zielwert daran, wie das ZIEL ihn sieht (ggf.
    // gefaltet). Genau dazwischen liegt der Verlust: "Cam-1" und "cam-1" sind
    // im Plan zwei Geraete und im Dante-Netz ein Name.
    const distinctOrigin = new Set(group.map((f) => f.origin))
    if (distinctOrigin.size < 2) continue
    out.push({ targetId: spec.id, value: group[0].value, members: group })
  }
  return out
}
