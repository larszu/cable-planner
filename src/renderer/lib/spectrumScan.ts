// ───────────────────────────────────────────────────────────────────────────
// Der Scan vor Ort, gegen den Plan gehalten (Bedarf 112, P3).
//
// Die Begründung und die Grenze stehen in `types/spectrumScan.ts`. Hier steht
// die Mechanik, und sie ist rein: keine Uhr, kein Store, kein IO.
//
// ─── DIE EINE REGEL, DIE DIESES MODUL TRÄGT ────────────────────────────────
//
// „Nicht gemessen" ist NICHT „frei". Ein Scan von 470–608 MHz sagt über
// 614 MHz gar nichts, und die Antwort darauf ist ein drittes Urteil und keine
// Beruhigung. Genau dieselbe Regel wie beim Spektrum-Plan selbst (Bedarf 95):
// eine Rechnung, die drei von acht Sendern nicht kennt, sagt „frei" und meint
// „ich habe nicht nachgesehen".
// ───────────────────────────────────────────────────────────────────────────

import type { CarrierVerdict, ScanPoint, SpectrumScan } from '../types/spectrumScan'
import { DEFAULT_OCCUPIED_DBM, VERDICT_LABEL } from '../types/spectrumScan'
import type { SpectrumEntry } from './spectrumPlan'
import { SPECTRUM_SOURCE_LABEL } from './spectrumPlan'
import type { CsvCell, CsvTable } from './csv'

// Klammern gehören mit weg: Analyser schreiben ihre Einheit als „Frequency
// (Hz)", und eine Normalisierung, die die Klammern stehen lässt, findet die
// Spalte nicht — die Datei gilt dann als unlesbar, obwohl sie mustergültig
// ist.
const norm = (s: string): string => s.trim().toLowerCase().replace(/[\s_\-.()[\]]/g, '')

/**
 * Überschriften, die als Frequenz- bzw. Pegel-Spalte gelten.
 *
 * Verglichen wird mit ANFANG und nicht auf Gleichheit: die Einheit hängt
 * hinten dran („frequencykhz", „leveldbm"), und jede Schreibweise einzeln
 * aufzuzählen hiesse, bei der nächsten Analyser-Firmware wieder eine zu
 * vergessen.
 */
export const FREQ_ALIASES = ['frequency', 'freq', 'frequenz', 'mhz', 'khz', 'ghz', 'hz']
export const LEVEL_ALIASES = ['level', 'dbm', 'pegel', 'amplitude', 'power', 'value']

const matchesAlias = (header: string, aliases: readonly string[]): boolean =>
  aliases.some((a) => header === a || header.startsWith(a))

const splitLine = (line: string, delim: string): string[] =>
  line.split(delim).map((c) => c.trim().replace(/^"(.*)"$/s, '$1'))

const detectDelimiter = (text: string): string => {
  const kopf = text.split(/\r?\n/, 1)[0] ?? ''
  const semi = kopf.match(/;/g)?.length ?? 0
  const komma = kopf.match(/,/g)?.length ?? 0
  const tab = kopf.match(/\t/g)?.length ?? 0
  if (tab >= semi && tab >= komma && tab > 0) return '\t'
  return semi >= komma ? ';' : ','
}

/**
 * Eine Zahl aus einer Zelle — mit deutschem ODER englischem Dezimaltrennzeichen.
 *
 * `null` heisst „keine Zahl". Ein `NaN` durchzureichen wäre schlimmer: es
 * rechnet in jedem Vergleich falsch, ohne je aufzufallen.
 */
