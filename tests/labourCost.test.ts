import { describe, expect, it } from 'vitest'
import {
  bandFuerMinute,
  dayKindOf,
  entryCost,
  expenseTotals,
  formatHours,
  labourCosts,
  labourFindings,
  labourTotals,
} from '../src/renderer/lib/labourCost'
import type { CrewPlan, CrewRate, RateBand, TimeEntry } from '../src/renderer/types/labour'

// ── Die Rechnung, an der der Beleg gescheitert ist ──────────────────────────
//
// `kimai/kimai#5913` (2026-04-20): „10h at 50 + 2h at 55 computed as 12x50".
// Genau dieser Fall steht als erster Test. Er ist kein Randfall — er ist die
// haeufigste Form eines AV-Tages: morgens Aufbau, abends Show.

const person = { id: 'p1', name: 'Anna Berg' }

const satz = (over: Partial<CrewRate> = {}): CrewRate => ({
  id: 'r1',
  personId: 'p1',
  activity: 'Kamera',
  hourlyAmount: 50,
  bandIds: [],
  ...over,
})

const schicht = (over: Partial<TimeEntry> = {}): TimeEntry => ({
  id: 'e1',
  personId: 'p1',
  rateId: 'r1',
  date: '2026-09-09', // Mittwoch
  startMinute: 8 * 60,
  endMinute: 18 * 60,
  ...over,
})

const plan = (over: Partial<CrewPlan> = {}): CrewPlan => ({
  people: [person],
  bands: [],
  rates: [satz()],
  entries: [schicht()],
  expenses: [],
  approvals: [],
  ...over,
})

describe('zwei Sätze an einem Tag — der Fall aus dem Beleg', () => {
  it('rechnet 10 h zu 50 und 2 h zu 55 als 610 und nicht als 12 × 50', () => {
    const p = plan({
      rates: [
        satz({ id: 'r-tag', hourlyAmount: 50, activity: 'Aufbau' }),
        satz({ id: 'r-show', hourlyAmount: 55, activity: 'Kamera' }),
      ],
      entries: [
        schicht({ id: 'e-tag', rateId: 'r-tag', startMinute: 8 * 60, endMinute: 18 * 60 }),
        schicht({ id: 'e-show', rateId: 'r-show', startMinute: 18 * 60, endMinute: 20 * 60 }),
      ],
    })
    const summe = labourCosts(p).reduce((s, c) => s + c.amount, 0)
    expect(summe).toBe(610)
    expect(summe).not.toBe(600)
  })

  it('hält die beiden Tätigkeiten in der Summenzeile auseinander', () => {
    const p = plan({
      rates: [
        satz({ id: 'r-tag', hourlyAmount: 50, activity: 'Aufbau' }),
        satz({ id: 'r-show', hourlyAmount: 55, activity: 'Kamera' }),
      ],
      entries: [
        schicht({ id: 'e-tag', rateId: 'r-tag', startMinute: 8 * 60, endMinute: 18 * 60 }),
        schicht({ id: 'e-show', rateId: 'r-show', startMinute: 18 * 60, endMinute: 20 * 60 }),
      ],
    })
    const summen = labourTotals(p)
    expect(summen).toHaveLength(2)
    expect(summen.map((s) => s.activity).sort()).toEqual(['Aufbau', 'Kamera'])
  })
})

// ── Zuschlagsbänder (kimai#3403) ────────────────────────────────────────────

const abend: RateBand = {
  id: 'b-abend',
  label: 'Abend',
  days: [],
  fromMinute: 17 * 60,
  toMinute: 20 * 60,
  surchargePercent: 10,
}
const nacht: RateBand = {
  id: 'b-nacht',
  label: 'Nacht',
  days: [],
  fromMinute: 20 * 60,
  toMinute: 6 * 60, // über Mitternacht
  surchargePercent: 25,
}
const sonntag: RateBand = {
  id: 'b-sonntag',
  label: 'Sonntag',
  days: ['sunday'],
  fromMinute: 0,
  toMinute: 1440,
  surchargePercent: 50,
}

