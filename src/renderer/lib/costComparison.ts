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

import type { CablePlannerProject } from '../types/project'
import {
  ACTUAL_SOURCE_LABEL,
  EMPTY_COST_PLAN,
  type CostAnchor,
  type CostLine,
  type CostPlan,
} from '../types/costLines'
import type { CsvTable } from './csv'

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
  'no-lines': 'Keine Kostenposition — es gibt nichts zu vergleichen',
  'estimate-missing': 'Position ohne Schätzung',
  'actual-missing': 'Position ohne Ist-Wert — die Abweichung ist unbekannt',
  'actual-unsourced': 'Ist-Wert ohne genannte Herkunft',
  'anchor-orphan': 'Position hängt an etwas, das es im Plan nicht mehr gibt',
  'currency-unstated': 'Keine Währung angegeben',
  'no-tolerance': 'Keine Toleranz gesetzt — es wird nichts als auffällig gemeldet',
  'over-tolerance': 'Abweichung über der gesetzten Toleranz',
}

export interface CostFinding {
  kind: CostFindingKind
  text: string
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
      text: 'Es steht keine Kostenposition im Projekt. Der Vergleich Plan gegen Ist findet dann wieder in einer Tabellenkalkulation statt — genau der Umweg, gegen den dieser Vergleich gebaut ist.',
    })
    return { plan, rows, totals, findings }
  }

  if (!(plan.currency ?? '').trim()) {
    findings.push({
      kind: 'currency-unstated',
      text: 'Es ist keine Währung angegeben. Geraten wird keine — auch nicht „EUR": eine Summe, deren Einheit die Anwendung sich ausgesucht hat, wird in der falschen Währung abgerechnet und niemand sieht es.',
    })
  }

  for (const r of rows) {
    if (r.estimate === undefined) {
      findings.push({
        kind: 'estimate-missing',
        text: `„${r.line.label}" hat keine Schätzung. Die Position zählt deshalb nicht zur Projektschätzung — statt mit einer Null hineinzuzählen, die dort niemand wiederfindet.`,
        lineId: r.line.id,
      })
    }
    if (r.actual === undefined) {
      findings.push({
        kind: 'actual-missing',
        text: `„${r.line.label}" hat keinen Ist-Wert. Die Abweichung ist damit unbekannt und nicht null — eine Null in dieser Spalte liest sich als „im Rahmen".`,
        lineId: r.line.id,
      })
    } else if (r.line.actualSource === 'unstated') {
      findings.push({
        kind: 'actual-unsourced',
        text: `Beim Ist-Wert von „${r.line.label}" steht nicht, woher er kommt. Eine Zahl aus dem ERP und eine aus dem Bauch sehen in dieser Spalte gleich aus.`,
        lineId: r.line.id,
      })
    }
    if (r.anchorState === 'gone') {
      findings.push({
        kind: 'anchor-orphan',
        text: `„${r.line.label}" hängt an etwas, das es im Plan nicht mehr gibt. Die Position wird nicht still auf „ohne Bezug" gesetzt: das wäre dieselbe Zeile wie eine Fahrtkostenposition, und sie ist etwas anderes.`,
        lineId: r.line.id,
      })
    }
  }

  const tol = plan.tolerancePercent
  if (!isNum(tol) || tol <= 0) {
    findings.push({
      kind: 'no-tolerance',
      text: 'Es ist keine Toleranz gesetzt, also wird keine Abweichung als auffällig gemeldet. Ein voreingestellter Wert wäre eine Meinung darüber, was in diesem Geschäft normal ist — diese Anwendung hat dazu keine.',
    })
  } else {
    for (const r of rows) {
      if (r.deltaPercent === undefined) continue
      if (Math.abs(r.deltaPercent) < tol) continue
      findings.push({
        kind: 'over-tolerance',
        text: `„${r.line.label}" weicht um ${r.deltaPercent} % ab (Toleranz ${tol} %).`,
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
    ACTUAL_SOURCE_LABEL[r.line.actualSource],
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
    headers: [
      'Position',
      'Bezug im Plan',
      'Schätzung',
      'Ist',
      'Herkunft (Ist)',
      'Abweichung',
      'Abweichung %',
      'Währung',
    ],
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