export function parseNumber(cell: string | undefined): number | null {
  if (cell === undefined) return null
  const t = cell.trim()
  if (!t) return null
  // Der ZULETZT stehende Trenner ist der Dezimaltrenner: „1.234,5" ist
  // deutsch (Punkt gruppiert), „1,234.5" englisch (Komma gruppiert), und
  // „1,5" ist deutsch. Die frühere Regel „Komma nur ohne Punkt daneben" las
  // „1.234,5" als 1,2345 — eine Frequenz um drei Zehnerpotenzen daneben, die
  // in keiner Prüfung auffällt, weil sie eine gültige Zahl ist.
  const letzterPunkt = t.lastIndexOf('.')
  const letztesKomma = t.lastIndexOf(',')
  const bereinigt =
    letztesKomma > letzterPunkt
      ? t.replace(/\./g, '').replace(',', '.')
      : t.replace(/,/g, '')
  const n = Number(bereinigt)
  return Number.isFinite(n) ? n : null
}

/**
 * Frequenz einer Zelle in MHz, gemessen an der Spalten-Überschrift.
 *
 * Analyser schreiben ihre Frequenzspalte mal in Hz (tinySA-Voreinstellung),
 * mal in MHz. Welche Einheit gilt, steht in der ÜBERSCHRIFT und wird nicht
 * an der Grössenordnung geraten: eine Datei mit „500000000" wäre in MHz
 * gelesen eine halbe Milliarde MHz, und eine Datei mit „500" in Hz gelesen
 * eine halbe Millisekunde Funk. Beides fiele auf. Der gefährliche Fall ist
 * ein Scan im GHz-Bereich, dessen Zahlen in beiden Einheiten plausibel
 * aussehen — deshalb: die Überschrift entscheidet, sonst MHz.
 */
export function toMhz(value: number, headerNorm: string): number {
  if (headerNorm.includes('khz')) return value / 1000
  if (headerNorm.includes('ghz')) return value * 1000
  if (headerNorm.includes('mhz')) return value
  // „hz" ohne Präfix — aber erst prüfen, ob nicht doch „mhz"/„khz"/„ghz"
  // gemeint war; die drei sind oben schon weg.
  if (headerNorm.includes('hz')) return value / 1_000_000
  return value
}

/**
 * Liest eine Analyser-CSV.
 *
 * Tolerant wie die Dante-Matrix (Bedarf 94): Spalten über die Überschrift,
 * Trenner erkannt, unlesbare Zeilen GEZÄHLT statt verschwiegen. Zusätzlich
 * kommt hier eine Datei ganz OHNE Überschrift vor — tinySA schreibt in seiner
 * schlanken Einstellung nur Zahlenpaare. Dann gilt: erste Spalte Frequenz,
 * zweite Pegel, Einheit MHz. Das ist eine Annahme, und sie steht deshalb im
 * Ergebnis nicht als Gewissheit, sondern als das, was `unreadable` und die
 * gemessene Spanne dem Leser zeigen.
 */
export function parseScanCsv(text: string, fileName?: string): SpectrumScan {
  const delim = detectDelimiter(text)
  const zeilen = text.split(/\r?\n/).filter((z) => z.trim() !== '')
  if (zeilen.length === 0) return { points: [], unreadable: 0, ...(fileName ? { fileName } : {}) }

  const kopf = splitLine(zeilen[0], delim).map(norm)
  let iFreq = kopf.findIndex((h) => matchesAlias(h, FREQ_ALIASES))
  // Kein Schutz gegen „beide Spalten sind dieselbe": die beiden Alias-Listen
  // sind disjunkt, und keine ist Praefix einer der anderen — geprueft in
  // `tests/spectrumScan.test.ts`. Ein Schutz, der nie greifen kann, behauptet
  // eine Gefahr, die es nicht gibt, und verdeckt die Bedingung, die ihn
  // ueberfluessig macht.
  let iLevel = kopf.findIndex((h) => matchesAlias(h, LEVEL_ALIASES))
  let freqHeader = iFreq >= 0 ? kopf[iFreq] : 'mhz'
  let datenAb = 1

  // Keine Überschrift erkannt: Zahlenpaare, erste Spalte Frequenz in MHz.
  if (iFreq < 0 || iLevel < 0) {
    const ersteIstZahl = parseNumber(splitLine(zeilen[0], delim)[0]) !== null
    if (!ersteIstZahl) {
      // Es GIBT eine Überschrift, sie nennt aber keine der beiden Spalten.
      // Dann ist die Datei nicht lesbar — und jede Datenzeile wird gezählt,
      // damit „0 Punkte" nicht wie ein leeres Band aussieht.
      return {
        points: [],
        unreadable: zeilen.length - 1,
        ...(fileName ? { fileName } : {}),
      }
    }
    iFreq = 0
    iLevel = 1
    freqHeader = 'mhz'
    datenAb = 0
  }

  const points: ScanPoint[] = []
  let unreadable = 0
  for (let i = datenAb; i < zeilen.length; i++) {
    const z = splitLine(zeilen[i], delim)
    const f = parseNumber(z[iFreq])
    const l = parseNumber(z[iLevel])
    if (f === null || l === null) {
      unreadable++
      continue
    }
    points.push({ mhz: toMhz(f, freqHeader), dbm: l })
  }
  points.sort((a, b) => a.mhz - b.mhz)
  return { points, unreadable, ...(fileName ? { fileName } : {}) }
}

