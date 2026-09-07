import { describe, expect, it } from 'vitest'
import {
  ACTION_URGENCY_LABEL,
  EIGENER_TEXT,
  actionCounts,
  actionItems,
  urgencyOf,
  type ActionItem,
} from '../src/renderer/lib/actionItems'
import { LABOUR_FINDING_LABEL } from '../src/renderer/lib/labourCost'
import { COST_FINDING_LABEL } from '../src/renderer/lib/costComparison'
import { CHAIN_FINDING_LABEL } from '../src/renderer/lib/receiptChain'
import type { CablePlannerProject } from '../src/renderer/types/project'
import type { CheckoutRecord } from '../src/renderer/lager/types/checkout'
import type { InventoryItem } from '../src/renderer/lager/types/inventory'
import type { CrewPlan } from '../src/renderer/types/labour'

const HEUTE = '2026-09-07'

const projekt = (over: Partial<CablePlannerProject> = {}): CablePlannerProject =>
  ({
    metadata: { name: 'Show', description: '', createdAt: '', updatedAt: '' },
    equipment: [],
    cables: [],
    canvasState: { x: 0, y: 0, zoom: 1 },
    ...over,
  }) as CablePlannerProject

const artikel = (over: Partial<InventoryItem> & { id: string }): InventoryItem =>
  ({ model: 'Ursa Mini', quantity: 1, ...over }) as InventoryItem

const ausgabe = (over: Partial<CheckoutRecord> & { id: string }): CheckoutRecord =>
  ({
    nodeId: 'n1',
    nodeLabel: 'Case 3',
    contents: [],
    out: { at: '2026-09-01T08:00:00Z', to: 'Truck 1' },
    ...over,
  }) as CheckoutRecord

const crew = (over: Partial<CrewPlan> = {}): CrewPlan => ({
  people: [],
  bands: [],
  rates: [],
  entries: [],
  expenses: [],
  approvals: [],
  ...over,
})

const ids = (items: ActionItem[]) => items.map((i) => i.id)

describe('eine leere Lage ergibt eine leere Liste', () => {
  it('erfindet keine Zeile „alles in Ordnung"', () => {
    expect(actionItems({ today: HEUTE, project: projekt() })).toEqual([])
  })

  it('zählt dann auch nichts', () => {
    expect(actionCounts([])).toEqual({ overdue: 0, today: 0, ahead: 0, undated: 0 })
  })
})

describe('Dringlichkeit kommt vom Termin, nie von der Vermutung', () => {
  it('nennt ohne Termin „ohne Termin" und nicht „überfällig"', () => {
    expect(urgencyOf(undefined, HEUTE)).toBe('undated')
    expect(urgencyOf('', HEUTE)).toBe('undated')
  })

  it('unterscheidet gestern, heute und morgen', () => {
    expect(urgencyOf('2026-09-06', HEUTE)).toBe('overdue')
    expect(urgencyOf(HEUTE, HEUTE)).toBe('today')
    expect(urgencyOf('2026-09-08', HEUTE)).toBe('ahead')
  })

  it('hat für jede Stufe ein deutsches Wort', () => {
    expect(Object.keys(ACTION_URGENCY_LABEL).sort()).toEqual(
      ['ahead', 'overdue', 'today', 'undated'].sort(),
    )
  })
})

