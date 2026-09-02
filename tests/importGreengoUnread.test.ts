import { describe, expect, it } from 'vitest'
import { parseGg5File, isParseError } from '../src/renderer/lib/importGreengo'

// ADR-005, Inkrement 3 — vierter von Hand nachgelesener Hinweis, und der
// schwerste bestaetigte.
//
// Der Importer liest genau drei Sektionen (Settings, Users, Groups) — der
// Modulkopf sagt das sogar selbst und zaehlt „Devices, Rooms, Templates, …"
// als vorhanden auf. Der EXPORTER schreibt aber eine vollstaendige .gg5 und
// fuellt Channels, SpecialChannels, ScriptSettings und UserSettings aus
// hartkodierten Defaults. Wer eine echte Anlagen-Konfiguration importiert,
// etwas aendert und wieder exportiert, bekommt diese Abschnitte leer zurueck —
// auf einer Intercom-Anlage sind das die Tastenbelegungen.
//
// Bis der Round-Trip sie bewahrt, muss der Import wenigstens sagen, was er
// nicht gelesen hat. Genau das prueft dieser Test.

const gg5 = (extra: Record<string, unknown> = {}) =>
  JSON.stringify({
    Settings: { Name: 'Halle', MulticastAddress: '239.1.160.1', SampleRate: 48000 },
    Users: {
      keys: ['u1'],
      u1: { myId: 1, Name: 'BPX Regie', Settings: {} },
    },
    Groups: {
      keys: ['g1'],
      g1: { myId: 1, Name: 'Produktion', Settings: {} },
    },
    ...extra,
  })

describe('parseGg5File — meldet ungelesene Abschnitte (ADR-005)', () => {
  it('nennt jede Sektion, die es nicht liest', () => {
    const r = parseGg5File(gg5({ Devices: {}, Rooms: {}, Templates: {} }))
    expect(isParseError(r)).toBe(false)
    if (isParseError(r)) return
    expect(r.unreadSections).toEqual(['Devices', 'Rooms', 'Templates'])
  })

  it('meldet nichts, wenn die Datei nur Bekanntes enthaelt', () => {
    const r = parseGg5File(gg5())
    expect(isParseError(r)).toBe(false)
    if (isParseError(r)) return
    expect(r.unreadSections).toEqual([])
  })

  it('leitet die Liste aus der Datei ab, nicht aus einer gepflegten Aufzaehlung', () => {
    // Der Punkt der Ableitung: eine Sektion, die es 2026 noch gar nicht gibt,
    // wird trotzdem gemeldet. Eine zweite gepflegte Liste wuerde von den
    // gelesenen Sektionen auseinanderlaufen, sobald der Parser dazulernt.
    const r = parseGg5File(gg5({ ZukunftsSektion: { a: 1 } }))
    expect(isParseError(r)).toBe(false)
    if (isParseError(r)) return
    expect(r.unreadSections).toContain('ZukunftsSektion')
  })

  it('meldet die gelesenen Sektionen NICHT als ungelesen', () => {
    const r = parseGg5File(gg5({ Devices: {} }))
    expect(isParseError(r)).toBe(false)
    if (isParseError(r)) return
    for (const known of ['Settings', 'Users', 'Groups']) {
      expect(r.unreadSections).not.toContain(known)
    }
  })
})
