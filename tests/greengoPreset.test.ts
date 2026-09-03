import { describe, expect, it } from 'vitest'
import { buildGg5File } from '../src/renderer/lib/exportGreengo'
import { parseGg5File, isParseError } from '../src/renderer/lib/importGreengo'
import type { GreenGoConfig } from '../src/renderer/types/greengo'

// ---------------------------------------------------------------------------
// Design-Frage 1, entschieden: „Editor UND Generator."
//
// Der Exporter baute bisher IMMER eine vollstaendige `.gg5` und fuellte
// Raeume, Templates, Geraete und Netz aus Konstanten. Wer eine echte
// Anlagen-Konfiguration importierte, etwas aenderte und wieder exportierte,
// bekam sie leer zurueck — `importGreengo` sagt das in seinem eigenen
// Kommentar und wartete auf genau diese Aenderung: „Bis der Round-Trip sie
// bewahrt, muss er wenigstens sagen, was er nicht gelesen hat."
//
// Jetzt: liegt ein Preset, wird hineingeschrieben; sonst wie bisher erzeugt.
// ---------------------------------------------------------------------------

/** Eine .gg5, wie sie von einer echten Anlage kaeme — mit allem, was wir nicht lesen. */
const anlage = () => ({
  Settings: {
    Name: 'Halle A',
    Description: 'Bestand',
    configId: 'aaaabbbb-ccccdddd',
    ConfigPassword: 'geheim-config',
    AdminPassword: 'geheim-admin',
    ConfigPasswordSet: 1,
    AdminPasswordSet: 1,
    SampleRate: 48000,
    MulticastAddress: '239.9.9.9',
    TechPincode: '4711',
    savedAtTimestamp: 1,
  },
  Users: {
    keys: ['1'],
    badge: 0,
    '1': {
      myId: 1,
      Name: 'BPX Regie',
      DisplayName: 'Regie',
      Color: 3,
      // Eine ECHTE Tastenkarte. Sie stand hier als `{}` — und genau deshalb
      // konnte kein Test den Verlust sehen: es gab nichts zu verlieren.
      // Seite 1 ist bewusst nicht aufsteigend belegt und hat Luecken, Seite 2
      // traegt etwas, das der Plan gar nicht kennen kann.
      ButtonFunctions: {
        '1': { '1': 9, '2': 4, '3': 7, '4': 0, '5': 0, '6': 0 },
        '2': { '1': 2, '2': 0, '3': 0 },
      },
      // Was der Parser NICHT liest — der halbe Einmessvorgang:
      devices: [{ serial: 'GG-0001' }],
      Channels: { 1: { fn: 'talk' } },
      Security: { Pincode: '1234' },
      AudioProfile: { gain: 7 },
    },
  },
  Groups: { keys: [], badge: 0 },
  Rooms: { keys: ['r1'], badge: 0, r1: { Name: 'Regie' } },
  Templates: { keys: ['t1'], badge: 0, t1: { Name: 'Standard-Belegung' } },
  Devices: { keys: ['d1'], badge: 0, d1: { serial: 'GG-0001', ip: '10.0.0.9' } },
  Network: { keys: ['n1'], badge: 0, n1: { dhcp: 0 } },
  WirelessPools: { keys: ['w1'], w1: { band: '1.9G' } },
  Binary: 'AAECAw==',
})

const parsed = (raw: unknown) => {
  const r = parseGg5File(JSON.stringify(raw))
  if (isParseError(r)) throw new Error(r.error)
  return r
}

const configFrom = (raw: unknown): GreenGoConfig => {
  const r = parsed(raw)
  return { ...r.config, basePreset: r.raw }
}

