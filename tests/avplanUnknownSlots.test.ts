import { describe, expect, it } from 'vitest'
import {
  AVPLAN_KIND,
  AVPLAN_VERSION,
  KNOWN_DOMAIN_SLOTS,
  cableToAvPlan,
  makeAvPlan,
  parseAvPlan,
  pickUnknownDomains,
  unknownDomainSlots,
  type AvPlan,
  type AvVenue,
} from '../src/renderer/lib/avplan'
import avplanSrc from '../src/renderer/lib/avplan.ts?raw'

// ---------------------------------------------------------------------------
// ADR-005 — ein `.avplan`-Slot, den diese App nicht kennt.
//
// Der gemessene Ausgangszustand (ADR-005 Inkrement 3): keine der drei Apps
// reichte einen vierten Domaenen-Slot durch. Jede zaehlte beim Export genau
// die Slots auf, die sie kennt, und `parseAvPlan` nahm eine Datei mit einem
// unbekannten Slot trotzdem an. Damit war er weder bewahrt noch verweigert
// noch gemeldet — alle drei Auswege aus Regel 3 verfehlt, und das ist das
// einzige der drei denkbaren Verhalten, das nicht vertretbar ist.
//
// Entschieden wurde: laden, fragen, belegen lassen. Diese Datei prueft die
// Format-Haelfte davon — dass das Bewahren ueberhaupt moeglich ist. Die
// Abfrage selbst haengt an einem Dialog und steht in MenuBar.
// ---------------------------------------------------------------------------

const venue: AvVenue = { name: 'Halle', persons: [], walls: [], stageObjects: [] }

const planWith = (domains: AvPlan['domains']): AvPlan =>
  makeAvPlan({
    app: 'test',
    appVersion: '0.0.0',
    exportedAt: '2026-01-01T00:00:00Z',
    venue,
    domains,
  })

describe('unbekannte Domaenen-Slots erkennen', () => {
  it('nennt genau die Slots, die das Format nicht benennt', () => {
    const plan = planWith({ cabling: { a: 1 }, audio: { b: 2 }, rigging: { c: 3 } })
    expect(unknownDomainSlots(plan)).toEqual(['audio', 'rigging'])
  })

  it('haelt einen leeren Slot nicht faelschlich fuer vorhanden', () => {
    // `undefined` ist keine Aussage — ein Slot, der nur als Schluessel
    // existiert, ist nichts zum Bewahren und nichts zum Fragen.
    const plan = planWith({ cabling: {}, audio: undefined })
    expect(unknownDomainSlots(plan)).toEqual([])
  })

  it('nennt keinen der drei bekannten Slots', () => {
    const plan = planWith({ cabling: {}, cameras: {}, lighting: {} })
    expect(unknownDomainSlots(plan)).toEqual([])
  })

  it('pickUnknownDomains gibt genau diese Slots mit Inhalt zurueck', () => {
    const plan = planWith({ cabling: { a: 1 }, audio: { channels: 32 } })
    expect(pickUnknownDomains(plan)).toEqual({ audio: { channels: 32 } })
  })
})

describe('Round-Trip: ein fremder Slot ueberlebt', () => {
  it('traegt bewahrte Slots beim Export wieder in die Datei', () => {
    const project = {
      equipment: [],
      cables: [],
      avForeign: {
        venue,
        unknownDomains: { audio: { channels: 32 }, rigging: { points: 4 } },
      },
    }
    const plan = cableToAvPlan(project, {
      appVersion: '1.0.0',
      exportedAt: '2026-01-01T00:00:00Z',
    })
    expect(plan.domains.audio).toEqual({ channels: 32 })
    expect(plan.domains.rigging).toEqual({ points: 4 })
    // Und der eigene Slot steht weiterhin drin.
    expect(plan.domains.cabling).toBeDefined()
  })

  it('laesst einen fremden Slot NIEMALS den eigenen ueberschreiben', () => {
    // Der Angriffs-/Unfallfall: eine Datei bringt einen Slot namens `cabling`
    // im Fremd-Fach mit. Das eigene Projekt muss gewinnen, sonst schreibt ein
    // Import fremden Inhalt in die eigene Domaene.
    const project = {
      equipment: [{ id: 'A' }],
      cables: [],
      avForeign: { venue, unknownDomains: { cabling: { fremd: true } } },
    }
    const plan = cableToAvPlan(project, {
      appVersion: '1.0.0',
      exportedAt: '2026-01-01T00:00:00Z',
    })
    expect((plan.domains.cabling as { equipment: unknown[] }).equipment).toEqual([{ id: 'A' }])
    expect(plan.domains.cabling).not.toEqual({ fremd: true })
  })

  it('ueberlebt die ganze Runde Datei -> parse -> export -> parse', () => {
    const first = planWith({ cabling: { equipment: [], cables: [] }, audio: { channels: 32 } })
    const reparsed = parseAvPlan(JSON.stringify(first))
    expect(unknownDomainSlots(reparsed)).toEqual(['audio'])

    const project = {
      ...(reparsed.domains.cabling as Record<string, unknown>),
      avForeign: { venue: reparsed.venue, unknownDomains: pickUnknownDomains(reparsed) },
    }
    const exported = cableToAvPlan(project, {
      appVersion: '1.0.0',
      exportedAt: '2026-01-01T00:00:00Z',
    })
    const final = parseAvPlan(JSON.stringify(exported))
    expect(final.domains.audio).toEqual({ channels: 32 })
  })
})

describe('der Vertrag bleibt, wie er ist', () => {
  it('aendert weder kind noch formatVersion', () => {
    // Das Durchreichen ist ausdruecklich KEINE neue Format-Version: eine
    // v1-Datei bleibt v1, und eine aeltere App liest sie weiter.
    expect(AVPLAN_KIND).toBe('avplan')
    expect(AVPLAN_VERSION).toBe(1)
    const plan = planWith({ cabling: {}, audio: {} })
    expect(plan.kind).toBe('avplan')
    expect(plan.formatVersion).toBe(1)
  })

  it('haelt die Liste der bekannten Slots deckungsgleich mit dem Interface', () => {
    // Wer einen vierten Slot benennt, muss ihn hier eintragen — sonst meldet
    // `unknownDomainSlots` den eigenen Slot als fremd und der Nutzer wird
    // nach etwas gefragt, das die App sehr wohl kennt.
    const body = avplanSrc.slice(
      avplanSrc.indexOf('  domains: {'),
      avplanSrc.indexOf('export const KNOWN_DOMAIN_SLOTS'),
    )
    const named = [...body.matchAll(/^\s{4}(\w+)\?: unknown$/gm)].map((m) => m[1]).sort()
    expect(named).toEqual([...KNOWN_DOMAIN_SLOTS].sort())
  })
})
