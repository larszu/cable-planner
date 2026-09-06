import { describe, expect, it } from 'vitest'
import {
  COST_FINDING_LABEL,
  assessCosts,
  costComparisonTable,
  costTotals,
  normaliseCostPlan,
  resolveAnchor,
} from '../src/renderer/lib/costComparison'
import { ACTUAL_SOURCE_LABEL, type CostLine, type CostPlan } from '../src/renderer/types/costLines'
import type { CablePlannerProject } from '../src/renderer/types/project'
import type { EquipmentItem } from '../src/renderer/types/equipment'
import { DOCUMENT_LABELS, DOCUMENT_STANDS } from '../src/renderer/lib/documentRegistry'
import typenQuelle from '../src/renderer/types/costLines.ts?raw'
import libQuelle from '../src/renderer/lib/costComparison.ts?raw'
import projektTypQuelle from '../src/renderer/types/project.ts?raw'
import storeQuelle from '../src/renderer/store/projectStore.ts?raw'
import dialogQuelle from '../src/renderer/components/Analysis/AnalysisDialog.tsx?raw'

// ---------------------------------------------------------------------------
// Plan gegen Ist (Bedarf 79, P2).
//
//   > I have to copy the actual cost incurred from erpnext to Excel for a side
//   > by side comparison of WHICH TASK HAS THE MOST DELTA
//   (frappe/erpnext#34127, seit 2023-02-19 offen)
//
// Und der Satz, der den Entwurf entscheidet:
//
//   > Project estimate is different from a budget. Project estimate is a
//   > DERIVED QUANTITY based on what the task estimate is.
// ---------------------------------------------------------------------------

const eq = (id: string, name: string): EquipmentItem =>
  ({ id, name, x: 0, y: 0, width: 10, height: 10, category: 'Video', inputs: [], outputs: [] }) as never

const line = (over: Partial<CostLine> = {}): CostLine => ({
  id: over.id ?? 'l1',
  label: over.label ?? 'Kamerazug',
  anchor: over.anchor ?? { kind: 'free' },
  actualSource: over.actualSource ?? 'from-erp',
  ...(over.estimate !== undefined ? { estimate: over.estimate } : {}),
  ...(over.actual !== undefined ? { actual: over.actual } : {}),
})

const projekt = (costPlan?: CostPlan, over: Partial<CablePlannerProject> = {}): CablePlannerProject =>
  ({
    metadata: { name: 'Show', description: '', createdAt: '', updatedAt: '' },
    equipment: [],
    cables: [],
    canvasState: { x: 0, y: 0, zoom: 1 },
    ...(costPlan ? { costPlan } : {}),
    ...over,
  }) as CablePlannerProject

const arten = (p: CablePlannerProject): string[] => assessCosts(p).findings.map((f) => f.kind)

const plan = (lines: CostLine[], rest: Partial<CostPlan> = {}): CostPlan => ({
  currency: 'EUR',
  tolerancePercent: 10,
  lines,
  ...rest,
})

// ── 1. Die Projektsumme wird gerechnet, nie gespeichert ────────────────────

describe('die Projektschätzung ist eine ABGELEITETE Grösse', () => {
  it('hat nirgends ein Feld für die Summe', () => {
    // Eine gespeicherte Summe ist genau der Defekt aus dem Beleg: sie wird
    // einmal eingetippt, die Positionen wandern weiter, und ab da
    // widersprechen sich zwei Zahlen im selben System.
    expect(typenQuelle).not.toMatch(/totalEstimate|totalBudget|projectEstimate\s*[?:]/)
    expect(projektTypQuelle).not.toMatch(/totalEstimate|projectEstimate/)
  })

  it('bietet auch in der Oberfläche kein Eingabefeld dafür', () => {
    const abschnitt = costTab()
    expect(abschnitt).toMatch(/analysis\.cost\.total/)
    // Die Summe wird angezeigt, nicht eingegeben.
    expect(abschnitt).toMatch(/\{Math\.round\(kosten\.totals\.estimate \* 100\) \/ 100\}/)
    expect(abschnitt).not.toMatch(/totals\.estimate.*onChange/)
  })

  it('addiert nur, was dasteht — und sagt daneben, was fehlt', () => {
    const t = costTotals([line({ id: 'a', estimate: 100, actual: 120 }), line({ id: 'b' })])
    expect(t.estimate).toBe(100)
    expect(t.linesWithoutEstimate).toBe(1)
    expect(t.actual).toBe(120)
    expect(t.linesWithoutActual).toBe(1)
  })

  it('nennt die Zahl der fehlenden Positionen auch auf dem Blatt', () => {
    // Eine Summe ohne diesen Zusatz behauptet Vollstaendigkeit.
    const t = costComparisonTable(projekt(plan([line({ estimate: 100 })])))
    const summe = t.rows.at(-1)!.map(String)
    expect(summe[0]).toContain('gerechnet')
    expect(summe.join(' ')).toContain('1 Position(en) ohne Ist-Wert')
  })
})

