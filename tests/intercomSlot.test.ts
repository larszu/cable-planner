import { describe, expect, it } from 'vitest'
import {
  greengoFromPlan,
  nurHoerend,
  planFromGreengo,
  withVendorNumbers,
} from '../src/renderer/lib/intercomPlan'
import type { GreenGoConfig } from '../src/renderer/types/greengo'
import type { IntercomPlan } from '../src/renderer/types/intercomPlan'

// ───────────────────────────────────────────────────────────────────────────
// DER INTERCOM-SLOT (E-2, Schritt 1)
//
// Der Slot ist die Wahrheit, `GreenGoConfig` seine Ausgabe-Projektion. Damit
// das keine Verschlechterung ist, muss der Weg dorthin und zurueck
// VERLUSTFREI sein — sonst hat der Umbau nur den Ort des Verlusts verschoben.
//
// Die Austauschdatei daneben (`lib/intercomExchange.ts`) ist erklaertermassen
// nicht verlustfrei: sie vergibt Anlagen-Nummern neu. Fuer eine Datei, die in
// ein fremdes System geht, ist das richtig. Fuer den Slot waere es der Defekt,
// den dieser Umbau vermeiden soll — dieselbe Anlage traegt nach dem Oeffnen
// des Projekts andere Nummern als vorher.
// ───────────────────────────────────────────────────────────────────────────

/** Eine Konfiguration, an der es etwas zu verlieren gibt. */
const anlage = (): GreenGoConfig => ({
  systemName: 'Halle A',
  description: 'Bestand',
  multicastAddress: '239.9.9.9',
  sampleRate: 48000,
  groups: [
    { id: 9, name: 'PGM', color: 2 },
    { id: 4, name: 'CAM' },
    { id: 7, name: 'TON', color: 5 },
  ],
  users: [
    {
      id: 3,
      name: 'BPX Regie',
      // Wiederholt den Namen — die Austauschdatei laesst ihn dann weg, der
      // Slot nicht.
      displayName: 'BPX Regie',
      color: 1,
      groupIds: [9, 4],
      keys: [
        { page: 1, button: 5, groupId: 9 },
        { page: 2, button: 1, groupId: 4 },
      ],
      equipmentId: 'eq-77',
    },
    { id: 11, name: 'Kamera 1', groupIds: [4, 7] },
  ],
  basePreset: { Settings: { AdminPassword: 'geheim' }, Rooms: { keys: ['r1'] } },
})

