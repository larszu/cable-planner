// ───────────────────────────────────────────────────────────────────────────
// Der Vergleich (Bedarf 79, P2). Plan gegen Ist, Position fuer Position, nach
// groesster Abweichung sortiert.
//
// Die Begruendung und die Grenze stehen in `types/costLines.ts`. Hier steht,
// wie gerechnet wird — und vor allem, was ausdruecklich NICHT gerechnet wird.
//
// ─── EINE FEHLENDE ZAHL IST KEINE NULL ─────────────────────────────────────
//
// Das ist die eine Regel, an der dieses Modul haengt. Fehlt der Ist-Wert, ist
// die Abweichung UNBEKANNT, nicht null. Eine Null steht in der Spalte
// „Abweichung", liest sich als „im Rahmen", und die Position, die das Projekt
// gerissen hat, faellt genau deshalb niemandem auf.
//
// Dasselbe gilt fuer die Summe: `costTotals` addiert nur, was dasteht, und
// sagt daneben, wie viele Positionen NICHT dabei sind. Eine Summe ohne diesen
// Zusatz behauptet Vollstaendigkeit.
//
// ─── DIE PROJEKTSUMME WIRD GERECHNET, NIE GELESEN ──────────────────────────
//
//   > Project estimate is a DERIVED quantity based on what the task estimate
//   > is. (frappe/erpnext#34127)
//
// `costTotals` ist die einzige Stelle, die sie herstellt. Ein Feld dafuer gibt
// es nicht, und `tests/costComparison.test.ts` haelt fest, dass es keines gibt.
//
// REIN: keine Uhr, kein Store, kein IO.
// ───────────────────────────────────────────────────────────────────────────

import { befund, satz, type Satz } from './satz'
import type { CablePlannerProject } from '../types/project'
import {
  ACTUAL_SOURCE_LABEL,
  EMPTY_COST_PLAN,
  type CostAnchor,
  type CostLine,
  type CostPlan,
} from '../types/costLines'
import type { CsvTable } from './csv'
import { kanonisch, spalten } from './kanonisch'

export type CostFindingKind =
  | 'no-lines'
  | 'estimate-missing'
  | 'actual-missing'
  | 'actual-unsourced'
  | 'anchor-orphan'
  | 'currency-unstated'
  | 'no-tolerance'
  | 'over-tolerance'

export const COST_FINDING_LABEL: Readonly<Record<CostFindingKind, string>> = {
  'no-lines': 'No cost line: there is nothing to compare',
  'estimate-missing': 'Line without an estimate',
  'actual-missing': 'Line without an actual value: the variance is unknown',
  'actual-unsourced': 'Actual value without a stated source',
  'anchor-orphan': 'Line is attached to something that no longer exists in the plan',
  'currency-unstated': 'No currency stated',
  'no-tolerance': 'No tolerance set: nothing is flagged as notable',
  'over-tolerance': 'Variance above the set tolerance',
}

export interface CostFinding {
  kind: CostFindingKind
  text: string
  satz?: Satz
  /** Die betroffene Position, fuer den Sprung. Leer bei planweiten Befunden. */
  lineId?: string
}

/** Was aus dem Anker geworden ist. */
export type AnchorState =
  /** Der Anker zeigt auf etwas, das es gibt. */
  | 'found'
  /** Die Position haengt bewusst an nichts im Plan (Fahrt, Personal). */
  | 'free'
  /** Der Anker zeigt ins Leere. */
  | 'gone'

export interface CostRow {
  line: CostLine
  anchorLabel: string
  anchorState: AnchorState
  /** `undefined` heisst „nicht geschaetzt", nicht „null Euro". */
  estimate?: number
  actual?: number
  /** Nur gesetzt, wenn BEIDE Zahlen dastehen. */
  delta?: number
  deltaPercent?: number
}

export interface CostTotals {
  /** Die Projektschaetzung — GERECHNET, nie gelesen. */
  estimate: number
  /** Wie viele Positionen zu dieser Summe nichts beigetragen haben. */
  linesWithoutEstimate: number
  /** Die Summe der bekannten Ist-Werte. */
  actual: number
  linesWithoutActual: number
}