describe('fremdes Material, das zurückmuss', () => {
  const lager = [
    artikel({ id: 'i1', model: 'Funkstrecke', ownership: 'subhire', supplier: 'Ton AG', returnDue: '2026-09-02' }),
    artikel({ id: 'i2', model: 'Stativ', ownership: 'rented', supplier: 'Grip GmbH' }),
    artikel({ id: 'i3', model: 'Eigenes Case', ownership: 'owned' }),
  ]
  const items = actionItems({ today: HEUTE, project: projekt(), inventory: lager })

  it('nimmt das überfällige mit seinem Termin auf', () => {
    const a = items.find((i) => i.id.includes('i1'))
    expect(a?.urgency).toBe('overdue')
    expect(a?.when).toBe('2026-09-02')
  })

  it('nimmt das undatierte auf, ohne ihm einen Termin zu geben', () => {
    const b = items.find((i) => i.id.includes('i2'))
    expect(b?.urgency).toBe('undated')
    expect(b?.when).toBeUndefined()
  })

  it('lässt eigenes Material in Ruhe', () => {
    expect(items.some((i) => i.id.includes('i3'))).toBe(false)
  })

  it('nennt den Vertrag richtig — gemietet ist nicht Sub-Hire', () => {
    // Der Zusatz kommt aus `ownershipNote`; ein hier geratenes „Sub-Hire"
    // stünde auf einem gemieteten Stück.
    expect(items.find((i) => i.id.includes('i2'))?.detail).toContain('Gemietet')
    expect(items.find((i) => i.id.includes('i1'))?.detail).toContain('Sub-Hire')
  })
})

describe('offene Ausgaben', () => {
  it('meldet die überfällige und nicht die pünktliche', () => {
    const items = actionItems({
      today: HEUTE,
      project: projekt(),
      checkouts: [
        ausgabe({ id: 'c1', out: { at: '2026-09-01T08:00:00Z', to: 'Truck 1', dueBack: '2026-09-05' } }),
        ausgabe({ id: 'c2', out: { at: '2026-09-01T08:00:00Z', to: 'Truck 2', dueBack: '2026-09-20' } }),
      ],
    })
    expect(ids(items)).toEqual(['checkout:overdue:c1'])
    expect(items[0].when).toBe('2026-09-05')
  })
})

describe('was aus den Stunden kommt', () => {
  const plan = crew({
    people: [{ id: 'p1', name: 'Anna Berg' }],
    rates: [{ id: 'r1', personId: 'p-weg', activity: 'Kamera', hourlyAmount: 60, bandIds: [] }],
    entries: [
      { id: 'e1', personId: 'p1', rateId: 'r1', date: '2026-09-03', startMinute: 480, endMinute: 480 },
    ],
    expenses: [{ id: 'x1', kind: 'travel', date: '2026-09-04', amount: 20, billable: true }],
  })
  const items = actionItems({ today: HEUTE, project: projekt({ crewPlan: plan }) })

  it('gibt einer Schicht das Datum der Schicht', () => {
    const leer = items.find((i) => i.id === 'crew:zero-length:e1')
    expect(leer?.when).toBe('2026-09-03')
    expect(leer?.urgency).toBe('overdue')
  })

  it('gibt einem Satz kein Datum, weil er keins hat', () => {
    const satz = items.find((i) => i.id === 'crew:person-missing:r1')
    expect(satz).toBeDefined()
    expect(satz?.when).toBeUndefined()
    expect(satz?.urgency).toBe('undated')
  })

  it('nimmt den Wortlaut aus der Quelle, statt ihn neu zu formulieren', () => {
    const leer = items.find((i) => i.id === 'crew:zero-length:e1')
    expect(leer?.title).toBe(LABOUR_FINDING_LABEL['zero-length'])
  })
})

describe('was aus den Kosten kommt', () => {
  const mit = (tolerancePercent: number | undefined) =>
    actionItems({
      today: HEUTE,
      project: projekt({
        costPlan: {
          currency: 'EUR',
          ...(tolerancePercent !== undefined ? { tolerancePercent } : {}),
          lines: [
            {
              id: 'k1',
              label: 'Kamerazug',
              anchor: { kind: 'free' },
              estimate: 100,
              actual: 200,
              actualSource: 'from-erp',
            },
          ],
        },
      }),
    })

  it('meldet die Abweichung über der Toleranz', () => {
    const items = mit(10)
    expect(items.some((i) => i.kind === 'over-tolerance')).toBe(true)
    expect(items.find((i) => i.kind === 'over-tolerance')?.title).toBe(
      COST_FINDING_LABEL['over-tolerance'],
    )
  })

  it('bringt die Einstellungs-Auskünfte NICHT auf die Handlungsliste', () => {
    // „Keine Toleranz gesetzt" steht auf der Kostenseite. Auf einer Liste, die
    // nach Dringlichkeit sortiert, stünde es jeden Tag — und dann wird die
    // ganze Liste überflogen statt gelesen.
    const items = mit(undefined)
    expect(items.some((i) => i.kind === 'no-tolerance')).toBe(false)
    expect(items.some((i) => i.kind === 'estimate-missing')).toBe(false)
  })

  it('gibt Kostenbefunden kein Datum — sie haben keins', () => {
    expect(mit(10).every((i) => (i.source === 'cost' ? i.when === undefined : true))).toBe(true)
  })
})

