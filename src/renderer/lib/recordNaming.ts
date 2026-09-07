// ───────────────────────────────────────────────────────────────────────────
// BEDARF 100 (P3) — „ISO/record naming driven from the plan rather than deck
// by deck, with VISIBLE FAILURE when it does not happen."
//
// Der Schaden, woertlich aus der Bedarfs-Datenbank:
//
//   > Take numbers are incremented by hand across 10-16 camera decks through
//   > each deck's config page; AUTOMATED FILENAME BUILDING FAILS SILENTLY
//   > WHILE THE BUTTON LABEL STILL RENDERS CORRECTLY.
//
// Belege: `bitfocus/companion-module-bmd-hyperdeck#40` (2021, offen — „Take01_
// Cam_01.mov, Take02_Cam_01.mov…", von Hand hochgezaehlt ueber zehn bis
// sechzehn Decks) und `#128` (2026 — das Deck nimmt nicht auf, wenn der
// Dateiname zusammengesetzt wird).
//
// ─── DER ZWEITE SATZ IST DER WICHTIGERE ────────────────────────────────────
//
// „Fails silently while the button label still renders correctly." Der
// Bedienknopf zeigt den richtigen Namen, das Deck schreibt nichts. Wer nur
// den Knopf ansieht, merkt es in der Post.
//
// Daraus folgt, was diese Datei tut: sie bildet den Namen, den das Geraet
// TATSAECHLICH bekaeme, und prueft ihn gegen das, was ein Deck annimmt. Ein
// Name, den ein HyperDeck ablehnt, faellt VOR der Show auf — als Befund mit
// dem Grund, nicht als leerer Slot hinterher.
//
// ─── EINE NUMMER FUER DAS PROJEKT, NICHT JE DECK ───────────────────────────
//
// `take` steht EINMAL am Namensschema und nicht an jedem Recorder. Genau das
// Hochzaehlen an sechzehn Konfigurationsseiten ist der Schaden aus dem Beleg;
// eine Nummer je Deck baute ihn nach — dann steht Kamera 4 auf Take 7,
// waehrend der Rest auf Take 8 laeuft, und in der Post passen die Ordner
// nicht mehr zusammen.
//
// ─── WAS HIER NICHT GEBAUT WIRD, UND WARUM NICHT ───────────────────────────
//
// KEIN PUSH AN DIE DECKS und KEINE ZUSTANDS-RUECKMELDUNG. Die Massnahme
// nennt beides („pushed to decks", „a record-state readback panel"), und
// beides braucht eine offene Verbindung zu jedem einzelnen Geraet. Diese
// Anwendung spricht das HyperDeck-Protokoll nicht, und eine
// Rueckmelde-Anzeige, die in Wahrheit nur den PLAN zeigt, waere exakt der
// Defekt des Belegs: eine Oberflaeche, die richtig aussieht, waehrend das
// Geraet nichts tut. Was hier entsteht, ist deshalb das ZETTEL-Aequivalent:
// je Deck der erwartete Name und die erwartete Quelle, zum Nachsehen am
// Geraet — und die Befunde, die man vor der Show abarbeitet.
//
// REIN: keine Uhr, kein Store, kein IO.
// ───────────────────────────────────────────────────────────────────────────
import type { CablePlannerProject } from '../types/project'
import { buildHandoverManifest, type HandoverRow } from './postHandover'
import {
  DEFAULT_RECORD_SCHEME,
  type RecordNameSegment,
  type RecordNamingScheme,
} from '../types/recordNaming'

export { DEFAULT_RECORD_SCHEME }
export type { RecordNamePart, RecordNameSegment, RecordNamingScheme } from '../types/recordNaming'

/**
 * Was in einem Aufnahme-Dateinamen stehen DARF.
 *
 * Eine Erlaubnis-Liste und keine Verbotsliste, und das ist der Punkt: eine
 * Liste verbotener Zeichen ist immer unvollstaendig, und was sie vergisst,
 * faellt genau so aus wie der Beleg es beschreibt — das Deck nimmt nicht auf,
 * und der Knopf sieht richtig aus. Erlaubt sind lateinische Buchstaben,
 * Ziffern, Unterstrich, Punkt, Plus und Bindestrich.
 *
 * ASCII UND NICHT `\p{L}`: ein Umlaut ueberlebt eine FAT-formatierte Karte
 * nicht zuverlaessig, und das Leerzeichen ist der haeufigste Fall von allen —
 * „Kamera 1" traegt eins, und es ist kein Formfehler, sondern der Grund,
 * warum ein zusammengesetzter Name abgelehnt werden kann.
 */
const NICHT_ERLAUBT = /[^A-Za-z0-9_.+-]/

/**
 * 96 Zeichen. Der Wert stammt NICHT aus einem Datenblatt, sondern ist eine
 * Vorsichtsgrenze: HyperDeck-Namen laufen ueber Dateisysteme mit sehr
 * verschiedenen Grenzen, und ein Name knapp darunter ist auf keinem davon
 * knapp. Wer eine belegte Grenze hat, setzt sie hier ein und schreibt die
 * Fundstelle daneben.
 */