export interface CostAssessment {
  plan: CostPlan
  /** Nach dem Betrag der Abweichung absteigend — „which task has the most delta". */
  rows: CostRow[]
  totals: CostTotals
  findings: CostFinding[]
}

const NO_NUMBER = 'nicht angegeben'
const UNKNOWN_DELTA = 'unbekannt'
const FREE_ANCHOR = 'ohne Bezug im Plan'
const GONE_ANCHOR = 'Bezug entfernt'

const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v)

/**
 * Was der Anker im Plan bezeichnet — und ob es das noch gibt.
 *
 * Ein verlorener Anker wird NICHT stillschweigend zu `free` gemacht. Der
 * Unterschied zwischen „gehoert bewusst zu nichts" und „das Geraet ist weg"
 * ist genau der zwischen einer Fahrtkostenzeile und einer Position, die auf
 * ein geloeschtes Geraet gebucht ist.
 */
export function resolveAnchor(
  anchor: CostAnchor,
  project: CablePlannerProject,
): { label: string; state: AnchorState } {
  if (anchor.kind === 'free') return { label: FREE_ANCHOR, state: 'free' }
  if (anchor.kind === 'equipment') {
    const e = project.equipment.find((x) => x.id === anchor.equipmentId)
    return e ? { label: e.name, state: 'found' } : { label: GONE_ANCHOR, state: 'gone' }
  }
  const d = (project.deliveryDestinations ?? []).find((x) => x.id === anchor.destinationId)
  return d ? { label: d.name, state: 'found' } : { label: GONE_ANCHOR, state: 'gone' }
}

/**
 * Die Projektschaetzung und die Ist-Summe.
 *
 * Beide zaehlen NUR, was dasteht — und nennen daneben, wie viele Positionen
 * fehlen. Eine Summe ohne diesen Zusatz behauptet Vollstaendigkeit.
 */
export function costTotals(lines: CostLine[]): CostTotals {
  let estimate = 0
  let actual = 0
  let linesWithoutEstimate = 0
  let linesWithoutActual = 0
  for (const l of lines) {
    if (isNum(l.estimate)) estimate += l.estimate
    else linesWithoutEstimate += 1
    if (isNum(l.actual)) actual += l.actual
    else linesWithoutActual += 1
  }
  return { estimate, actual, linesWithoutEstimate, linesWithoutActual }
}