/** Die gemessene Spanne. `null` bei leerem Scan — kein „0 bis 0". */
export function scannedRange(scan: SpectrumScan): { fromMhz: number; toMhz: number } | null {
  if (scan.points.length === 0) return null
  return { fromMhz: scan.points[0].mhz, toMhz: scan.points[scan.points.length - 1].mhz }
}

/**
 * Der höchste gemessene Pegel im Fenster um eine Frequenz.
 *
 * Das Fenster ist nötig, weil ein Scan diskret ist: er hat einen Punkt bei
 * 502,3 und einen bei 502,4, aber keinen bei genau 502,375. Ohne Fenster
 * fände eine Trägerprüfung nie einen Messpunkt und meldete jede Frequenz als
 * ungemessen.
 *
 * `null` heisst: ausserhalb des gemessenen Bereichs.
 */
export function peakNear(
  scan: SpectrumScan,
  mhz: number,
  windowMhz: number,
): number | null {
  // Kein eigener Bereichs-Check: die Schleife darunter liefert fuer eine
  // Frequenz ausserhalb ohnehin `null`, weil kein Punkt ins Fenster faellt.
  // Der Check waere eine zweite Stelle, an der „ausserhalb" definiert ist —
  // und zwei Definitionen desselben Begriffs gehen irgendwann auseinander.
  let max: number | null = null
  for (const p of scan.points) {
    if (Math.abs(p.mhz - mhz) > windowMhz) continue
    if (max === null || p.dbm > max) max = p.dbm
  }
  return max
}

/** Was ein geplanter Träger gegenüber der Messung ist. */
export interface CarrierCheck {
  entry: SpectrumEntry
  verdict: CarrierVerdict
  /** Höchster gemessener Pegel im Fenster; fehlt bei `not-scanned`. */
  peakDbm?: number
}

/**
 * Jeden geplanten Träger gegen die Messung halten.
 *
 * Drei Urteile, und das dritte ist der Grund für dieses Modul: „nicht
 * gemessen" ist keine Entwarnung. Ein Scan von 470–608 MHz sagt über 614 MHz
 * gar nichts.
 */
export function checkCarriers(
  scan: SpectrumScan,
  entries: readonly SpectrumEntry[],
  occupiedDbm: number = DEFAULT_OCCUPIED_DBM,
  windowMhz = 0.1,
): CarrierCheck[] {
  return entries.map((entry) => {
    const peak = peakNear(scan, entry.mhz, windowMhz)
    if (peak === null) return { entry, verdict: 'not-scanned' as const }
    return {
      entry,
      verdict: peak >= occupiedDbm ? ('occupied' as const) : ('clear' as const),
      peakDbm: peak,
    }
  })
}

// ── Befunde ────────────────────────────────────────────────────────────────

export type ScanFindingKind = 'carrier-occupied' | 'outside-scan' | 'nothing-readable' | 'partial-read'