describe('Editor-Weg: ein geladenes Preset ueberlebt den Export', () => {
  it('behaelt die Sektionen, die diese App gar nicht liest', () => {
    const out = JSON.parse(buildGg5File(configFrom(anlage()))) as Record<string, any>
    expect(out.Rooms.r1.Name).toBe('Regie')
    expect(out.Templates.t1.Name).toBe('Standard-Belegung')
    expect(out.Devices.d1.ip).toBe('10.0.0.9')
    expect(out.Network.n1.dhcp).toBe(0)
    expect(out.WirelessPools.w1.band).toBe('1.9G')
    expect(out.Binary).toBe('AAECAw==')
  })

  it('wuerfelt die Anlagen-Passwoerter NICHT neu', () => {
    // Der Generator-Weg erzeugt bei jedem Export frische Zufalls-Passwoerter.
    // Auf ein importiertes Bestandssystem angewandt haette das den Nutzer aus
    // seiner eigenen Anlage ausgesperrt.
    const out = JSON.parse(buildGg5File(configFrom(anlage()))) as Record<string, any>
    expect(out.Settings.ConfigPassword).toBe('geheim-config')
    expect(out.Settings.AdminPassword).toBe('geheim-admin')
    expect(out.Settings.ConfigPasswordSet).toBe(1)
    expect(out.Settings.configId).toBe('aaaabbbb-ccccdddd')
    expect(out.Settings.TechPincode).toBe('4711')
  })

  it('schreibt genau die vier Felder aus dem Plan zurueck', () => {
    const config = configFrom(anlage())
    const out = JSON.parse(
      buildGg5File({
        ...config,
        systemName: 'Halle B',
        description: 'geaendert',
        sampleRate: 32000,
        multicastAddress: '239.1.1.1',
      }),
    ) as Record<string, any>
    expect(out.Settings.Name).toBe('Halle B')
    expect(out.Settings.Description).toBe('geaendert')
    expect(out.Settings.SampleRate).toBe(32000)
    expect(out.Settings.MulticastAddress).toBe('239.1.1.1')
    // Und alles daneben bleibt.
    expect(out.Settings.AdminPassword).toBe('geheim-admin')
  })

  it('laesst das Preset im Projekt unveraendert', () => {
    // Der Export darf den Plan nicht anfassen — sonst waere der zweite Export
    // ein anderer als der erste.
    const config = configFrom(anlage())
    const before = JSON.stringify(config.basePreset)
    buildGg5File({ ...config, systemName: 'Andere' })
    expect(JSON.stringify(config.basePreset)).toBe(before)
  })

  it('uebernimmt Stationen und Gruppen aus dem Plan, nicht aus dem Preset', () => {
    const config = configFrom(anlage())
    const out = JSON.parse(
      buildGg5File({
        ...config,
        users: [{ id: 7, name: 'Neue Station', color: 1, groupIds: [] }],
        groups: [],
      }),
    ) as Record<string, any>
    expect(out.Users.keys).toEqual(['7'])
    expect(out.Users['7'].Name).toBe('Neue Station')
  })
})

describe('Generator-Weg: ohne Preset bleibt alles wie bisher', () => {
  it('baut eine vollstaendige Datei aus dem Plan', () => {
    const out = JSON.parse(
      buildGg5File({
        systemName: 'Neu',
        description: '',
        multicastAddress: '239.1.160.1',
        sampleRate: 32000,
        users: [],
        groups: [],
      }),
    ) as Record<string, any>
    expect(out.Settings.Name).toBe('Neu')
    // Die Sektionen, die der Generator aus Konstanten fuellt — leer, aber
    // vorhanden. Genau das ist der Zustand, den der Editor-Weg vermeidet.
    expect(out.Rooms).toEqual({ keys: [], badge: 0 })
    expect(out.Devices).toEqual({ keys: [], badge: 0 })
    // Und er wuerfelt weiterhin frische Passwoerter, weil es keine gibt.
    expect(typeof out.Settings.AdminPassword).toBe('string')
    expect(out.Settings.AdminPassword.length).toBeGreaterThan(8)
  })
})

