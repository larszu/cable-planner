import { describe, expect, it } from 'vitest'
import { actualFromReceipts, hasEvidence, receiptChain } from '../src/renderer/lib/receiptChain'
import { normaliseCrewPlan } from '../src/renderer/lib/labourCost'
import type { CostPlan } from '../src/renderer/types/costLines'
import type { CrewExpense, CrewPlan } from '../src/renderer/types/labour'

const kosten: CostPlan = {
  currency: 'EUR',
  lines: [
    { id: 'k-fahrt', label: 'Anfahrt', anchor: { kind: 'free' }, actualSource: 'unstated' },
    { id: 'k-hotel', label: 'Übernachtung', anchor: { kind: 'free' }, actualSource: 'unstated' },
  ],
}

const auslage = (p: Partial<CrewExpense> & { id: string; amount: number }): CrewExpense => ({
  kind: 'other',
  date: '2026-02-03',
  billable: true,
  ...p,
})

const crew = (expenses: CrewExpense[]): CrewPlan => ({
  people: [],
  bands: [],
  rates: [],
  entries: [],
  expenses,
  approvals: [],
})

describe('eine Auslage ohne Kostenzeile bleibt folgenlos — und das steht da', () => {
  it('nennt jede nicht zugeordnete Auslage', () => {
    const c = receiptChain(kosten, crew([auslage({ id: 'a', amount: 24.5, receiptRef: 'R-1' })]))
    expect(c.unlinked.map((e) => e.id)).toEqual(['a'])
    expect(c.findings.map((f) => f.kind)).toContain('expense-unlinked')
  })

  it('meldet einen Zeiger auf eine gelöschte Kostenzeile getrennt davon', () => {
    const c = receiptChain(
      kosten,
      crew([auslage({ id: 'a', amount: 10, costLineId: 'gibt-es-nicht', receiptRef: 'R-1' })]),
    )
    expect(c.findings.map((f) => f.kind)).toContain('cost-line-missing')
    // Sie zählt trotzdem nirgends mit — genau das ist der Schaden.
    expect(c.rows.every((r) => r.documented === 0)).toBe(true)
  })

  it('meldet eine Auslage ohne jeden Beleg', () => {
    const c = receiptChain(kosten, crew([auslage({ id: 'a', amount: 10, costLineId: 'k-fahrt' })]))
    expect(c.findings.map((f) => f.kind)).toContain('expense-without-evidence')
  })

  it('lässt Belegnummer und Belegdatei beide als Beleg gelten', () => {
    expect(hasEvidence(auslage({ id: 'a', amount: 1, receiptRef: 'R-9' }))).toBe(true)
    expect(hasEvidence(auslage({ id: 'a', amount: 1, receiptRef: '   ' }))).toBe(false)
    expect(
      hasEvidence(
        auslage({
          id: 'a',
          amount: 1,
          receipt: {
            sha256: 'x',
            fileName: 'bon.jpg',
            storedAs: 'Belege/x-bon.jpg',
            mediaType: 'image/jpeg',
            bytes: 10,
            addedAt: '2026-02-03T10:00:00Z',
          },
        }),
      ),
    ).toBe(true)
  })
})

describe('die belegte Summe je Kostenzeile', () => {
  const c = receiptChain(
    kosten,
    crew([
      auslage({ id: 'a', amount: 24.5, costLineId: 'k-fahrt', receiptRef: 'R-1' }),
      auslage({
        id: 'b',
        amount: 12.3,
        costLineId: 'k-fahrt',
        receipt: {
          sha256: 'abc',
          fileName: 'bon.jpg',
          storedAs: 'Belege/abc-bon.jpg',
          mediaType: 'image/jpeg',
          bytes: 100,
          addedAt: '2026-02-03T10:00:00Z',
        },
      }),
    ]),
  )
  const fahrt = c.rows.find((r) => r.line.id === 'k-fahrt')

  it('summiert die zugeordneten Auslagen', () => {
    expect(fahrt?.documented).toBe(36.8)
  })

  it('sagt getrennt, wie viel davon eine Datei trägt', () => {
    // 24,50 hat nur eine Belegnummer. Der Unterschied entscheidet im
    // Streitfall, ob die Zahl vorzeigbar ist.
    expect(fahrt?.withFile).toBe(12.3)
  })

  it('lässt eine Kostenzeile ohne Auslagen in Ruhe', () => {
    const hotel = c.rows.find((r) => r.line.id === 'k-hotel')
    expect(hotel?.findings).toEqual([])
  })
})