export function assessCosts(project: CablePlannerProject): CostAssessment {
  const plan: CostPlan = project.costPlan ?? EMPTY_COST_PLAN
  const findings: CostFinding[] = []

  const rows: CostRow[] = plan.lines.map((line) => {
    const { label, state } = resolveAnchor(line.anchor, project)
    const row: CostRow = { line, anchorLabel: label, anchorState: state }
    if (isNum(line.estimate)) row.estimate = line.estimate
    if (isNum(line.actual)) row.actual = line.actual
    // Nur wenn BEIDE Zahlen dastehen. Sonst ist die Abweichung unbekannt und
    // nicht null.
    if (isNum(line.estimate) && isNum(line.actual)) {
      row.delta = line.actual - line.estimate
      // Bei einer Schaetzung von 0 gibt es keinen Prozentsatz: jede Abweichung
      // waere unendlich viel Prozent, und die Zahl saehe wie eine Aussage aus.
      if (line.estimate !== 0) {
        row.deltaPercent = Math.round(((line.actual - line.estimate) / Math.abs(line.estimate)) * 100)
      }
    }
    return row
  })

  // „which task has the most delta" — genau danach fragt der Beleg. Zeilen
  // ohne bekannte Abweichung stehen hinten, nicht bei null: sie sind nicht
  // „im Rahmen", sondern ungeprueft.
  rows.sort((a, b) => {
    const av = a.delta === undefined ? -1 : Math.abs(a.delta)
    const bv = b.delta === undefined ? -1 : Math.abs(b.delta)
    return bv - av || a.line.label.localeCompare(b.line.label, 'de')
  })

  const totals = costTotals(plan.lines)

  if (plan.lines.length === 0) {
    findings.push({
      kind: 'no-lines',
      ...befund(
        satz(
          'cost.text.noLines',
          'There is no cost line in the project. Plan versus actual then happens in a spreadsheet again — exactly the detour this comparison is built against.',
        ),
      ),
    })
    return { plan, rows, totals, findings }
  }

  if (!(plan.currency ?? '').trim()) {
    findings.push({
      kind: 'currency-unstated',
      ...befund(
        satz(
          'cost.text.noCurrency',
          'No currency is given. None is guessed — not even "EUR": a total whose unit the application picked gets invoiced in the wrong currency and nobody notices.',
        ),
      ),
    })
  }

  for (const r of rows) {
    if (r.estimate === undefined) {
      findings.push({
        kind: 'estimate-missing',
        ...befund(
          satz(
            'cost.text.noEstimate',
            '"{position}" has no estimate. The line therefore does not count towards the project estimate — instead of counting in as a zero that nobody finds there again.',
            { position: r.line.label },
          ),
        ),
        lineId: r.line.id,
      })
    }
    if (r.actual === undefined) {
      findings.push({
        kind: 'actual-missing',
        ...befund(
          satz(
            'cost.text.noActual',
            '"{position}" has no actual value. The variance is therefore unknown, not zero — a zero in this column reads as "within range".',
            { position: r.line.label },
          ),
        ),
        lineId: r.line.id,
      })
    } else if (r.line.actualSource === 'unstated') {
      findings.push({
        kind: 'actual-unsourced',
        ...befund(
          satz(
            'cost.text.actualUnsourced',
            'The actual value of "{position}" does not say where it comes from. A figure from the ERP and one from gut feeling look the same in this column.',
            { position: r.line.label },
          ),
        ),
        lineId: r.line.id,
      })
    }
    if (r.anchorState === 'gone') {
      findings.push({
        kind: 'anchor-orphan',
        ...befund(
          satz(
            'cost.text.anchorGone',
            '"{position}" hangs on something that no longer exists in the plan. The line is not silently set to "unanchored": that would be the same line as a travel cost item, and it is something else.',
            { position: r.line.label },
          ),
        ),
        lineId: r.line.id,
      })
    }
  }

  const tol = plan.tolerancePercent
  if (!isNum(tol) || tol <= 0) {
    findings.push({
      kind: 'no-tolerance',
      ...befund(
        satz(
          'cost.text.noTolerance',
          'No tolerance is set, so no variance is reported as conspicuous. A preset value would be an opinion on what is normal in this business — this application has none.',
        ),
      ),
    })
  } else {
    for (const r of rows) {
      if (r.deltaPercent === undefined) continue
      if (Math.abs(r.deltaPercent) < tol) continue
      findings.push({
        kind: 'over-tolerance',
        ...befund(
          satz(
            'cost.text.overTolerance',
            '"{position}" deviates by {prozent} % (tolerance {toleranz} %).',
            { position: r.line.label, prozent: r.deltaPercent, toleranz: tol },
          ),
        ),
        lineId: r.line.id,
      })
    }
  }

  return { plan, rows, totals, findings }
}

const num = (v: number | undefined): string => (isNum(v) ? String(Math.round(v * 100) / 100) : NO_NUMBER)


/**
 * Das Blatt: Plan neben Ist, groesste Abweichung oben.
 *
 * Die Summenzeile steht UNTEN und nennt in derselben Zeile, wie viele
 * Positionen nicht eingerechnet sind. Eine Summe ohne diesen Zusatz
 * behauptet Vollstaendigkeit.
 */