describe('Slot und Green-GO gehen verlustfrei ineinander ueber', () => {
  it('kommt dieselbe Konfiguration zurueck', () => {
    expect(greengoFromPlan(planFromGreengo(anlage()))).toEqual(anlage())
  })

  it('behaelt die Anlagen-Nummern, statt sie neu zu vergeben', () => {
    // DER UNTERSCHIED ZUR AUSTAUSCHDATEI. `fromIntercomExchange` nummeriert
    // in Dateireihenfolge durch — hier waeren aus 3 und 11 dann 1 und 2, und
    // die bespielte Anlage kennte ihre eigenen Stellen nicht wieder.
    const zurueck = greengoFromPlan(planFromGreengo(anlage()))
    expect(zurueck.users.map((u) => u.id)).toEqual([3, 11])
    expect(zurueck.groups.map((g) => g.id)).toEqual([9, 4, 7])
  })

  it('behaelt einen displayName, der den Namen wiederholt', () => {
    // Die Austauschdatei laesst ihn weg (eine Kurzform, die nichts kuerzt, ist
    // keine) — im Slot waere das ein Verlust: beim naechsten Export stuende
    // `DisplayName: ''` auf der Anlage.
    expect(greengoFromPlan(planFromGreengo(anlage())).users[0].displayName).toBe('BPX Regie')
  })

  it('traegt die Tastenbelegung mit', () => {
    const plan = planFromGreengo(anlage())
    expect(plan.stations[0].keys).toEqual([
      { page: 1, button: 5, channelId: 'ch-9' },
      { page: 2, button: 1, channelId: 'ch-4' },
    ])
  })

  it('unterscheidet „keine Karte gelesen" von „Karte ist leer"', () => {
    // Derselbe Unterschied wie in `types/greengo.ts`, und er entscheidet dort,
    // ob der Export schreiben darf. Ginge er im Slot verloren, waere die
    // Umkehrung aus Schritt 3 beim naechsten Speichern wieder weg.
    const ohne = { ...anlage(), users: [{ id: 1, name: 'A', groupIds: [] }] }
    const leer = { ...anlage(), users: [{ id: 1, name: 'A', groupIds: [], keys: [] }] }
    expect(planFromGreengo(ohne).stations[0].keys).toBeUndefined()
    expect(planFromGreengo(leer).stations[0].keys).toEqual([])
    expect(greengoFromPlan(planFromGreengo(ohne)).users[0].keys).toBeUndefined()
    expect(greengoFromPlan(planFromGreengo(leer)).users[0].keys).toEqual([])
  })

  it('nimmt das Roh-Preset der Anlage mit', () => {
    // Ohne das faellt der Export beim naechsten Oeffnen unbemerkt auf „neu
    // erzeugen" zurueck — samt frisch gewuerfelter Passwoerter.
    const plan = planFromGreengo(anlage())
    expect(plan.vendor?.greengo?.basePreset).toEqual(anlage().basePreset)
    expect(greengoFromPlan(plan).basePreset).toEqual(anlage().basePreset)
  })

  it('laesst einen Verweis ins Leere weg, statt eine Konferenz zu erfinden', () => {
    const kaputt: GreenGoConfig = {
      ...anlage(),
      users: [
        { id: 1, name: 'A', groupIds: [9, 99], keys: [{ page: 1, button: 1, groupId: 99 }] },
      ],
    }
    const plan = planFromGreengo(kaputt)
    expect(plan.stations[0].memberships.map((m) => m.channelId)).toEqual(['ch-9'])
    expect(plan.stations[0].keys).toEqual([])
    // Und es wird keine Konferenz „Gruppe 99" dazuerfunden.
    expect(plan.channels.map((c) => c.id)).toEqual(['ch-9', 'ch-4', 'ch-7'])
  })
})

describe('Anlagen-Nummern werden festgeschrieben, nicht jedes Mal erfunden', () => {
  it('verschiebt eine neue Sprechstelle keine bestehende Nummer', () => {
    // ADR-002: deklariert statt abgeleitet. Wer eine Stelle VORNE einfuegt,
    // darf die Nummern der anderen nicht verrutschen lassen.
    const plan = planFromGreengo(anlage())
    const mitNeuer: IntercomPlan = {
      ...plan,
      stations: [
        { id: 'st-neu', name: 'Ton 2', memberships: [] },
        ...plan.stations,
      ],
    }
    const zurueck = greengoFromPlan(mitNeuer)
    expect(zurueck.users.map((u) => ({ id: u.id, name: u.name }))).toEqual([
      { id: 1, name: 'Ton 2' },
      { id: 3, name: 'BPX Regie' },
      { id: 11, name: 'Kamera 1' },
    ])
  })

  it('schreibt eine erfundene Nummer sofort fest', () => {
    // Sonst waere sie beim naechsten Mal eine andere — je nachdem, was
    // inzwischen dazugekommen ist.
    const roh: IntercomPlan = {
      systemName: 'Neu',
      channels: [{ id: 'ch-a', name: 'PGM' }],
      stations: [{ id: 'st-a', name: 'Regie', memberships: [] }],
    }
    const fest = withVendorNumbers(roh)
    expect(fest.vendor?.greengo?.stationNumbers).toEqual({ 'st-a': 1 })
    expect(fest.vendor?.greengo?.channelNumbers).toEqual({ 'ch-a': 1 })
  })

  it('vergibt keine Nummer zweimal', () => {
    const roh: IntercomPlan = {
      systemName: 'Neu',
      channels: [],
      stations: [
        { id: 'st-a', name: 'A', memberships: [] },
        { id: 'st-b', name: 'B', memberships: [] },
        { id: 'st-c', name: 'C', memberships: [] },
      ],
      // `st-b` ist deklariert auf 1 — `st-a` darf die 1 dann nicht bekommen.
      vendor: { greengo: { multicastAddress: '239.1.160.1', sampleRate: 32000, stationNumbers: { 'st-b': 1 }, channelNumbers: {} } },
    }
    const fest = withVendorNumbers(roh)
    expect(fest.vendor?.greengo?.stationNumbers).toEqual({ 'st-a': 2, 'st-b': 1, 'st-c': 3 })
  })
})