describe('die Tastenkarte ueberlebt den Export', () => {
  // Der letzte verbliebene Datenverlust im Editor-Weg — und der einzige, vor
  // dem der Import-Hinweis nicht warnte, weil `ButtonFunctions` in
  // `READ_USER_FIELDS` steht und `unreadFields` es deshalb nie meldet.
  //
  // Der Plan kennt keine Tastenpositionen: `GreenGoUser` fuehrt nur
  // `groupIds`, eine Menge. Der Export erfand die Positionen aus der
  // Array-Reihenfolge neu und setzte Seite 2 auf Nullen. Auf einem Beltpack
  // ist das die Tastenbelegung; es faellt in der Probe auf, nicht am Schirm.

  const users = (raw: unknown) =>
    (JSON.parse(buildGg5File(raw as GreenGoConfig)) as Record<string, any>).Users

  it('laesst die Positionen stehen, wenn sich an den Gruppen nichts aendert', () => {
    const config = configFrom(anlage())
    // Der Parser hat aus der Karte {9,4,7} als groupIds gelesen.
    const out = users({ ...config, users: [{ id: 1, name: 'BPX Regie', groupIds: [9, 4, 7] }] })
    expect(out['1'].ButtonFunctions['1']).toEqual({ '1': 9, '2': 4, '3': 7, '4': 0, '5': 0, '6': 0 })
  })

  it('fasst Seite 2 nicht an — der Plan weiss von ihr nichts', () => {
    const config = configFrom(anlage())
    const out = users({ ...config, users: [{ id: 1, name: 'BPX Regie', groupIds: [9, 4, 7] }] })
    expect(out['1'].ButtonFunctions['2']).toEqual({ '1': 2, '2': 0, '3': 0 })
  })

  it('legt eine neue Gruppe auf die erste freie Taste, statt umzusortieren', () => {
    const config = configFrom(anlage())
    const out = users({ ...config, users: [{ id: 1, name: 'BPX Regie', groupIds: [9, 4, 7, 5] }] })
    // 9/4/7 bleiben, wo sie waren; die 5 kommt auf Taste 4.
    expect(out['1'].ButtonFunctions['1']).toEqual({ '1': 9, '2': 4, '3': 7, '4': 5, '5': 0, '6': 0 })
  })

  it('raeumt eine entfernte Gruppe von ihrer Taste, ohne die anderen zu verschieben', () => {
    const config = configFrom(anlage())
    const out = users({ ...config, users: [{ id: 1, name: 'BPX Regie', groupIds: [9, 7] }] })
    expect(out['1'].ButtonFunctions['1']).toEqual({ '1': 9, '2': 0, '3': 7, '4': 0, '5': 0, '6': 0 })
  })

  it('erzeugt fuer eine neue Station weiterhin eine ganze Karte', () => {
    // Der Generator-Weg bleibt, wo es kein Preset fuer diese Station gibt.
    const config = configFrom(anlage())
    const out = users({ ...config, users: [{ id: 7, name: 'Neu', groupIds: [3] }] })
    expect(Object.keys(out['7'].ButtonFunctions['1'])).toHaveLength(18)
    expect(out['7'].ButtonFunctions['1']['1']).toBe(3)
  })
})

describe('der Round-Trip als Ganzes', () => {
  it('ueberlebt Datei -> Import -> Export -> Import ohne Verlust der Anlagenteile', () => {
    const first = anlage()
    const out = buildGg5File(configFrom(first))
    const second = parsed(JSON.parse(out))
    // Der zweite Import sieht dieselbe Anlage.
    expect(second.config.systemName).toBe('Halle A')
    expect((second.raw as Record<string, any>).Devices.d1.serial).toBe('GG-0001')
    expect((second.raw as Record<string, any>).Users['1'].Security.Pincode).toBe('1234')
  })
})

describe('was der Parser liest, schreibt der Export zurueck', () => {
  it('haelt die beiden Feldlisten deckungsgleich', async () => {
    // Der Editor-Weg ueberschreibt genau die Felder, die der Import liest.
    // Laufen die Listen auseinander, entsteht eine der beiden Haelften des
    // urspruenglichen Fehlers: entweder wird etwas ueberschrieben, das der
    // Plan gar nicht kennt, oder eine Plan-Aenderung kommt nicht an.
    const exportSrc = (await import('../src/renderer/lib/exportGreengo.ts?raw')).default
    const importSrc = (await import('../src/renderer/lib/importGreengo.ts?raw')).default
    const listOf = (src: string, name: string): string[] => {
      const m = new RegExp(`${name} = (?:new Set\\()?\\[([^\\]]*)\\]`).exec(src)
      if (!m) throw new Error(`${name} nicht gefunden`)
      return [...m[1].matchAll(/'([^']+)'/g)].map((x) => x[1]).sort()
    }
    // Drei Kategorien statt zwei: was der Export ERSETZT, was er ERGAENZT, und
    // zusammen muss das sein, was der Import liest. Die alte Fassung verlangte
    // Gleichheit der Ersetz-Liste mit der Lese-Liste — und zementierte damit,
    // dass `ButtonFunctions` ueberschrieben wird.
    expect(
      [
        ...listOf(exportSrc, 'USER_FIELDS_FROM_PLAN'),
        ...listOf(exportSrc, 'USER_FIELDS_MERGED_FROM_PLAN'),
      ].sort(),
    ).toEqual(listOf(importSrc, 'READ_USER_FIELDS'))
    expect(listOf(exportSrc, 'GROUP_FIELDS_FROM_PLAN')).toEqual(
      listOf(importSrc, 'READ_GROUP_FIELDS'),
    )
    expect(listOf(exportSrc, 'SETTINGS_FROM_PLAN')).toEqual(
      listOf(importSrc, 'READ_SETTINGS_FIELDS'),
    )
  })
})