describe('was aus den Belegen kommt', () => {
  const items = actionItems({
    today: HEUTE,
    project: projekt({
      crewPlan: crew({
        expenses: [{ id: 'x1', kind: 'travel', date: '2026-09-02', amount: 20, billable: true }],
      }),
      costPlan: { currency: 'EUR', lines: [] },
    }),
  })

  it('meldet die nicht zugeordnete Auslage mit dem Datum der Auslage', () => {
    const a = items.find((i) => i.id === 'receipt:expense-unlinked:x1')
    expect(a?.when).toBe('2026-09-02')
    expect(a?.title).toBe(CHAIN_FINDING_LABEL['expense-unlinked'])
  })
})

describe('Buchungskonflikte', () => {
  it('meldet zwei Schichten derselben Person mit dem früheren Datum', () => {
    const items = actionItems({
      today: HEUTE,
      project: projekt({
        crewPlan: crew({
          people: [{ id: 'p1', name: 'Anna Berg' }],
          rates: [{ id: 'r1', personId: 'p1', activity: 'Kamera', hourlyAmount: 60, bandIds: [] }],
          entries: [
            { id: 'a', personId: 'p1', rateId: 'r1', date: '2026-09-10', startMinute: 480, endMinute: 840 },
            { id: 'b', personId: 'p1', rateId: 'r1', date: '2026-09-10', startMinute: 780, endMinute: 1080 },
          ],
        }),
      }),
    })
    const k = items.find((i) => i.source === 'booking')
    expect(k?.id).toBe('booking:conflict:a+b')
    expect(k?.when).toBe('2026-09-10')
    expect(k?.urgency).toBe('ahead')
  })
})

describe('die Reihenfolge ist die, in der es teuer wird', () => {
  // Gemischte Quellen mit Absicht: die Reihenfolge gilt ueber die ganze Liste
  // und nicht je Quelle. Eine leere Schicht ergibt `zero-length` am Datum der
  // Schicht, ein Satz ohne Person einen Befund ohne Datum.
  const leereSchicht = (id: string, date: string) => ({
    id,
    personId: 'p1',
    rateId: 'r1',
    date,
    startMinute: 480,
    endMinute: 480,
  })
  const items = actionItems({
    today: HEUTE,
    project: projekt({
      crewPlan: crew({
        people: [{ id: 'p1', name: 'Anna Berg' }],
        rates: [
          { id: 'r1', personId: 'p1', activity: 'Kamera', hourlyAmount: 60, bandIds: [] },
          { id: 'r2', personId: 'p-weg', activity: 'Ton', hourlyAmount: 50, bandIds: [] },
        ],
        entries: [
          leereSchicht('e-alt', '2026-09-01'),
          leereSchicht('e-neu', '2026-09-05'),
          leereSchicht('e-heute', HEUTE),
          leereSchicht('e-bald', '2026-09-09'),
          leereSchicht('e-fern', '2026-09-30'),
        ],
      }),
    }),
  })

  it('sortiert überfällig vor heute vor anstehend vor undatiert', () => {
    expect(items.map((i) => i.urgency)).toEqual([
      'overdue',
      'overdue',
      'today',
      'ahead',
      'ahead',
      'undated',
    ])
  })

  it('stellt innerhalb der Überfälligen das älteste nach vorn', () => {
    expect(items.slice(0, 2).map((i) => i.when)).toEqual(['2026-09-01', '2026-09-05'])
  })

  it('stellt innerhalb des Anstehenden den nächsten Termin nach vorn', () => {
    expect(items.slice(3, 5).map((i) => i.when)).toEqual(['2026-09-09', '2026-09-30'])
  })

  it('stellt das Undatierte ans Ende, ohne es zu verschweigen', () => {
    expect(items[5].id).toBe('crew:person-missing:r2')
  })

  it('zählt je Stufe', () => {
    expect(actionCounts(items)).toEqual({ overdue: 2, today: 1, ahead: 2, undated: 1 })
  })
})