describe('was Green-GO nicht ausdruecken kann, wird gesagt statt geschluckt', () => {
  const nurListen = (): IntercomPlan => ({
    systemName: 'Halle A',
    channels: [
      { id: 'ch-1', name: 'PGM' },
      { id: 'ch-2', name: 'CAM' },
    ],
    stations: [
      {
        id: 'st-1',
        name: 'Regie',
        memberships: [
          { channelId: 'ch-1', talk: true, listen: true },
          { channelId: 'ch-2', talk: false, listen: true },
        ],
      },
    ],
  })

  it('landet die Nur-Hoer-Zugehoerigkeit trotzdem in groupIds', () => {
    // Green-GO fuehrt EINE Liste. Die Projektion kann es nicht anders — das
    // ist der Verlust, den `nurHoerend` benennt.
    expect(greengoFromPlan(nurListen()).users[0].groupIds).toEqual([1, 2])
  })

  it('nennt `nurHoerend` genau diese Zugehoerigkeit', () => {
    expect(nurHoerend(nurListen())).toEqual([
      { stationName: 'Regie', channelName: 'CAM', talk: false, listen: true },
    ])
  })

  it('meldet eine Zugehoerigkeit ohne beides gar nicht — sie ist keine', () => {
    const keine: IntercomPlan = {
      ...nurListen(),
      stations: [
        {
          id: 'st-1',
          name: 'Regie',
          memberships: [{ channelId: 'ch-2', talk: false, listen: false }],
        },
      ],
    }
    expect(nurHoerend(keine)).toEqual([])
    expect(greengoFromPlan(keine).users[0].groupIds).toEqual([])
  })
})

// ───────────────────────────────────────────────────────────────────────────
// DER SLOT IM PROJEKT
// ───────────────────────────────────────────────────────────────────────────

describe('der Slot steht im Projekt und `greengoConfig` nicht mehr', () => {
  it('stellt das Laden ein altes Projekt um', async () => {
    // `healProjectPositions` ist die Schema-Migrationsschicht (CLAUDE.md), und
    // sie laeuft auf JEDES geladene Projekt. Umgestellt wird beim LADEN und
    // nicht beim Speichern: ein Projekt, das nur geoeffnet und angesehen wird,
    // lebte sonst mit der alten Form weiter — und die Oberflaeche liest sie
    // nicht mehr. Der Nutzer saehe seine Sprechstellen verschwinden.
    const { useProjectStore } = await import('../src/renderer/store/projectStore')
    const alt = {
      metadata: { name: 'Alt' },
      equipment: [],
      cables: [],
      canvasState: { x: 0, y: 0, zoom: 1 },
      greengoConfig: {
        systemName: 'Halle A',
        multicastAddress: '239.9.9.9',
        sampleRate: 48000,
        groups: [{ id: 2, name: 'PGM' }],
        users: [{ id: 5, name: 'Regie', groupIds: [2], equipmentId: 'eq-1' }],
      },
    }
    useProjectStore.getState().loadProject(alt as never)
    const p = useProjectStore.getState().project

    expect(p.intercom?.systemName).toBe('Halle A')
    expect(p.intercom?.channels).toEqual([{ id: 'ch-2', name: 'PGM' }])
    expect(p.intercom?.stations[0].equipmentId).toBe('eq-1')
    // Die Anlagen-Nummern stehen fest, statt beim naechsten Export neu
    // vergeben zu werden.
    expect(p.intercom?.vendor?.greengo?.stationNumbers).toEqual({ 'st-5': 5 })
    expect(p.intercom?.vendor?.greengo?.channelNumbers).toEqual({ 'ch-2': 2 })
  })

  it('bleibt das alte Feld NICHT daneben stehen', async () => {
    // Beides zu fuehren waere die zweite Wahrheit, gegen die dieser Umbau
    // geschrieben ist: der naechste Leser griffe auf das Feld, das er kennt,
    // und die beiden liefen auseinander.
    const { useProjectStore } = await import('../src/renderer/store/projectStore')
    useProjectStore.getState().loadProject({
      metadata: { name: 'Alt' },
      equipment: [],
      cables: [],
      canvasState: { x: 0, y: 0, zoom: 1 },
      greengoConfig: { systemName: 'X', multicastAddress: '239.1.160.1', sampleRate: 32000, groups: [], users: [] },
    } as never)
    const p = useProjectStore.getState().project as Record<string, unknown>
    expect('greengoConfig' in p).toBe(false)
  })

  it('schreibt `updateGreenGoConfig` in den Slot', async () => {
    // Der Name bleibt, weil die Aufrufer Green-GO sprechen (Dialog,
    // Preset-Bibliothek, Beltpack-Leiste). Das Ziel ist ein anderes.
    const { useProjectStore } = await import('../src/renderer/store/projectStore')
    useProjectStore.getState().updateGreenGoConfig({
      systemName: 'Neu',
      multicastAddress: '239.1.160.1',
      sampleRate: 32000,
      groups: [{ id: 1, name: 'PGM' }],
      users: [{ id: 1, name: 'Regie', groupIds: [1] }],
    })
    const p = useProjectStore.getState().project as Record<string, unknown>
    expect((p.intercom as IntercomPlan).systemName).toBe('Neu')
    expect('greengoConfig' in p).toBe(false)
  })
})