// ── 2. Eine fehlende Zahl ist keine Null ───────────────────────────────────

describe('eine fehlende Zahl ist keine Null', () => {
  it('lässt die Abweichung unbekannt, wenn der Ist-Wert fehlt', () => {
    const p = projekt(plan([line({ estimate: 100 })]))
    expect(assessCosts(p).rows[0].delta).toBeUndefined()
    expect(arten(p)).toContain('actual-missing')
  })

  it('lässt sie auch unbekannt, wenn die Schätzung fehlt', () => {
    const p = projekt(plan([line({ actual: 100 })]))
    expect(assessCosts(p).rows[0].delta).toBeUndefined()
    expect(arten(p)).toContain('estimate-missing')
  })

  it('schreibt „unbekannt" auf das Blatt, nicht 0', () => {
    const t = costComparisonTable(projekt(plan([line({ estimate: 100 })])))
    const zeile = t.rows[0].map(String)
    expect(zeile).toContain('unbekannt')
    expect(zeile).not.toContain('0')
  })

  it('rechnet die Abweichung, wenn BEIDE Zahlen dastehen', () => {
    const r = assessCosts(projekt(plan([line({ estimate: 100, actual: 130 })]))).rows[0]
    expect(r.delta).toBe(30)
    expect(r.deltaPercent).toBe(30)
  })

  it('rechnet bei einer Schätzung von 0 KEINEN Prozentsatz', () => {
    // Jede Abweichung waere unendlich viel Prozent, und die Zahl saehe wie
    // eine Aussage aus.
    const r = assessCosts(projekt(plan([line({ estimate: 0, actual: 50 })]))).rows[0]
    expect(r.delta).toBe(50)
    expect(r.deltaPercent).toBeUndefined()
  })
})

// ── 3. „which task has the most delta" ─────────────────────────────────────

describe('die Sortierung beantwortet die Frage aus dem Beleg', () => {
  it('stellt die grösste Abweichung nach oben', () => {
    const p = projekt(
      plan([
        line({ id: 'a', label: 'Klein', estimate: 100, actual: 105 }),
        line({ id: 'b', label: 'Gross', estimate: 100, actual: 400 }),
      ]),
    )
    expect(assessCosts(p).rows.map((r) => r.line.label)).toEqual(['Gross', 'Klein'])
  })

  it('zählt eine negative Abweichung genauso gross wie eine positive', () => {
    const p = projekt(
      plan([
        line({ id: 'a', label: 'Ueber', estimate: 100, actual: 150 }),
        line({ id: 'b', label: 'Unter', estimate: 100, actual: 20 }),
      ]),
    )
    expect(assessCosts(p).rows[0].line.label).toBe('Unter')
  })

  it('stellt Zeilen ohne bekannte Abweichung nach HINTEN, nicht auf null', () => {
    // Sie sind nicht „im Rahmen", sondern ungeprueft.
    const p = projekt(
      plan([
        line({ id: 'a', label: 'Ohne Ist', estimate: 100 }),
        line({ id: 'b', label: 'Winzig', estimate: 100, actual: 100 }),
      ]),
    )
    expect(assessCosts(p).rows.map((r) => r.line.label)).toEqual(['Winzig', 'Ohne Ist'])
  })
})

