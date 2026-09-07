import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import {
  EXTEND_REFUSAL_TEXT,
  applyExtension,
  custodyPeriodText,
  custodyStartRefusal,
  extendRefusal,
  extensionCount,
  originalDueBack,
} from '../src/renderer/lib/custodyPeriod'
import type { CheckoutRecord } from '../src/renderer/types/checkout'

// ───────────────────────────────────────────────────────────────────────────
// Bedarf 98 — der Vorgang auf der Platte entsteht NACH dem Vorgang in der
// Halle.
//
//   > Ability to create a booking STARTING IN PAST, for items picked up in
//   > hurry
//   > edit bookings end date WHILE IT'S GOING ON (need to pull stuff for
//   > another place early, or to extend)
// ───────────────────────────────────────────────────────────────────────────

const JETZT = '2026-09-07T12:00:00.000Z'

const vorgang = (over: Partial<CheckoutRecord> = {}): CheckoutRecord =>
  ({
    id: 'c1',
    nodeId: 'n1',
    nodeLabel: 'Case 3',
    contents: [],
    out: { at: '2026-09-05T09:00:00.000Z', to: 'Truck 1', dueBack: '2026-09-10' },
    ...over,
  }) as CheckoutRecord

describe('eine Ausgabe darf nachgetragen werden', () => {
  it('nimmt einen Zeitpunkt von gestern an', () => {
    expect(custodyStartRefusal('2026-09-06T08:00:00.000Z', JETZT)).toBeUndefined()
  })

  it('nimmt auch einen weit zurückliegenden an — es gibt keine Nachtrags-Frist', () => {
    // Eine Grenze nach hinten wäre eine Vermutung darüber, wie spät jemand
    // seine Vorgänge nachträgt. Der Beleg sagt, dass genau das passiert.
    expect(custodyStartRefusal('2025-01-02T08:00:00.000Z', JETZT)).toBeUndefined()
  })

  it('lehnt einen Zeitpunkt in der Zukunft benannt ab', () => {
    // Was noch im Regal liegt, ist reserviert und nicht ausgegeben — ein
    // Vorgang, der es als draußen führt, macht die Lagerdeckung falsch.
    expect(custodyStartRefusal('2026-09-08T08:00:00.000Z', JETZT)).toBe('in-the-future')
  })

  it('lehnt Unlesbares ab, statt es auf jetzt zu setzen', () => {
    expect(custodyStartRefusal('gestern', JETZT)).toBe('not-a-time')
  })
})

describe('der Rückgabetermin lässt sich verschieben, solange der Vorgang läuft', () => {
  it('geht nach hinten', () => {
    expect(extendRefusal(vorgang(), '2026-09-17')).toBeUndefined()
  })

  it('geht auch nach vorn — früher abziehen steht im selben Satz des Belegs', () => {
    expect(extendRefusal(vorgang(), '2026-09-08')).toBeUndefined()
  })

  it('geht nicht mehr, wenn der Vorgang zurück ist', () => {
    const zurueck = vorgang({ in: { at: '2026-09-09T10:00:00.000Z', missing: [] } as never })
    expect(extendRefusal(zurueck, '2026-09-17')).toBe('already-back')
  })

  it('geht nicht vor den Tag der Ausgabe', () => {
    expect(extendRefusal(vorgang(), '2026-09-01')).toBe('before-start')
  })

  it('meldet den unveränderten Termin, statt eine leere Verschiebung zu schreiben', () => {
    expect(extendRefusal(vorgang(), '2026-09-10')).toBe('unchanged')
  })

  it('nimmt kein unlesbares Datum', () => {
    expect(extendRefusal(vorgang(), 'Freitag')).toBe('not-a-date')
  })

  it('hat für jede Absage einen deutschen Satz', () => {
    for (const t of Object.values(EXTEND_REFUSAL_TEXT)) expect(t.length).toBeGreaterThan(10)
  })
})

describe('der alte Termin bleibt stehen', () => {
  const eins = applyExtension(vorgang(), '2026-09-17', JETZT, 'Anna', 'Show verlängert')
  const zwei = applyExtension(eins, '2026-09-20', '2026-09-08T09:00:00.000Z')

  it('setzt den neuen Termin', () => {
    expect(eins.out.dueBack).toBe('2026-09-17')
  })

  it('hängt den alten an die Historie', () => {
    expect(eins.extensions?.[0]).toMatchObject({
      from: '2026-09-10',
      to: '2026-09-17',
      by: 'Anna',
      note: 'Show verlängert',
    })
  })

  it('zählt jede weitere Verschiebung mit', () => {
    expect(extensionCount(zwei)).toBe(2)
    // Der URSPRÜNGLICHE Termin, nicht der vorletzte: die Frage lautet „war
    // das von Anfang an so geplant?".
    expect(originalDueBack(zwei)).toBe('2026-09-10')
  })

  it('lässt den Vorgang ohne Verschiebung ohne Historie', () => {
    expect(vorgang().extensions).toBeUndefined()
    expect(extensionCount(vorgang())).toBe(0)
  })
})

describe('der Zeitraum als Satz', () => {
  it('nennt Ausgabe und Rückgabetermin', () => {
    expect(custodyPeriodText(vorgang(), '2026-09-07')).toBe(
      'ausgegeben 2026-09-05 · zurück 2026-09-10',
    )
  })

  it('sagt „Rückgabe offen" statt eines leeren Felds', () => {
    const ohne = vorgang({ out: { at: '2026-09-05T09:00:00.000Z', to: 'Truck 1' } })
    expect(custodyPeriodText(ohne, '2026-09-07')).toContain('Rückgabe offen')
  })

  it('nennt die Überfälligkeit mit ihrem Datum', () => {
    expect(custodyPeriodText(vorgang(), '2026-09-12')).toContain('überfällig seit 2026-09-10')
  })

  it('sagt, dass verschoben wurde — und wovon', () => {
    const v = applyExtension(vorgang(), '2026-09-17', JETZT)
    expect(custodyPeriodText(v, '2026-09-07')).toContain('einmal verschoben (zuerst 2026-09-10)')
  })
})

// ───────────────────────────────────────────────────────────────────────────
// Die dritte Hälfte der Massnahme: „Never require a scanner with no
// pick-from-list fallback (shelf.nu #2831)."
//
// Das ist eine Aussage über die Oberfläche und wird deshalb an der Oberfläche
// geprüft — nicht behauptet. Der Test fällt, wenn eines Tages jemand die
// Auswahl aus der Liste entfernt und nur den Scan stehen lässt.
// ───────────────────────────────────────────────────────────────────────────
describe('nichts verlangt einen Scanner', () => {
  const dlg = readFileSync(
    resolve(__dirname, '..', 'src/renderer/components/Inventory/InventoryDialog.tsx'),
    'utf8',
  )

  it('gibt den Container über eine Auswahlliste aus, nicht nur über einen Scan', () => {
    expect(dlg).toContain('setNodeId(')
    expect(dlg).toContain('disabled={!nodeId || !to.trim()}')
  })

  it('bucht per Knopf zurück, ohne dass etwas gescannt sein muss', () => {
    expect(dlg).toContain('bucheZurueck(')
    const zurueck = dlg.slice(dlg.indexOf('const bucheZurueck'))
    // Kein Scan-Zustand in der Rückbuchung: sie hängt an nichts Gescanntem.
    expect(zurueck.slice(0, 400)).not.toContain('scanDraft')
  })
})