describe('die Bänder aus dem Beleg: 09–17 = 100 %, 17–20 = +10 %, später = +25 %', () => {
  it('rechnet jede Minute in ihrem Band', () => {
    const p = plan({
      bands: [abend, nacht],
      rates: [satz({ hourlyAmount: 60, bandIds: ['b-abend', 'b-nacht'] })],
      entries: [schicht({ startMinute: 16 * 60, endMinute: 22 * 60 })],
    })
    // 1 h regulär (16–17) = 60, 3 h +10 % (17–20) = 198, 2 h +25 % (20–22) = 150
    expect(labourCosts(p)[0].amount).toBe(408)
  })

  it('nimmt ein Band über Mitternacht mit in den Folgetag', () => {
    const p = plan({
      bands: [nacht],
      rates: [satz({ hourlyAmount: 60, bandIds: ['b-nacht'] })],
      // 22:00 bis 02:00 des Folgetags
      entries: [schicht({ startMinute: 22 * 60, endMinute: 26 * 60 })],
    })
    // Alle vier Stunden liegen im Nachtband: 4 × 75 = 300
    expect(labourCosts(p)[0].amount).toBe(300)
    expect(labourCosts(p)[0].segments).toHaveLength(1)
  })

  it('wechselt um Mitternacht die Tagesart', () => {
    // Samstag 23:00 bis Sonntag 01:00. Das Sonntagsband gilt erst ab 00:00.
    const p = plan({
      bands: [sonntag],
      rates: [satz({ hourlyAmount: 60, bandIds: ['b-sonntag'] })],
      entries: [schicht({ date: '2026-09-12', startMinute: 23 * 60, endMinute: 25 * 60 })],
    })
    const c = labourCosts(p)[0]
    // 1 h Samstag ohne Zuschlag = 60, 1 h Sonntag +50 % = 90
    expect(c.amount).toBe(150)
    expect(c.segments.map((s) => s.bandPercent).sort()).toEqual([0, 50])
  })
})

describe('überlappende Bänder stapeln nicht', () => {
  it('nimmt auf jeder Minute den höchsten Zuschlag, nicht die Summe', () => {
    const p = plan({
      bands: [nacht, sonntag],
      rates: [satz({ hourlyAmount: 60, bandIds: ['b-nacht', 'b-sonntag'] })],
      // Sonntag 22:00–23:00: Nacht (+25) UND Sonntag (+50) treffen zu.
      entries: [schicht({ date: '2026-09-13', startMinute: 22 * 60, endMinute: 23 * 60 })],
    })
    // Gestapelt wären es 60 × 1,75 = 105. Die Regel sagt 60 × 1,5 = 90.
    expect(labourCosts(p)[0].amount).toBe(90)
  })

  it('bandFuerMinute nennt das teuerste Band beim Namen', () => {
    expect(bandFuerMinute([nacht, sonntag], 'sunday', 22 * 60)?.label).toBe('Sonntag')
    expect(bandFuerMinute([nacht, sonntag], 'weekday', 22 * 60)?.label).toBe('Nacht')
    expect(bandFuerMinute([nacht, sonntag], 'weekday', 12 * 60)).toBeUndefined()
  })
})

describe('Überstunden', () => {
  it('addieren sich mit dem Bandzuschlag, statt ihn zu ersetzen', () => {
    const p = plan({
      bands: [abend],
      rates: [
        satz({
          hourlyAmount: 60,
          bandIds: ['b-abend'],
          overtimeAfterHours: 8,
          overtimePercent: 25,
        }),
      ],
      // 09:00–19:00: ab 17:00 Abendband, ab der 9. Stunde Überstunde.
      entries: [schicht({ startMinute: 9 * 60, endMinute: 19 * 60 })],
    })
    const c = labourCosts(p)[0]
    // 8 h regulär (09–17) = 480; 17–19 ist Abend UND Überstunde:
    // 2 h × 60 × (1 + 0,10 + 0,25) = 162. Summe 642.
    expect(c.amount).toBe(642)
    expect(c.overtimeMinutes).toBe(120)
  })

  it('zählt die Tagesschwelle über MEHRERE Einträge — der Tag lässt sich nicht kleinschneiden', () => {
    const geteilt = plan({
      rates: [satz({ hourlyAmount: 60, overtimeAfterHours: 8, overtimePercent: 50 })],
      entries: [
        schicht({ id: 'a', startMinute: 8 * 60, endMinute: 13 * 60 }),
        schicht({ id: 'b', startMinute: 13 * 60, endMinute: 18 * 60 }),
      ],
    })
    const amStueck = plan({
      rates: [satz({ hourlyAmount: 60, overtimeAfterHours: 8, overtimePercent: 50 })],
      entries: [schicht({ startMinute: 8 * 60, endMinute: 18 * 60 })],
    })
    const summeGeteilt = labourCosts(geteilt).reduce((s, c) => s + c.amount, 0)
    const summeAmStueck = labourCosts(amStueck).reduce((s, c) => s + c.amount, 0)
    expect(summeGeteilt).toBe(summeAmStueck)
    // 8 h × 60 + 2 h × 90 = 660
    expect(summeGeteilt).toBe(660)
  })

  it('ohne Schwelle gibt es keine Überstunde', () => {
    const p = plan({ rates: [satz({ hourlyAmount: 60 })], entries: [schicht({ startMinute: 0, endMinute: 14 * 60 })] })
    expect(labourCosts(p)[0].overtimeMinutes).toBe(0)
  })
})