// ── 4. Herkunft, Anker, Währung, Toleranz ──────────────────────────────────

describe('die Befunde', () => {
  it('meldet einen leeren Kostenplan', () => {
    expect(arten(projekt())).toContain('no-lines')
  })

  it('meldet einen Ist-Wert ohne genannte Herkunft', () => {
    const p = projekt(plan([line({ estimate: 10, actual: 12, actualSource: 'unstated' })]))
    expect(arten(p)).toContain('actual-unsourced')
  })

  it('meldet die Herkunft NICHT, solange gar kein Ist-Wert dasteht', () => {
    // Sonst stuenden zwei Befunde fuer denselben Sachverhalt.
    const p = projekt(plan([line({ estimate: 10, actualSource: 'unstated' })]))
    expect(arten(p)).toContain('actual-missing')
    expect(arten(p)).not.toContain('actual-unsourced')
  })

  it('meldet einen Anker ins Leere und macht ihn NICHT still zu „ohne Bezug"', () => {
    const p = projekt(plan([line({ anchor: { kind: 'equipment', equipmentId: 'weg' } })]))
    expect(arten(p)).toContain('anchor-orphan')
    expect(assessCosts(p).rows[0].anchorState).toBe('gone')
  })

  it('unterscheidet „ohne Bezug" von „Bezug entfernt"', () => {
    const p = projekt()
    expect(resolveAnchor({ kind: 'free' }, p).state).toBe('free')
    expect(resolveAnchor({ kind: 'equipment', equipmentId: 'x' }, p).state).toBe('gone')
    const mitGeraet = projekt(undefined, { equipment: [eq('x', 'Kamera 1')] })
    expect(resolveAnchor({ kind: 'equipment', equipmentId: 'x' }, mitGeraet)).toEqual({
      label: 'Kamera 1',
      state: 'found',
    })
  })

  it('rät keine Währung — auch nicht EUR', () => {
    const p = projekt(plan([line({ estimate: 1 })], { currency: undefined }))
    expect(arten(p)).toContain('currency-unstated')
    expect(assessCosts(p).plan.currency).toBeUndefined()
    expect(libQuelle).not.toMatch(/currency\s*(\?\?|\|\|)\s*'EUR'/)
  })

  it('meldet ohne gesetzte Toleranz KEINE Zeile als auffällig', () => {
    // Eine voreingestellte Toleranz waere eine Meinung darueber, was in
    // diesem Geschaeft normal ist.
    const p = projekt(
      plan([line({ estimate: 100, actual: 1000 })], { tolerancePercent: undefined }),
    )
    expect(arten(p)).toContain('no-tolerance')
    expect(arten(p)).not.toContain('over-tolerance')
  })

  it('meldet über der gesetzten Toleranz', () => {
    const p = projekt(plan([line({ estimate: 100, actual: 130 })], { tolerancePercent: 10 }))
    expect(arten(p)).toContain('over-tolerance')
  })

  it('schweigt innerhalb der Toleranz', () => {
    const p = projekt(plan([line({ estimate: 100, actual: 105 })], { tolerancePercent: 10 }))
    expect(arten(p)).not.toContain('over-tolerance')
  })

  it('gibt jeder Befundart eine Beschriftung', () => {
    for (const k of Object.keys(COST_FINDING_LABEL)) {
      expect(COST_FINDING_LABEL[k as never]).toBeTruthy()
    }
  })
})

// ── 5. Das Blatt und das Laden ─────────────────────────────────────────────