export const SCAN_FINDING_LABEL: Readonly<Record<ScanFindingKind, string>> = {
  'carrier-occupied': 'Geplanter Träger sitzt auf gemessener Energie',
  'outside-scan': 'Träger ausserhalb des gemessenen Bereichs',
  'nothing-readable': 'Keine Zeile der Datei war lesbar',
  'partial-read': 'Ein Teil der Datei war nicht lesbar',
}

export interface ScanFinding {
  kind: ScanFindingKind
  text: string
  entryIds: string[]
}

export function scanFindings(
  scan: SpectrumScan,
  checks: readonly CarrierCheck[],
  occupiedDbm: number = DEFAULT_OCCUPIED_DBM,
): ScanFinding[] {
  const out: ScanFinding[] = []

  if (scan.points.length === 0) {
    out.push({
      kind: 'nothing-readable',
      entryIds: [],
      text: `Aus dieser Datei liess sich kein Messpunkt lesen (${scan.unreadable} Zeile(n) verworfen). Ohne Messung steht bei jedem Träger „${VERDICT_LABEL['not-scanned']}" — und das ist die ehrliche Antwort, nicht „frei".`,
    })
    return out
  }

  if (scan.unreadable > 0) {
    out.push({
      kind: 'partial-read',
      entryIds: [],
      text: `${scan.unreadable} Zeile(n) der Datei waren nicht lesbar. Die Messung ist damit lückenhaft; eine Lücke sieht im Verlauf aus wie ein freies Band.`,
    })
  }

  const belegt = checks.filter((c) => c.verdict === 'occupied')
  if (belegt.length > 0) {
    out.push({
      kind: 'carrier-occupied',
      entryIds: belegt.map((c) => c.entry.id),
      text: `${belegt.length} geplante(r) Träger liegen auf gemessener Energie über ${occupiedDbm} dBm: ${belegt.map((c) => `${c.entry.label} (${c.entry.mhz} MHz)`).join(', ')}. Was dort sitzt, sagt die Messung nicht — nur, dass etwas sitzt.`,
    })
  }

  const draussen = checks.filter((c) => c.verdict === 'not-scanned')
  if (draussen.length > 0) {
    const spanne = scannedRange(scan)
    out.push({
      kind: 'outside-scan',
      entryIds: draussen.map((c) => c.entry.id),
      text: `${draussen.length} Träger liegen ausserhalb des gemessenen Bereichs${spanne ? ` (${spanne.fromMhz}–${spanne.toMhz} MHz)` : ''}. Für sie sagt dieser Scan nichts — „${VERDICT_LABEL['not-scanned']}" ist kein „frei".`,
    })
  }

  return out
}

// ── Blätter ────────────────────────────────────────────────────────────────

/**
 * Der Abgleich als Tabelle.
 *
 * Das ist die Ausgabe, die der Beleg als Hersteller-Format wünscht — und die
 * hier bewusst eine dokumentierte Tabelle ist. Warum, steht in
 * `types/spectrumScan.ts`.
 */
export function carrierCheckTable(checks: readonly CarrierCheck[]): CsvTable {
  return {
    headers: ['Was funkt', 'Quelle', 'Frequenz (MHz)', 'Urteil', 'Spitzenpegel (dBm)'],
    rows: checks.map((c): CsvCell[] => [
      c.entry.label,
      SPECTRUM_SOURCE_LABEL[c.entry.source],
      c.entry.mhz,
      VERDICT_LABEL[c.verdict],
      c.peakDbm === undefined ? VERDICT_LABEL['not-scanned'] : c.peakDbm,
    ]),
  }
}

/** Die Messpunkte selbst — für das Archiv und für fremde Werkzeuge. */
export function scanTable(scan: SpectrumScan): CsvTable {
  return {
    headers: ['Frequenz (MHz)', 'Pegel (dBm)'],
    rows: scan.points.map((p): CsvCell[] => [p.mhz, p.dbm]),
  }
}
