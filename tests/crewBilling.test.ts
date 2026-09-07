import { describe, expect, it } from 'vitest'
import { crewBilling, crewBillingCsv, crewBillingHandoff } from '../src/renderer/lib/crewBilling'
import type { CrewPlan } from '../src/renderer/types/labour'

// Zwei Personen, zwei Taetigkeiten, ein Monat. Die Zahlen sind so gewaehlt,
// dass man sie im Kopf nachrechnen kann — ein Test, dessen Erwartung man aus
// dem Ergebnis abgeschrieben hat, prueft nichts.
const plan: CrewPlan = {
  people: [
    { id: 'p1', name: 'Anna Berg', company: 'freiberuflich' },
    { id: 'p2', name: 'Bo Klein' },
  ],
  bands: [],
  rates: [
    { id: 'r1', personId: 'p1', activity: 'Kamera', hourlyAmount: 60, bandIds: [], calloutAmount: 40 },
    { id: 'r2', personId: 'p1', activity: 'Fahrer', hourlyAmount: 30, bandIds: [] },
    { id: 'r3', personId: 'p2', activity: 'Ton', hourlyAmount: 50, bandIds: [] },
  ],
  entries: [
    // September: 8 h Kamera, 2 h Fahrer (Anna), 6 h Ton (Bo)
    { id: 'e1', personId: 'p1', rateId: 'r1', date: '2026-09-09', startMinute: 600, endMinute: 1080 },
    { id: 'e2', personId: 'p1', rateId: 'r2', date: '2026-09-10', startMinute: 480, endMinute: 600 },
    { id: 'e3', personId: 'p2', rateId: 'r3', date: '2026-09-09', startMinute: 600, endMinute: 960 },
    // Oktober — darf im September-Blatt nicht auftauchen
    { id: 'e4', personId: 'p2', rateId: 'r3', date: '2026-10-01', startMinute: 600, endMinute: 960 },
  ],
  expenses: [
    { id: 'x1', personId: 'p1', kind: 'travel', date: '2026-09-09', amount: 84.5, billable: true, receiptRef: 'T-1' },
    { id: 'x2', personId: 'p1', kind: 'per-diem', date: '2026-09-09', amount: 28, billable: false },
    { id: 'x3', kind: 'accommodation', date: '2026-10-01', amount: 110, billable: true, receiptRef: 'H-9' },
  ],
  approvals: [],
}

const september = { from: '2026-09-01', to: '2026-09-30' }

describe('der Zeitraum schneidet, was nicht hineingehört', () => {
  it('nimmt die Oktober-Schicht nicht mit', () => {
    const b = crewBilling(plan, september)
    expect(b.rows.find((r) => r.personName === 'Bo Klein')?.minutes).toBe(360)
    expect(b.hoursTotal).toBe(480 + 120 + 360)
  })

  it('nimmt die Oktober-Auslage nicht mit', () => {
    const b = crewBilling(plan, september)
    expect(b.expenses.map((e) => e.expense.id)).toEqual(['x1', 'x2'])
  })

  it('ordnet eine Nachtschicht dem Tag zu, an dem sie BEGANN', () => {
    // 30.09. 22:00 bis 01.10. 02:00 — gehört in den September.
    const nacht: CrewPlan = {
      ...plan,
      entries: [
        { id: 'n1', personId: 'p2', rateId: 'r3', date: '2026-09-30', startMinute: 1320, endMinute: 1560 },
      ],
      expenses: [],
    }
    expect(crewBilling(nacht, september).hoursTotal).toBe(240)
    expect(crewBilling(nacht, { from: '2026-10-01', to: '2026-10-31' }).hoursTotal).toBe(0)
  })
})

describe('die Summen', () => {
  const b = crewBilling(plan, september)

  it('hält zwei Tätigkeiten derselben Person auseinander', () => {
    const anna = b.rows.filter((r) => r.personName === 'Anna Berg')
    expect(anna.map((r) => r.activity).sort()).toEqual(['Fahrer', 'Kamera'])
    expect(anna.find((r) => r.activity === 'Kamera')?.amount).toBe(480)
    expect(anna.find((r) => r.activity === 'Fahrer')?.amount).toBe(60)
  })

  it('rechnet die Pauschale nur beim Satz, der eine hat', () => {
    const anna = b.rows.filter((r) => r.personName === 'Anna Berg')
    expect(anna.find((r) => r.activity === 'Kamera')?.callout).toBe(40)
    expect(anna.find((r) => r.activity === 'Fahrer')?.callout).toBe(0)
  })

  it('trennt weiterberechenbare Auslagen von eigenen', () => {
    expect(b.expensesBillable).toBe(84.5)
    expect(b.expensesOwn).toBe(28)
  })

  it('zählt nur Weiterberechenbares in die Kundensumme', () => {
    // Arbeit: 480 + 40 + 60 + 300 = 880. Plus 84,50 Fahrt.
    expect(b.labourTotal).toBe(880)
    expect(b.billableTotal).toBe(964.5)
    // Die eigene Verpflegung steckt in KEINER der beiden Zahlen.
    expect(b.billableTotal).not.toBe(992.5)
  })
})