export const MAX_NAME_LENGTH = 96

export type RecordNameFindingKind =
  | 'take-missing'
  | 'no-recorder'
  | 'duplicate-name'
  | 'illegal-character'
  | 'too-long'
  | 'empty-name'
  | 'source-unnamed'

export const RECORD_NAME_FINDING_LABEL: Readonly<Record<RecordNameFindingKind, string>> = {
  'take-missing': 'Das Schema nennt eine Take-Nummer, das Projekt trägt keine',
  'no-recorder': 'Diese Rolle erreicht keinen Recorder — es entsteht keine Aufzeichnung',
  'duplicate-name': 'Zwei Aufzeichnungen bekämen denselben Namen',
  'illegal-character': 'Der Name trägt ein Zeichen, das ein Datenträger ablehnt',
  'too-long': 'Der Name ist länger, als ein Deck sicher annimmt',
  'empty-name': 'Aus dem Schema entsteht für diese Zeile kein Name',
  'source-unnamed': 'Die Rolle hat keinen Namen — der Dateiname trägt dann eine Lücke',
}

export interface RecordNameFinding {
  kind: RecordNameFindingKind
  /** Die betroffene Rolle, wenn der Befund an einer haengt. */
  roleId?: string
  detail?: string
}

export interface RecordNameRow {
  roleId: string
  roleName: string
  /** Wo die Aufzeichnung landet — Klartext aus dem Manifest. */
  recorder?: string
  /** Kanal beziehungsweise Eingang am Recorder. */
  channel?: number
  /** Der Name, den das Geraet bekaeme. Leer, wenn keiner entsteht. */
  name: string
  findings: RecordNameFinding[]
}

export interface RecordNamePlan {
  rows: RecordNameRow[]
  /** Alle Befunde, auch die der Zeilen — eine Liste fuer die Oberflaeche. */
  findings: RecordNameFinding[]
}

const pad = (v: number | undefined, stellen: number | undefined): string =>
  v === undefined ? '' : String(v).padStart(stellen ?? 0, '0')

/**
 * Ein Segment fuer eine Zeile aufloesen.
 *
 * Gibt `''` zurueck, wo die Quelle nichts hergibt — und NICHT etwa einen
 * Platzhalter. Ein „unknown" im Dateinamen einer Aufzeichnung ist schlimmer
 * als eine Luecke: es sieht aus wie ein Name und wird nicht nachgetragen.
 */
const segmentWert = (
  segment: RecordNameSegment,
  zeile: HandoverRow,
  showName: string,
  take: number | undefined,
): string => {
  switch (segment.part) {
    case 'show':
      return showName.trim()
    case 'take':
      return pad(take, segment.pad)
    case 'source':
      return zeile.roleName.trim()
    case 'sourceNumber':
      return pad(zeile.roleNumber, segment.pad)
    case 'recorder':
      return zeile.record.kind === 'none' ? '' : zeile.record.recorder.trim()
    case 'channel':
      return zeile.record.kind === 'switcher-iso'
        ? pad(zeile.record.channel, segment.pad)
        : zeile.record.kind === 'recorder'
          ? pad(zeile.record.input, segment.pad)
          : ''
    case 'literal':
      return (segment.literal ?? '').trim()
  }
}

/**
 * Die Aufnahmenamen einer Produktion.
 *
 * Gebaut auf `buildHandoverManifest` und NICHT auf einer eigenen Traversierung
 * des Kabelgraphen: dort steht bereits, welche Rolle auf welchem Recorder
 * landet und mit welchem Kanal. Eine zweite Ableitung derselben Zuordnung
 * waere die zweite Wahrheit, gegen die ADR-001 geschrieben ist — und sie
 * fiele erst auf, wenn das Uebergabe-Blatt und die Deck-Beschriftung
 * verschiedene Kanaele nennen.
 */