describe('die Einsatzpauschale', () => {
  it('fällt einmal je Person und Tag an, nicht je Eintrag', () => {
    const p = plan({
      rates: [satz({ calloutAmount: 35 })],
      entries: [
        schicht({ id: 'a', startMinute: 8 * 60, endMinute: 12 * 60 }),
        schicht({ id: 'b', startMinute: 13 * 60, endMinute: 18 * 60 }),
      ],
    })
    expect(labourCosts(p).reduce((s, c) => s + c.callout, 0)).toBe(35)
  })

  it('fällt an zwei Tagen zweimal an', () => {
    const p = plan({
      rates: [satz({ calloutAmount: 35 })],
      entries: [
        schicht({ id: 'a', date: '2026-09-09' }),
        schicht({ id: 'b', date: '2026-09-10' }),
      ],
    })
    expect(labourCosts(p).reduce((s, c) => s + c.callout, 0)).toBe(70)
  })

  it('steht neben dem Stundenanteil und nicht darin', () => {
    const p = plan({ rates: [satz({ hourlyAmount: 50, calloutAmount: 35 })] })
    const c = labourCosts(p)[0]
    expect(c.amount).toBe(500)
    expect(c.callout).toBe(35)
    expect(labourTotals(p)[0].total).toBe(535)
  })
})

describe('Feiertage', () => {
  it('schlagen den Wochentag', () => {
    expect(dayKindOf('2026-09-09', new Set())).toBe('weekday')
    expect(dayKindOf('2026-09-09', new Set(['2026-09-09']))).toBe('holiday')
    expect(dayKindOf('2026-09-12', new Set())).toBe('saturday')
    expect(dayKindOf('2026-09-13', new Set())).toBe('sunday')
  })

  it('greifen im Plan über das Feld `holidays`', () => {
    const feiertagsband: RateBand = {
      id: 'b-fest',
      label: 'Feiertag',
      days: ['holiday'],
      fromMinute: 0,
      toMinute: 1440,
      surchargePercent: 100,
    }
    const p = plan({
      bands: [feiertagsband],
      rates: [satz({ hourlyAmount: 50, bandIds: ['b-fest'] })],
      holidays: ['2026-09-09'],
    })
    expect(labourCosts(p)[0].amount).toBe(1000) // 10 h × 50 × 2
  })
})

describe('was nicht aufgeht, wird gemeldet statt gerechnet', () => {
  it('bewertet eine Schicht ohne Satz gar nicht — statt sie mit null zu bewerten', () => {
    const p = plan({ entries: [schicht({ rateId: 'gibt-es-nicht' })] })
    expect(labourCosts(p)).toHaveLength(0)
    expect(labourFindings(p).map((f) => f.kind)).toContain('rate-missing')
  })

  it('meldet zwei Schichten derselben Person, die sich überschneiden', () => {
    const p = plan({
      entries: [
        schicht({ id: 'a', startMinute: 8 * 60, endMinute: 14 * 60 }),
        schicht({ id: 'b', startMinute: 13 * 60, endMinute: 18 * 60 }),
      ],
    })
    expect(labourFindings(p).filter((f) => f.kind === 'overlap')).toHaveLength(1)
  })

  it('meldet eine Schicht ohne Dauer', () => {
    const p = plan({ entries: [schicht({ startMinute: 600, endMinute: 600 })] })
    expect(labourFindings(p).map((f) => f.kind)).toContain('zero-length')
  })

  it('meldet einen Satz, dessen Band es nicht gibt', () => {
    const p = plan({ rates: [satz({ bandIds: ['b-weg'] })] })
    expect(labourFindings(p).map((f) => f.kind)).toContain('band-missing')
  })

  it('meldet einen Satz, dessen Person es nicht gibt', () => {
    const p = plan({ people: [], rates: [satz()] })
    expect(labourFindings(p).map((f) => f.kind)).toContain('person-missing')
  })
})