// ───────────────────────────────────────────────────────────────────────────
// Die Zusage des Modulkopfes: diese Datei LEITET NICHTS AB, sie sammelt ein.
// Der Wortlaut kommt aus den Quellen — ausser bei den drei Quellen, die keine
// Befund-Tabelle haben. Der Test haelt beides fest.
// ───────────────────────────────────────────────────────────────────────────
describe('der Wortlaut stammt aus der Quelle', () => {
  const alleTexte = new Set<string>([
    ...Object.values(LABOUR_FINDING_LABEL),
    ...Object.values(COST_FINDING_LABEL),
    ...Object.values(CHAIN_FINDING_LABEL),
  ])

  const volleLage = actionItems({
    today: HEUTE,
    project: projekt({
      crewPlan: crew({
        people: [{ id: 'p1', name: 'Anna Berg' }],
        rates: [{ id: 'r1', personId: 'p1', activity: 'Kamera', hourlyAmount: 60, bandIds: [] }],
        entries: [
          { id: 'a', personId: 'p1', rateId: 'r1', date: '2026-09-10', startMinute: 480, endMinute: 840 },
          { id: 'b', personId: 'p1', rateId: 'r1', date: '2026-09-10', startMinute: 780, endMinute: 1080 },
        ],
        expenses: [{ id: 'x1', kind: 'travel', date: '2026-09-02', amount: 20, billable: true }],
      }),
      costPlan: {
        currency: 'EUR',
        tolerancePercent: 10,
        lines: [
          {
            id: 'k1',
            label: 'Kamerazug',
            anchor: { kind: 'free' },
            estimate: 100,
            actual: 200,
            actualSource: 'from-erp',
          },
        ],
      },
    }),
    inventory: [
      artikel({ id: 'i1', model: 'Funkstrecke', ownership: 'subhire', supplier: 'Ton AG', returnDue: '2026-09-02' }),
    ],
    checkouts: [
      ausgabe({ id: 'c1', out: { at: '2026-09-01T08:00:00Z', to: 'Truck 1', dueBack: '2026-09-05' } }),
    ],
  })

  it('deckt alle sechs Quellen ab', () => {
    expect([...new Set(volleLage.map((i) => i.source))].sort()).toEqual(
      ['booking', 'checkout', 'cost', 'crew', 'receipt', 'subhire'].sort(),
    )
  })

  it('formuliert nur bei den Quellen ohne Befund-Tabelle selbst', () => {
    const selbst = [
      ...new Set(volleLage.filter((i) => !alleTexte.has(i.title)).map((i) => i.source)),
    ].sort()
    expect(selbst).toEqual([...EIGENER_TEXT].sort())
  })

  it('vergibt stabile und eindeutige Kennungen', () => {
    expect(new Set(ids(volleLage)).size).toBe(volleLage.length)
    // Zweimal gerufen: dieselbe Lage, dieselben Kennungen. Sonst waere jede
    // Oberflaeche, die sich einen Haken merkt, beim naechsten Rendern blind.
    expect(ids(volleLage)).toEqual(ids([...volleLage]))
  })

  it('gibt keiner Zeile einen Termin, den ihre Quelle nicht hatte', () => {
    for (const i of volleLage) {
      if (i.when !== undefined) expect(i.when).toMatch(/^\d{4}-\d{2}-\d{2}$/)
      if (i.urgency === 'undated') expect(i.when).toBeUndefined()
      if (i.urgency !== 'undated') expect(i.when).toBeDefined()
    }
  })
})