describe('das Blatt', () => {
  it('trägt Arbeit und Auslagen in EINER Tabelle', () => {
    const csv = crewBillingCsv(crewBilling(plan, september))
    expect(csv).toContain('Arbeit;Anna Berg')
    expect(csv).toContain('Auslage;Anna Berg')
  })

  it('setzt eine nicht weiterberechenbare Auslage in Klammern', () => {
    const zeilen = crewBillingCsv(crewBilling(plan, september)).split('\r\n')
    expect(zeilen.find((z) => z.includes('Verpflegung'))).toContain('(28.00)')
    expect(zeilen.find((z) => z.includes('Fahrt'))).toContain('84.50')
  })

  it('nennt die Person einer Auslage beim Namen statt bei ihrer Id', () => {
    const zeile = crewBillingCsv(crewBilling(plan, september))
      .split('\r\n')
      .find((z) => z.includes('Verpflegung'))
    expect(zeile).toContain('Anna Berg')
    expect(zeile).not.toContain('p1')
  })

  it('schreibt Stunden als 8:00 h', () => {
    expect(crewBillingCsv(crewBilling(plan, september))).toContain('8:00 h')
  })
})

describe('die Übergabe an die Buchhaltung', () => {
  const h = crewBillingHandoff(crewBilling(plan, september))

  it('führt Stunden als Dezimalzahl mit Netto-Einzelpreis', () => {
    const kamera = h.find((l) => l.name.startsWith('Kamera'))
    expect(kamera).toMatchObject({ quantity: 8, unit: 'Stunde', unitPriceNet: 60 })
  })

  it('führt die Pauschale als eigene Position', () => {
    expect(h.find((l) => l.name.startsWith('Einsatzpauschale'))).toMatchObject({
      quantity: 1,
      unitPriceNet: 40,
    })
  })

  it('lässt eigene Auslagen weg — sie gehören auf kein Kundendokument', () => {
    expect(h.some((l) => l.name.includes('Verpflegung'))).toBe(false)
    expect(h.some((l) => l.name.includes('Fahrt'))).toBe(true)
  })

  it('nennt keinen Steuersatz — den kennt dieses Programm nicht', () => {
    for (const l of h) {
      expect(Object.keys(l)).not.toContain('taxRatePercent')
      expect(Object.keys(l)).not.toContain('vat')
    }
  })

  it('leitet den Einzelpreis aus dem GERECHNETEN Betrag ab, nicht aus dem Grundsatz', () => {
    // Mit Zuschlag liegt der effektive Stundenpreis ueber dem Grundsatz —
    // sonst stuende auf der Rechnung eine Zahl, die nicht zur Summe passt.
    const mitZuschlag: CrewPlan = {
      ...plan,
      bands: [{ id: 'b1', label: 'Nacht', days: [], fromMinute: 0, toMinute: 1440, surchargePercent: 50 }],
      rates: [{ id: 'r1', personId: 'p1', activity: 'Kamera', hourlyAmount: 60, bandIds: ['b1'] }],
      entries: [
        { id: 'e1', personId: 'p1', rateId: 'r1', date: '2026-09-09', startMinute: 600, endMinute: 1080 },
      ],
      expenses: [],
    }
    const l = crewBillingHandoff(crewBilling(mitZuschlag, september))[0]
    expect(l.unitPriceNet).toBe(90)
    expect(l.quantity * l.unitPriceNet).toBe(720)
  })
})

describe('was nicht bewertet werden konnte, steht oben statt zu fehlen', () => {
  it('zählt Schichten ohne Satz und verschweigt sie nicht', () => {
    const kaputt: CrewPlan = {
      ...plan,
      entries: [
        { id: 'e9', personId: 'p1', rateId: 'weg', date: '2026-09-09', startMinute: 600, endMinute: 1080 },
      ],
      expenses: [],
    }
    const b = crewBilling(kaputt, september)
    expect(b.unpricedEntries).toBe(1)
    expect(b.labourTotal).toBe(0)
  })
})