describe('Mehrarbeit ohne Zusage — hier laufen Bedarf 40 und 42 zusammen', () => {
  const mitUeberstunden = (approvals: CrewPlan['approvals']): CrewPlan =>
    plan({
      rates: [satz({ overtimeAfterHours: 8, overtimePercent: 25 })],
      entries: [schicht({ startMinute: 8 * 60, endMinute: 20 * 60 })],
      approvals,
    })

  it('meldet Mehrarbeit, zu der keine Zusage im Plan steht', () => {
    const f = labourFindings(mitUeberstunden([]))
    expect(f.map((x) => x.kind)).toContain('overtime-unapproved')
    expect(f.find((x) => x.kind === 'overtime-unapproved')?.text).toContain('4.0 h')
  })

  it('schweigt, wenn die Zusage für DIESE Person an DIESEM Tag vorliegt', () => {
    const f = labourFindings(
      mitUeberstunden([
        {
          id: 'a1',
          capturedAt: '2026-09-09T20:10:00Z',
          channel: 'chat',
          by: 'Kunde',
          text: 'ja, macht die Überstunden',
          covers: { kind: 'overtime', personId: 'p1', date: '2026-09-09' },
        },
      ]),
    )
    expect(f.map((x) => x.kind)).not.toContain('overtime-unapproved')
  })

  it('lässt eine Zusage für einen ANDEREN Tag nicht gelten', () => {
    const f = labourFindings(
      mitUeberstunden([
        {
          id: 'a1',
          capturedAt: '2026-09-10T09:00:00Z',
          channel: 'chat',
          by: 'Kunde',
          text: 'ja',
          covers: { kind: 'overtime', personId: 'p1', date: '2026-09-10' },
        },
      ]),
    )
    expect(f.map((x) => x.kind)).toContain('overtime-unapproved')
  })

  it('meldet an Tagen ohne Mehrarbeit nichts', () => {
    const p = plan({ rates: [satz({ overtimeAfterHours: 12 })] })
    expect(labourFindings(p).map((x) => x.kind)).not.toContain('overtime-unapproved')
  })
})

describe('Auslagen (Bedarf 83)', () => {
  const auslage = (over = {}) => ({
    id: 'x1',
    kind: 'travel' as const,
    date: '2026-09-09',
    amount: 84.5,
    billable: true,
    ...over,
  })

  it('meldet eine weiterberechenbare Auslage ohne Beleg', () => {
    const p = plan({ expenses: [auslage()] })
    expect(labourFindings(p).map((f) => f.kind)).toContain('expense-without-receipt')
  })

  it('schweigt bei einer Auslage, die nicht weitergeht', () => {
    const p = plan({ expenses: [auslage({ billable: false })] })
    expect(labourFindings(p).map((f) => f.kind)).not.toContain('expense-without-receipt')
  })

  it('trennt weiterberechenbar von eigen', () => {
    const s = expenseTotals([
      auslage({ id: 'a', amount: 100, billable: true }),
      auslage({ id: 'b', amount: 40, billable: false }),
    ])
    expect(s).toEqual({ billable: 100, own: 40 })
  })
})

describe('Kleinigkeiten, die auf dem Blatt zählen', () => {
  it('schreibt Stunden als 7:30 h und nicht als 7,5', () => {
    expect(formatHours(450)).toBe('7:30 h')
    expect(formatHours(60)).toBe('1:00 h')
  })

  it('rundet auf Cent, nicht auf ganze Euro', () => {
    const c = entryCost(
      schicht({ startMinute: 0, endMinute: 7 }),
      satz({ hourlyAmount: 50 }),
      [],
      new Set(),
      0,
      true,
    )
    expect(c.amount).toBe(5.83)
  })
})