describe('das Blatt', () => {
  it('nennt die Herkunft des Ist-Werts als eigene Spalte', () => {
    const t = costComparisonTable(projekt(plan([line({ estimate: 1, actual: 2 })])))
    expect(t.headers).toContain('Herkunft (Ist)')
    expect(t.rows[0].map(String)).toContain(ACTUAL_SOURCE_LABEL['from-erp'])
  })

  it('nennt eine fehlende Währung beim Namen statt die Zelle zu leeren', () => {
    const t = costComparisonTable(projekt(plan([line({ estimate: 1 })], { currency: undefined })))
    expect(t.rows[0].map(String)).toContain('Währung nicht angegeben')
  })

  it('traegt kanonisches Deutsch', () => {
    expect(libQuelle).not.toContain("t('")
  })

  it('ist als Dokument mit Stand und lesbarem Namen registriert', () => {
    expect(DOCUMENT_STANDS['kosten-vergleich']).toBeTruthy()
    expect(DOCUMENT_LABELS['kosten-vergleich']).toBeTruthy()
  })
})

describe('normaliseCostPlan', () => {
  it('verwirft eine Position ohne Bezeichnung', () => {
    const drops: string[] = []
    normaliseCostPlan({ lines: [{ id: 'a' }] }, (d) => drops.push(d.reason))
    expect(drops).toEqual(['missing-required'])
  })

  it('verwirft die zweite Position mit derselben Id', () => {
    const drops: string[] = []
    const out = normaliseCostPlan(
      { lines: [{ id: 'a', label: 'erst' }, { id: 'a', label: 'dann' }] },
      (d) => drops.push(d.reason),
    )
    expect(out?.lines).toHaveLength(1)
    expect(out?.lines[0].label).toBe('erst')
    expect(drops).toEqual(['duplicate-id'])
  })

  it('BEHÄLT einen Anker ins Leere', () => {
    const out = normaliseCostPlan({
      lines: [{ id: 'a', label: 'x', anchor: { kind: 'equipment', equipmentId: 'weg' } }],
    })
    expect(out?.lines[0].anchor).toEqual({ kind: 'equipment', equipmentId: 'weg' })
  })

  it('fällt bei der Herkunft auf `unstated` zurück, nicht auf `from-erp`', () => {
    const out = normaliseCostPlan({ lines: [{ id: 'a', label: 'x' }] })
    expect(out?.lines[0].actualSource).toBe('unstated')
  })

  it('verwirft ein Objekt, das nichts trägt', () => {
    expect(normaliseCostPlan({ lines: [] })).toBeUndefined()
    expect(normaliseCostPlan(null)).toBeUndefined()
  })

  it('behält Währung und Toleranz auch ohne Positionen', () => {
    expect(normaliseCostPlan({ lines: [], currency: 'CHF' })?.currency).toBe('CHF')
  })

  it('läuft auf dem Lade-Pfad und landet im geheilten Projekt', () => {
    expect(storeQuelle).toMatch(/normaliseCostPlan\(project\.costPlan, \(d\) =>/)
    expect(storeQuelle).toMatch(/kind: 'cost-line'/)
    expect(storeQuelle).toMatch(/\n {4}costPlan,\n/)
  })
})

// ── 6. Die Oberfläche ──────────────────────────────────────────────────────

const costTab = (): string => {
  const von = dialogQuelle.indexOf('const CostTab = ')
  const bis = dialogQuelle.indexOf('const TABS:')
  expect(von).toBeGreaterThan(-1)
  expect(bis).toBeGreaterThan(von)
  return dialogQuelle.slice(von, bis)
}

describe('die Oberfläche', () => {
  it('behandelt ein leeres Zahlenfeld als „nicht angegeben", nicht als 0', () => {
    expect(costTab()).toMatch(/return v\.trim\(\) === '' \|\| !Number\.isFinite\(n\) \? undefined : n/)
  })

  it('zeigt die Herkunft neben der Zahl', () => {
    expect(costTab()).toMatch(/ACTUAL_SOURCE_LABEL\[k as ActualSource\]/)
  })

  it('zeigt jeden Befund mit seiner Beschriftung', () => {
    expect(costTab()).toMatch(
      /kosten\.findings\.length > 0 &&[\s\S]*COST_FINDING_LABEL\[f\.kind\][\s\S]*f\.text/,
    )
  })

  it('zeigt „unbekannt" statt einer Null, wenn die Abweichung fehlt', () => {
    expect(costTab()).toMatch(/r\.delta === undefined\s*\n?\s*\? t\('analysis\.cost\.unknown'/)
  })
})
