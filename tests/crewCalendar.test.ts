import { describe, expect, it } from 'vitest'
import { bookingConflicts, crewCalendar } from '../src/renderer/lib/crewCalendar'
import { labourCosts } from '../src/renderer/lib/labourCost'
import type { CrewPlan } from '../src/renderer/types/labour'

const basis: CrewPlan = {
  people: [{ id: 'p1', name: 'Anna Berg' }],
  bands: [],
  rates: [{ id: 'r1', personId: 'p1', activity: 'Kamera', hourlyAmount: 60, bandIds: [] }],
  entries: [
    {
      id: 'e1',
      personId: 'p1',
      rateId: 'r1',
      date: '2026-09-09',
      startMinute: 8 * 60,
      endMinute: 18 * 60,
    },
  ],
  expenses: [],
  approvals: [],
}

const opt = { projectName: 'Herbstgala', now: '2026-09-08T10:00:00Z', projectId: 'proj-1' }

describe('der Feed ist ein Kalender, den ein Leser versteht', () => {
  const ics = crewCalendar(basis, opt)

  it('trägt Kopf und Fuß nach RFC 5545', () => {
    expect(ics.startsWith('BEGIN:VCALENDAR\r\n')).toBe(true)
    expect(ics.endsWith('END:VCALENDAR\r\n')).toBe(true)
    expect(ics).toContain('VERSION:2.0')
  })

  it('endet jede Zeile mit CRLF, nicht mit LF', () => {
    const nurLf = ics.split('\r\n').join('').includes('\n')
    expect(nurLf).toBe(false)
  })

  it('nennt einen Aktualisierungstakt — sonst fragt ein Abonnement im Minutentakt', () => {
    expect(ics).toContain('REFRESH-INTERVAL;VALUE=DURATION:PT1H')
  })

  it('gibt jeder Schicht eine stabile UID aus Schicht- und Projekt-Id', () => {
    expect(ics).toContain('UID:e1@proj-1')
    // Zweimal erzeugt = dieselbe UID. Sonst fuellt sich das Abo mit Doppeln.
    expect(crewCalendar(basis, opt)).toContain('UID:e1@proj-1')
  })

  it('schreibt die Zeit ohne Zone (floating), nicht in UTC', () => {
    expect(ics).toContain('DTSTART:20260909T080000')
    expect(ics).not.toContain('DTSTART:20260909T080000Z')
  })

  it('rechnet eine Schicht über Mitternacht auf den Folgetag', () => {
    const nacht = {
      ...basis,
      entries: [{ ...basis.entries[0], startMinute: 22 * 60, endMinute: 26 * 60 }],
    }
    const s = crewCalendar(nacht, opt)
    expect(s).toContain('DTSTART:20260909T220000')
    expect(s).toContain('DTEND:20260910T020000')
  })
})

describe('der Buchungsstand kommt beim Leser an', () => {
  const mit = (booking: CrewPlan['entries'][number]['booking']) =>
    crewCalendar({ ...basis, entries: [{ ...basis.entries[0], booking }] }, opt)

  it('bildet vorgemerkt und reserviert auf TENTATIVE ab — RFC 5545 kennt keinen dritten Zwischenwert', () => {
    expect(mit('pencil')).toContain('STATUS:TENTATIVE')
    expect(mit('hold')).toContain('STATUS:TENTATIVE')
  })

  it('unterscheidet die beiden trotzdem — im Titel und in einer eigenen Eigenschaft', () => {
    expect(mit('pencil')).toContain('SUMMARY:[vorgemerkt]')
    expect(mit('hold')).toContain('SUMMARY:[reserviert]')
    expect(mit('pencil')).toContain('X-CP-BOOKING:pencil')
    expect(mit('hold')).toContain('X-CP-BOOKING:hold')
  })

  it('setzt bestätigt und geleistet auf CONFIRMED, ohne Vorsatz im Titel', () => {
    expect(mit('confirmed')).toContain('STATUS:CONFIRMED')
    expect(mit('worked')).toContain('STATUS:CONFIRMED')
    expect(mit('confirmed')).not.toContain('[bestätigt]')
  })

  it('behandelt eine Schicht ohne Buchungsstand als geleistet', () => {
    expect(mit(undefined)).toContain('STATUS:CONFIRMED')
    expect(mit(undefined)).toContain('X-CP-BOOKING:worked')
  })
})

describe('Sonderzeichen und lange Zeilen brechen den Feed nicht', () => {
  it('maskiert Komma, Semikolon und Backslash', () => {
    const p: CrewPlan = {
      ...basis,
      people: [{ id: 'p1', name: 'Berg, Anna; B\\B' }],
    }
    const ics = crewCalendar(p, opt)
    expect(ics).toContain('Berg\\, Anna\\; B\\\\B')
  })

  it('faltet Zeilen über 75 Zeichen mit führendem Leerzeichen', () => {
    const p: CrewPlan = {
      ...basis,
      people: [{ id: 'p1', name: 'A'.repeat(120) }],
    }
    for (const z of crewCalendar(p, opt).split('\r\n')) {
      expect(z.length).toBeLessThanOrEqual(75)
    }
    expect(crewCalendar(p, opt)).toContain('\r\n ')
  })
})

describe('Vormerkungen sind Planung und keine Rechnung', () => {
  const geplant: CrewPlan = {
    ...basis,
    entries: [
      { ...basis.entries[0], id: 'e-pencil', booking: 'pencil' },
      { ...basis.entries[0], id: 'e-hold', date: '2026-09-10', booking: 'hold' },
      { ...basis.entries[0], id: 'e-ok', date: '2026-09-11', booking: 'confirmed' },
    ],
  }

  it('nimmt vorgemerkt und reserviert NICHT in die Kosten', () => {
    expect(labourCosts(geplant).map((c) => c.entryId)).toEqual(['e-ok'])
  })

  it('zeigt sie trotzdem im Kalender — dafür ist er da', () => {
    const ics = crewCalendar(geplant, opt)
    expect(ics).toContain('UID:e-pencil@proj-1')
    expect(ics).toContain('UID:e-hold@proj-1')
  })
})

describe('Konflikte in der eigenen Datei', () => {
  it('findet zwei Schichten derselben Person, die sich überschneiden', () => {
    const p: CrewPlan = {
      ...basis,
      entries: [
        { ...basis.entries[0], id: 'a', startMinute: 8 * 60, endMinute: 14 * 60 },
        { ...basis.entries[0], id: 'b', startMinute: 13 * 60, endMinute: 18 * 60 },
      ],
    }
    const k = bookingConflicts(p)
    expect(k).toHaveLength(1)
    expect([k[0].a.id, k[0].b.id].sort()).toEqual(['a', 'b'])
  })

  it('erkennt auch die Überschneidung über Mitternacht hinweg', () => {
    const p: CrewPlan = {
      ...basis,
      entries: [
        { ...basis.entries[0], id: 'a', date: '2026-09-09', startMinute: 22 * 60, endMinute: 26 * 60 },
        { ...basis.entries[0], id: 'b', date: '2026-09-10', startMinute: 1 * 60, endMinute: 6 * 60 },
      ],
    }
    expect(bookingConflicts(p)).toHaveLength(1)
  })

  it('meldet zwei Schichten hintereinander nicht als Konflikt', () => {
    const p: CrewPlan = {
      ...basis,
      entries: [
        { ...basis.entries[0], id: 'a', startMinute: 8 * 60, endMinute: 12 * 60 },
        { ...basis.entries[0], id: 'b', startMinute: 12 * 60, endMinute: 18 * 60 },
      ],
    }
    expect(bookingConflicts(p)).toEqual([])
  })
})