export function costComparisonTable(project: CablePlannerProject): CsvTable {
  const a = assessCosts(project)
  const waehrung = (a.plan.currency ?? '').trim() || 'Währung nicht angegeben'
  const rows = a.rows.map((r) => [
    r.line.label,
    r.anchorLabel,
    num(r.estimate),
    num(r.actual),
    kanonisch(`cost.actualSource.${r.line.actualSource}`, ACTUAL_SOURCE_LABEL[r.line.actualSource]),
    r.delta === undefined ? UNKNOWN_DELTA : num(r.delta),
    r.deltaPercent === undefined ? UNKNOWN_DELTA : `${r.deltaPercent} %`,
    waehrung,
  ])
  if (a.plan.lines.length > 0) {
    rows.push([
      'Projektschätzung (gerechnet)',
      `${a.totals.linesWithoutEstimate} Position(en) ohne Schätzung`,
      num(a.totals.estimate),
      num(a.totals.actual),
      `${a.totals.linesWithoutActual} Position(en) ohne Ist-Wert`,
      UNKNOWN_DELTA,
      UNKNOWN_DELTA,
      waehrung,
    ])
  }
  return {
    headers: spalten(['Line', 'Plan reference', 'Estimate', 'Actual', 'Actual source', 'Variance', 'Variance %', 'Currency']),
    rows,
  }
}

/**
 * Normalisiert den gespeicherten Kostenplan beim Laden.
 *
 * Verworfen wird nur, was unlesbar ist: eine Position ohne Id oder ohne
 * Bezeichnung ist in einem Vergleich keine Zeile. Eine Position mit einem
 * ANKER INS LEERE bleibt — dafuer gibt es `anchor-orphan`, und sie hier auf
 * „ohne Bezug" zu setzen hiesse, eine gebuchte Position in eine
 * Fahrtkostenzeile zu verwandeln.
 *
 * `actualSource` faellt auf `unstated` zurueck und nicht auf `from-erp`:
 * dieselbe Regel wie im Sendebericht.
 */
export function normaliseCostPlan(
  raw: unknown,
  onDrop?: (d: { reason: 'missing-required' | 'duplicate-id'; label: string }) => void,
): CostPlan | undefined {
  if (!raw || typeof raw !== 'object') return undefined
  const o = raw as Record<string, unknown>
  const str = (v: unknown): string | undefined =>
    typeof v === 'string' && v.trim() ? v.trim() : undefined
  const posNum = (v: unknown): number | undefined => (isNum(v) ? v : undefined)
  const sourceOf = (v: unknown): CostLine['actualSource'] =>
    typeof v === 'string' && v in ACTUAL_SOURCE_LABEL
      ? (v as CostLine['actualSource'])
      : 'unstated'
  const anchorOf = (v: unknown): CostAnchor => {
    const a = (v ?? {}) as Record<string, unknown>
    const equipmentId = str(a.equipmentId)
    if (a.kind === 'equipment' && equipmentId) return { kind: 'equipment', equipmentId }
    const destinationId = str(a.destinationId)
    if (a.kind === 'delivery' && destinationId) return { kind: 'delivery', destinationId }
    return { kind: 'free' }
  }

  const seen = new Set<string>()
  const lines: CostLine[] = []
  for (const rawL of Array.isArray(o.lines) ? o.lines : []) {
    const r = (rawL ?? {}) as Record<string, unknown>
    const id = str(r.id)
    const label = str(r.label)
    if (!id || !label) {
      onDrop?.({ reason: 'missing-required', label: label ?? id ?? '' })
      continue
    }
    if (seen.has(id)) {
      onDrop?.({ reason: 'duplicate-id', label })
      continue
    }
    seen.add(id)
    const line: CostLine = { id, label, anchor: anchorOf(r.anchor), actualSource: sourceOf(r.actualSource) }
    const estimate = posNum(r.estimate)
    if (estimate !== undefined) line.estimate = estimate
    const actual = posNum(r.actual)
    if (actual !== undefined) line.actual = actual
    const note = str(r.note)
    if (note) line.note = note
    lines.push(line)
  }

  const currency = str(o.currency)
  const tolerancePercent = posNum(o.tolerancePercent)
  // Ein Objekt ohne alles traegt nichts — Ballast in jedem Projektfile, das
  // den Dialog einmal geoeffnet hat.
  if (lines.length === 0 && !currency && tolerancePercent === undefined) return undefined
  return {
    ...(currency ? { currency } : {}),
    ...(tolerancePercent !== undefined ? { tolerancePercent } : {}),
    lines,
  }
}