export const recordNamePlan = (
  project: Pick<CablePlannerProject, 'equipment' | 'cables' | 'sourceIdentities' | 'metadata'>,
  scheme: RecordNamingScheme = DEFAULT_RECORD_SCHEME,
): RecordNamePlan => {
  const manifest = buildHandoverManifest(project)
  const showName = project.metadata?.name ?? ''
  const findings: RecordNameFinding[] = []

  const brauchtTake = scheme.segments.some((s) => s.part === 'take')
  if (brauchtTake && scheme.take === undefined) {
    findings.push({ kind: 'take-missing' })
  }

  const rows: RecordNameRow[] = manifest.rows.map((zeile) => {
    const eigene: RecordNameFinding[] = []
    const teile = scheme.segments
      .map((s) => segmentWert(s, zeile, showName, scheme.take))
      .filter((v) => v !== '')
    const name = teile.join(scheme.separator)

    if (!zeile.roleName.trim()) {
      eigene.push({ kind: 'source-unnamed', roleId: zeile.roleId })
    }
    if (zeile.record.kind === 'none') {
      eigene.push({ kind: 'no-recorder', roleId: zeile.roleId })
    }
    if (!name) {
      eigene.push({ kind: 'empty-name', roleId: zeile.roleId })
    } else {
      if (NICHT_ERLAUBT.test(name)) {
        eigene.push({
          kind: 'illegal-character',
          roleId: zeile.roleId,
          detail: (name.match(NICHT_ERLAUBT) ?? [''])[0],
        })
      }
      if (name.length > MAX_NAME_LENGTH) {
        eigene.push({ kind: 'too-long', roleId: zeile.roleId, detail: String(name.length) })
      }
    }

    return {
      roleId: zeile.roleId,
      roleName: zeile.roleName,
      ...(zeile.record.kind === 'none' ? {} : { recorder: zeile.record.recorder }),
      ...(zeile.record.kind === 'switcher-iso' ? { channel: zeile.record.channel } : {}),
      ...(zeile.record.kind === 'recorder' ? { channel: zeile.record.input } : {}),
      name,
      findings: eigene,
    }
  })

  // Doppelte Namen: DER Fehler, den man nicht sieht und nach dem niemand
  // sucht. Zwei Decks schreiben dieselbe Datei; welche der beiden Karten am
  // Ende in der Post liegt, entscheidet die Reihenfolge des Einlesens.
  const proName = new Map<string, RecordNameRow[]>()
  for (const r of rows) {
    if (!r.name) continue
    proName.set(r.name, [...(proName.get(r.name) ?? []), r])
  }
  for (const [name, gleiche] of proName) {
    if (gleiche.length < 2) continue
    for (const r of gleiche) {
      const f: RecordNameFinding = {
        kind: 'duplicate-name',
        roleId: r.roleId,
        detail: `${name} — ${gleiche.map((x) => x.roleName).join(', ')}`,
      }
      r.findings.push(f)
    }
  }

  for (const r of rows) findings.push(...r.findings)
  return { rows, findings }
}

/**
 * Der Zettel fuers Deck: je Aufzeichnung eine Zeile zum Nachsehen am Geraet.
 *
 * Das ist die ehrliche Haelfte der Massnahme. Sie verlangt „pushed to decks"
 * und eine Rueckmeldung; beides braucht eine Verbindung, die diese Anwendung
 * nicht hat. Ein Blatt, das jemand am Deck abgleicht, tut dieselbe Arbeit —
 * und es behauptet nicht, den Zustand des Geraets zu kennen.
 */
export const recordNameSheet = (plan: RecordNamePlan): string[][] => [
  ['Rolle', 'Recorder', 'Kanal', 'Dateiname', 'Befund'],
  ...plan.rows.map((r) => [
    r.roleName,
    r.recorder ?? 'kein Recorder im Plan',
    r.channel === undefined ? '' : String(r.channel),
    r.name,
    r.findings.map((f) => RECORD_NAME_FINDING_LABEL[f.kind]).join(' · '),
  ]),
]

/**
 * Das Schema aus einer Datei lesen.
 *
 * Dieselbe Haltung wie `normaliseNamingScheme`: ein unbrauchbares Schema
 * ergibt `undefined` und keinen Ladebericht — eine Regel ist eine
 * Einstellung, kein Datensatz des Nutzers. Die TAKE-NUMMER wird davon
 * ausgenommen behandelt: sie ist keine Einstellung, sondern ein Stand der
 * Produktion. Eine unbrauchbare (negativ, gebrochen) faellt WEG statt
 * zurechtgebogen zu werden — danach meldet `recordNamePlan` sie als
 * `take-missing`, und das ist die richtige Auskunft. Eine auf 1 gerundete
 * Zahl waere eine erfundene, und sie stuende auf jeder Karte.
 */
export const normaliseRecordNaming = (raw: unknown): RecordNamingScheme | undefined => {
  if (!raw || typeof raw !== 'object') return undefined
  const o = raw as Record<string, unknown>
  const teile = new Set<string>([
    'show',
    'take',
    'source',
    'sourceNumber',
    'recorder',
    'channel',
    'literal',
  ])
  const segments: RecordNameSegment[] = []
  for (const rawS of Array.isArray(o.segments) ? o.segments : []) {
    const s = (rawS ?? {}) as Record<string, unknown>
    if (typeof s.part !== 'string' || !teile.has(s.part)) continue
    const seg: RecordNameSegment = { part: s.part as RecordNameSegment['part'] }
    if (typeof s.literal === 'string' && s.literal.trim()) seg.literal = s.literal.trim()
    if (typeof s.pad === 'number' && s.pad >= 1 && s.pad <= 6) seg.pad = Math.floor(s.pad)
    segments.push(seg)
  }
  if (segments.length === 0) return undefined
  const separator = typeof o.separator === 'string' ? o.separator : '_'
  const take =
    typeof o.take === 'number' && Number.isInteger(o.take) && o.take >= 0 ? o.take : undefined
  return { segments, separator, ...(take !== undefined ? { take } : {}) }
}