describe('der Ist-Wert wird vorgeschlagen, nie geschrieben', () => {
  it('meldet einen fehlenden Ist-Wert, statt ihn zu setzen', () => {
    const c = receiptChain(kosten, crew([auslage({ id: 'a', amount: 40, costLineId: 'k-fahrt', receiptRef: 'R' })]))
    const fahrt = c.rows.find((r) => r.line.id === 'k-fahrt')
    expect(fahrt?.line.actual).toBeUndefined()
    expect(fahrt?.proposedActual).toBe(40)
    expect(fahrt?.findings.map((f) => f.kind)).toEqual(['actual-missing'])
  })

  it('gibt die Herkunft mit, wenn der Vorschlag übernommen wird', () => {
    const c = receiptChain(kosten, crew([auslage({ id: 'a', amount: 40, costLineId: 'k-fahrt' })]))
    const fahrt = c.rows.find((r) => r.line.id === 'k-fahrt')
    expect(fahrt && actualFromReceipts(fahrt)).toEqual({ actual: 40, actualSource: 'from-invoice' })
  })

  it('meldet einen Ist-Wert unter der belegten Summe', () => {
    const plan: CostPlan = {
      ...kosten,
      lines: [{ ...kosten.lines[0], actual: 30, actualSource: 'estimated-by-hand' }, kosten.lines[1]],
    }
    const c = receiptChain(plan, crew([auslage({ id: 'a', amount: 40, costLineId: 'k-fahrt' })]))
    expect(c.findings.map((f) => f.kind)).toContain('actual-below-documented')
  })

  it('meldet auch den umgekehrten Fall', () => {
    const plan: CostPlan = {
      ...kosten,
      lines: [{ ...kosten.lines[0], actual: 60, actualSource: 'from-erp' }, kosten.lines[1]],
    }
    const c = receiptChain(plan, crew([auslage({ id: 'a', amount: 40, costLineId: 'k-fahrt' })]))
    expect(c.findings.map((f) => f.kind)).toContain('actual-above-documented')
  })

  it('schweigt bei Übereinstimmung', () => {
    const plan: CostPlan = {
      ...kosten,
      lines: [{ ...kosten.lines[0], actual: 40, actualSource: 'from-invoice' }, kosten.lines[1]],
    }
    const c = receiptChain(plan, crew([auslage({ id: 'a', amount: 40, costLineId: 'k-fahrt' })]))
    expect(c.findings.filter((f) => f.kind.startsWith('actual-'))).toEqual([])
  })

  it('achtet die Toleranz des Kostenplans', () => {
    const plan: CostPlan = {
      ...kosten,
      tolerancePercent: 10,
      lines: [{ ...kosten.lines[0], actual: 42, actualSource: 'from-erp' }, kosten.lines[1]],
    }
    const c = receiptChain(plan, crew([auslage({ id: 'a', amount: 40, costLineId: 'k-fahrt' })]))
    expect(c.findings.filter((f) => f.kind.startsWith('actual-'))).toEqual([])
  })
})

describe('leere Eingaben', () => {
  it('kommt ohne Kostenplan und ohne Crew zurecht', () => {
    expect(receiptChain(undefined, undefined)).toEqual({ rows: [], unlinked: [], findings: [] })
  })
})

describe('der Beleg überlebt das Speichern und Laden', () => {
  const gelesen = (roh: unknown) => normaliseCrewPlan({ ...leer, expenses: [roh] })

  const leer = { people: [], bands: [], rates: [], entries: [], expenses: [], approvals: [] }

  it('trägt Belegdatei und Kostenzeile durch die Normalisierung', () => {
    const p = gelesen({
      id: 'a',
      date: '2026-02-03',
      amount: 12.3,
      billable: true,
      costLineId: 'k-fahrt',
      receipt: {
        sha256: 'abc',
        fileName: 'bon.jpg',
        storedAs: 'Belege/abc-bon.jpg',
        mediaType: 'image/jpeg',
        bytes: 100,
        addedAt: '2026-02-03T10:00:00Z',
        takenAt: '2026-02-03T08:14:00',
      },
    })
    expect(p?.expenses[0].costLineId).toBe('k-fahrt')
    expect(p?.expenses[0].receipt?.storedAs).toBe('Belege/abc-bon.jpg')
    expect(p?.expenses[0].receipt?.takenAt).toBe('2026-02-03T08:14:00')
  })

  it('nimmt einen halben Beleg gar nicht — eine Zeile darf nicht belegt aussehen', () => {
    const p = gelesen({
      id: 'a',
      date: '2026-02-03',
      amount: 12.3,
      billable: true,
      receipt: { fileName: 'bon.jpg', sha256: 'abc' },
    })
    expect(p?.expenses[0].receipt).toBeUndefined()
    expect(hasEvidence(p!.expenses[0])).toBe(false)
  })
})