describe('der Slot schreibt nicht ab, was der Plan schon weiss (ADR-001)', () => {
  it('traegt er den Geraete-Verweis und nicht den Geraetenamen', () => {
    // Ein Slot, der Geraetenamen abschreibt, waere die zweite Wahrheit —
    // genau der Fehler, den ADR-001 benennt, und der Grund, warum die
    // Eigentuemer-Entscheidung zu E-2 das ausdruecklich verlangt: „alles, was
    // der Plan schon fuehrt, steht im Slot als Verweis ueber die Objekt-Id".
    //
    // GEMESSEN WIRD AM ERGEBNIS und nicht am Typ: eine Zeichenkette, die den
    // Geraetenamen enthaelt, darf im serialisierten Slot nirgends auftauchen.
    const plan = planFromGreengo({
      systemName: 'Halle A',
      multicastAddress: '239.1.160.1',
      sampleRate: 32000,
      groups: [{ id: 1, name: 'PGM' }],
      users: [{ id: 1, name: 'Regie', groupIds: [1], equipmentId: 'eq-kamera-1' }],
    })
    const json = JSON.stringify(plan)
    expect(json).toContain('eq-kamera-1')
    // Der Geraetename im Plan lautet „Sony HDC-3500"; er steht im Projekt und
    // hat im Slot nichts zu suchen.
    expect(json).not.toContain('Sony HDC-3500')
    // Und die Sprechstelle traegt nur ihren eigenen Rollennamen.
    expect(plan.stations[0].name).toBe('Regie')
  })

  it('kennt der Slot-Typ kein Feld fuer Geraetename, Ort oder Port', async () => {
    // Die andere Richtung: der Test oben kann nur zeigen, dass HEUTE nichts
    // abgeschrieben wird. Dieser zeigt, dass es dafuer auch keinen Platz gibt.
    const src = (await import('../src/renderer/types/intercomPlan.ts?raw')).default
    const ohneKommentare = src
      .split('\n')
      .filter((z) => !/^\s*(\/\/|\*|\/\*)/.test(z))
      .join('\n')
    for (const verboten of [
      'equipmentName',
      'deviceName',
      'portId',
      'portName',
      'locationId',
      'location',
      'rackId',
    ]) {
      expect(ohneKommentare, `${verboten} gehoert dem Plan, nicht dem Slot`).not.toContain(
        verboten,
      )
    }
  })

  it('ist der Slot keine Austauschdatei', async () => {
    // Kein `format`, kein `version`, kein `exportedAt`. Ein Projekt traegt
    // keinen Format-Marker ueber einen seiner Slots — die Version steht am
    // Projekt. Die Austauschdatei daneben hat die drei Felder, weil sie
    // allein unterwegs ist.
    const src = (await import('../src/renderer/types/intercomPlan.ts?raw')).default
    const ohneKommentare = src
      .split('\n')
      .filter((z) => !/^\s*(\/\/|\*|\/\*)/.test(z))
      .join('\n')
    expect(ohneKommentare).not.toMatch(/\bformat\s*[?:]/)
    expect(ohneKommentare).not.toMatch(/\bversion\s*[?:]/)
    expect(ohneKommentare).not.toMatch(/\bexportedAt\s*[?:]/)
  })
})
