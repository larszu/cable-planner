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

// ───────────────────────────────────────────────────────────────────────────
// ADR-005, Inkrement 4 — der Hinweis endete auf TOP-LEVEL.
//
// Die Tests oben pruefen `unreadSections`, und einer davon nagelt fest, dass
// Settings/Users/Groups NICHT als ungelesen gemeldet werden. Das ist als
// Aussage ueber eine Top-Level-Liste richtig — und in der Wirkung irrefuehrend:
// weil die drei als „gelesen" gelten, konnte die Meldung per Konstruktion nie
// sagen, dass INNERHALB davon das meiste liegen bleibt.
//
// Pro Station liest der Parser fuenf Felder. Der Exporter schreibt den Rest
// aus Konstanten zurueck: `devices: []` (die Hardware-Registrierung der
// Beltpacks), `Channels`/`SpecialChannels` leer (die Tastenbelegungen),
// `Security.Pincode` leer, `AudioProfile` auf Standard-Gain. Der Operator las
// „Devices, Rooms, Templates", schloss daraus, seine Stationen seien
// uebernommen, benannte zwei um und exportierte zurueck.

const richerGg5 = () =>
  JSON.stringify({
    Settings: {
      Name: 'Halle',
      MulticastAddress: '239.1.160.1',
      SampleRate: 48000,
      Colors: { '1': 16711680, '2': 65280 },
    },
    Users: {
      keys: ['u1', 'u2'],
      u1: {
        myId: 1,
        Name: 'BPX Regie',
        Color: 1,
        devices: [{ serial: 'GG-0001' }],
        Channels: { '1': { Id: 3 } },
        Security: { Pincode: '4711' },
        AudioProfile: { '1': { Gain: 52 } },
      },
      u2: { myId: 2, Name: 'BPX Buehne', Gpio: { Input1: {} } },
    },
    Groups: {
      keys: ['g1'],
      g1: { myId: 1, Name: 'Produktion', Description: 'PGM-Kreis', members: {} },
    },
  })

describe('parseGg5File — meldet auch den Verlust INNERHALB der gelesenen Sektionen', () => {
  it('nennt die ungelesenen Felder je Sektion', () => {
    const r = parseGg5File(richerGg5())
    expect(isParseError(r)).toBe(false)
    if (isParseError(r)) return
    const bySection = Object.fromEntries(r.unreadFields.map((u) => [u.section, u]))

    expect(bySection.Users.fields).toEqual([
      'AudioProfile',
      'Channels',
      'Gpio',
      'Security',
      'devices',
    ])
    expect(bySection.Settings.fields).toEqual(['Colors'])
    expect(bySection.Groups.fields).toEqual(['Description'])
  })

  it('zaehlt die betroffenen Eintraege — eine Station oder zwoelf ist ein Unterschied', () => {
    const r = parseGg5File(richerGg5())
    if (isParseError(r)) return
    const users = r.unreadFields.find((u) => u.section === 'Users')
    expect(users?.entries).toBe(2)
  })

  it('meldet nichts, wenn die Eintraege nur Gelesenes enthalten', () => {
    const r = parseGg5File(gg5())
    expect(isParseError(r)).toBe(false)
    if (isParseError(r)) return
    // Die Basis-Fixture oben hat pro Eintrag ein `Settings: {}` — das ist
    // ungelesen und SOLL gemeldet werden. Ohne dieses Feld bleibt es leer.
    const clean = parseGg5File(
      JSON.stringify({
        Settings: { Name: 'H', MulticastAddress: 'x', SampleRate: 48000 },
        Users: { keys: ['u1'], u1: { myId: 1, Name: 'A' } },
        Groups: { keys: ['g1'], g1: { myId: 1, Name: 'G' } },
      }),
    )
    if (isParseError(clean)) return
    expect(clean.unreadFields).toEqual([])
  })

  it('leitet auch hier aus der Datei ab, nicht aus einer gepflegten Liste', () => {
    const r = parseGg5File(
      JSON.stringify({
        Settings: { Name: 'H', MulticastAddress: 'x', SampleRate: 48000 },
        Users: { keys: ['u1'], u1: { myId: 1, Name: 'A', FeldVonMorgen: 1 } },
        Groups: { keys: [] },
      }),
    )
    if (isParseError(r)) return
    expect(r.unreadFields.find((u) => u.section === 'Users')?.fields).toEqual(['FeldVonMorgen'])
  })

  it('haelt die alte Top-Level-Meldung unveraendert — die beiden ergaenzen sich', () => {
    const r = parseGg5File(richerGg5())
    if (isParseError(r)) return
    expect(r.unreadSections).toEqual([])
    expect(r.unreadFields.length).toBeGreaterThan(0)
    // Genau der Fall, der frueher STILL war: keine Top-Level-Sektion fehlt,
    // und trotzdem geht bei jedem Beltpack die Registrierung verloren.
  })
})
