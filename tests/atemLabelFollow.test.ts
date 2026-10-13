import { describe, expect, it } from 'vitest'
import {
  applyHubBlock,
  atemAscii,
  atemLabel,
  atemShortName,
  emptyHubLive,
  normaliseLinks,
  splitBlocks,
  wunschLabel,
  type AtemLabel,
  type LabelFollowLink,
} from '../src/main/services/atemLabelFollow/core'
import { createFollower, type FollowerDeps } from '../src/main/services/atemLabelFollow/follower'
import {
  labelFollowLinks,
  labelFollowRows,
  normaliseLabelFollow,
} from '../src/renderer/lib/atemLabelFollow'
import type { Cable } from '../src/renderer/types/cable'
import type { EquipmentItem, Port } from '../src/renderer/types/equipment'

// ---------------------------------------------------------------------------
// ATEM-Eingangslabel folgt der Videohub-Route.
//
// Geprüft wird gegen einen nachgebauten Hub (Textprotokoll wie am Gerät) und
// einen ATEM, der nur mitschreibt — keine echte Hardware.
// ---------------------------------------------------------------------------

describe('Namen nach ATEM-Grenzen', () => {
  it('schreibt Umlaute aus und lässt nur ASCII durch', () => {
    expect(atemAscii('Kamera Bühne – groß')).toBe('Kamera Buehne gross')
    expect(atemAscii('Café')).toBe('Cafe')
  })

  it('kürzt den Langnamen auf 20 Zeichen', () => {
    expect(atemLabel('Pastor Kanzel Weitwinkel links')?.long).toBe('Pastor Kanzel Weitwi')
  })

  it('behält im Kurznamen die Endnummer', () => {
    expect(atemShortName('Cam 1')).toBe('CAM1')
    expect(atemShortName('Cam 12')).toBe('CA12')
    expect(atemShortName('Kamera 2')).toBe('KAM2')
    expect(atemShortName('CAM3')).toBe('CAM3')
    expect(atemShortName('Grafik')).toBe('GRAF')
    expect(atemShortName('Pult Links Total')).toBe('PLT')
    expect(atemShortName('Cam Stage')).toBe('CAST')
  })

  it('liefert für leere Namen nichts', () => {
    expect(atemLabel('   ')).toBeNull()
    expect(atemLabel('ßß')?.long).toBe('ssss')
  })
})

describe('Videohub-Strom', () => {
  it('hält einen halben Block zurück, bis die Leerzeile kommt', () => {
    const a = splitBlocks('INPUT LABELS:\n0 Cam 1\n')
    expect(a.bloecke).toEqual([])
    const b = splitBlocks(a.rest + '1 Cam 2\n\nVIDEO OUTPUT ROUTING:\n0 1\n\n')
    expect(b.bloecke).toHaveLength(2)
    expect(b.rest).toBe('')
  })

  it('mischt Teil-Updates in den Zustand statt zu ersetzen', () => {
    const hub = emptyHubLive()
    expect(applyHubBlock(hub, 'INPUT LABELS:\n0 Cam 1\n1 Cam 2')).toBe(true)
    expect(applyHubBlock(hub, 'VIDEO OUTPUT ROUTING:\n3 0')).toBe(true)
    expect(applyHubBlock(hub, 'VIDEO OUTPUT ROUTING:\n3 0')).toBe(false)
    expect(applyHubBlock(hub, 'INPUT LABELS:\n1 Grafik')).toBe(true)
    expect(hub.inputLabels).toEqual({ 0: 'Cam 1', 1: 'Grafik' })
    expect(applyHubBlock(hub, 'OUTPUT LABELS:\n3 ATEM 4')).toBe(false)
  })

  it('sendet ohne Kreuzpunkt oder Label keinen Platzhalter', () => {
    const link: LabelFollowLink = { hubHost: 'h', hubPort: 9990, hubOutput: 3, atemHost: 'a', atemInput: 4 }
    const hub = emptyHubLive()
    expect(wunschLabel(link, hub)).toBeNull()
    hub.routing[3] = 5
    expect(wunschLabel(link, hub)).toBeNull()
    hub.inputLabels[5] = 'Beamer'
    expect(wunschLabel(link, hub)).toEqual({ long: 'Beamer', short: 'BEAM' })
  })

  it('verwirft Links, die nicht passen', () => {
    expect(
      normaliseLinks([
        { hubHost: '10.0.0.2', hubPort: 9990, hubOutput: 0, atemHost: '10.0.0.3', atemInput: 1 },
        { hubHost: '10.0.0.2; rm', hubPort: 9990, hubOutput: 0, atemHost: '10.0.0.3', atemInput: 1 },
        { hubHost: '10.0.0.2', hubPort: 9990, hubOutput: -1, atemHost: '10.0.0.3', atemInput: 1 },
        { hubHost: '10.0.0.2', hubPort: 9990, hubOutput: 0, atemHost: '10.0.0.3', atemInput: 0 },
        null,
      ]),
    ).toHaveLength(1)
  })
})

/** Ein Prüfstand: Hub-Sockets, die der Test füttert, und ein ATEM, der mitschreibt. */
const pruefstand = () => {
  const sockets = new Map<string, { data(t: string): void; close(): void; error(e: Error): void }>()
  const gesetzt: { host: string; input: number; label: AtemLabel }[] = []
  const timer: (() => void)[] = []
  let atemFehler = false
  const deps: FollowerDeps = {
    connect: (host, port, on) => {
      sockets.set(`${host}:${port}`, on)
      return { destroy: () => sockets.delete(`${host}:${port}`) }
    },
    setLabel: async (host, input, label) => {
      if (atemFehler) throw new Error('ATEM nicht erreichbar')
      gesetzt.push({ host, input, label })
    },
    onStatus: () => {},
    setTimer: (fn) => {
      timer.push(fn)
      return fn
    },
    clearTimer: () => {},
  }
  return {
    deps,
    sockets,
    gesetzt,
    timer,
    setAtemFehler: (v: boolean) => {
      atemFehler = v
    },
  }
}

const tick = () => new Promise((r) => setTimeout(r, 0))

const LINK: LabelFollowLink = {
  hubHost: '10.0.0.2',
  hubPort: 9990,
  hubOutput: 3,
  atemHost: '10.0.0.3',
  atemInput: 4,
}

describe('Folgen gegen den Prüfstand', () => {
  it('setzt beim Verbinden und bei jedem Umschalten den Namen, nie doppelt', async () => {
    const p = pruefstand()
    const f = createFollower(p.deps)
    f.start([LINK])
    const hub = p.sockets.get('10.0.0.2:9990')!
    hub.data('PROTOCOL PREAMBLE:\nVersion: 2.8\n\nINPUT LABELS:\n0 Cam 1\n1 Cam 2\n2 Grafik\n\n')
    hub.data('VIDEO OUTPUT ROUTING:\n3 0\n\n')
    await tick()
    expect(p.gesetzt).toEqual([{ host: '10.0.0.3', input: 4, label: { long: 'Cam 1', short: 'CAM1' } }])

    // Am Hardware-Panel umgeschaltet: der Hub meldet nur die geänderte Zeile.
    hub.data('VIDEO OUTPUT ROUTING:\n3 2\n\n')
    await tick()
    expect(p.gesetzt.at(-1)?.label).toEqual({ long: 'Grafik', short: 'GRAF' })

    // Ein anderer Ausgang schaltet: kein Befehl an den ATEM.
    hub.data('VIDEO OUTPUT ROUTING:\n7 1\n\n')
    await tick()
    expect(p.gesetzt).toHaveLength(2)

    // Die Quelle wird am Hub umbenannt: der ATEM folgt.
    hub.data('INPUT LABELS:\n2 Folien\n\n')
    await tick()
    expect(p.gesetzt.at(-1)?.label.long).toBe('Folien')
    expect(p.gesetzt).toHaveLength(3)
  })

  it('verbindet nach einem Abbruch neu und sendet Gleiches nicht noch einmal', async () => {
    const p = pruefstand()
    const f = createFollower(p.deps)
    f.start([LINK])
    p.sockets.get('10.0.0.2:9990')!.data('INPUT LABELS:\n0 Cam 1\n\nVIDEO OUTPUT ROUTING:\n3 0\n\n')
    await tick()
    p.sockets.get('10.0.0.2:9990')!.close()
    expect(p.timer).toHaveLength(1)
    p.timer[0]()
    p.sockets.get('10.0.0.2:9990')!.data('INPUT LABELS:\n0 Cam 1\n\nVIDEO OUTPUT ROUTING:\n3 0\n\n')
    await tick()
    expect(p.gesetzt).toHaveLength(1)
  })

  it('versucht einen abgelehnten Namen beim nächsten Anlass erneut', async () => {
    const p = pruefstand()
    const f = createFollower(p.deps)
    f.start([LINK])
    p.setAtemFehler(true)
    const hub = p.sockets.get('10.0.0.2:9990')!
    hub.data('INPUT LABELS:\n0 Cam 1\n\nVIDEO OUTPUT ROUTING:\n3 0\n\n')
    await tick()
    expect(p.gesetzt).toHaveLength(0)
    expect(f.status().log.at(-1)).toContain('ATEM nicht erreichbar')
    p.setAtemFehler(false)
    hub.data('INPUT LABELS:\n0 Cam 1\n5 Neu\n\n')
    await tick()
    expect(p.gesetzt).toHaveLength(1)
  })

  it('trennt nach dem Beenden und baut Hubs ab, die nicht mehr im Plan sind', () => {
    const p = pruefstand()
    const f = createFollower(p.deps)
    f.start([LINK, { ...LINK, hubHost: '10.0.0.9' }])
    expect(p.sockets.size).toBe(2)
    f.update([LINK])
    expect([...p.sockets.keys()]).toEqual(['10.0.0.2:9990'])
    f.stop()
    expect(p.sockets.size).toBe(0)
    expect(f.status().running).toBe(false)
  })

  it('verbindet nichts, solange nicht gestartet ist', () => {
    const p = pruefstand()
    const f = createFollower(p.deps)
    f.update([LINK])
    expect(p.sockets.size).toBe(0)
  })
})

// ── Aus dem Plan ────────────────────────────────────────────────────────────

const port = (id: string, name: string, over: Partial<Port> = {}): Port => ({
  id,
  name,
  type: 'BNC',
  connectorType: 'BNC',
  ...over,
})

const eq = (over: Partial<EquipmentItem>): EquipmentItem => ({
  id: 'e1',
  name: 'Gerät',
  category: 'Video',
  inputs: [],
  outputs: [],
  x: 0,
  y: 0,
  width: 200,
  height: 160,
  ...over,
})

const cable = (from: [string, string], to: [string, string]): Cable => ({
  id: `${from[1]}->${to[1]}`,
  name: '',
  type: 'BNC',
  length: 10,
  color: '#fff',
  fromEquipmentId: from[0],
  fromPortId: from[1],
  toEquipmentId: to[0],
  toPortId: to[1],
  notes: '',
})

const plan = (over: { hub?: Partial<EquipmentItem>; atem?: Partial<EquipmentItem>; atemIn?: Partial<Port> } = {}) => {
  const hub = eq({
    id: 'hub',
    name: 'Router Regie',
    controlProtocol: 'videohub',
    ipAddress: '10.0.0.2',
    inputs: [port('hi0', 'In 1'), port('hi1', 'In 2')],
    outputs: [port('ho0', 'Out 1'), port('ho1', 'Out 2'), port('ho2', 'Out 3')],
    labelFollow: { enabled: true },
    ...over.hub,
  })
  const wandler = eq({
    id: 'conv',
    name: 'Wandler',
    inputs: [port('ci', 'SDI In')],
    outputs: [port('co', 'SDI Out')],
  })
  const atem = eq({
    id: 'atem',
    name: 'Bildmischer',
    controlProtocol: 'atem',
    ipAddress: '10.0.0.3',
    inputs: [
      port('ai1', 'SDI 1', { control: { role: 'input', address: 1 } }),
      port('ai2', 'SDI 2', { control: { role: 'input', address: 2 }, ...over.atemIn }),
    ],
    outputs: [],
    ...over.atem,
  })
  const cables = [cable(['hub', 'ho2'], ['conv', 'ci']), cable(['conv', 'co'], ['atem', 'ai2'])]
  return { equipment: [hub, wandler, atem], cables }
}

describe('Verbindungen aus dem Kabelgraph', () => {
  it('findet den Hub-Ausgang über einen Durchleiter hinweg', () => {
    const { equipment, cables } = plan()
    expect(labelFollowLinks(equipment, cables)).toEqual([
      { hubHost: '10.0.0.2', hubPort: 9990, hubOutput: 2, atemHost: '10.0.0.3', atemInput: 2 },
    ])
  })

  it('folgt nicht, solange es am Hub nicht eingeschaltet ist', () => {
    const { equipment, cables } = plan({ hub: { labelFollow: undefined } })
    expect(labelFollowLinks(equipment, cables)).toEqual([])
    expect(labelFollowRows(equipment, cables)).toHaveLength(1)
  })

  it('lässt einen ausgenommenen Ausgang weg', () => {
    const { equipment, cables } = plan({ hub: { labelFollow: { enabled: true, excludedOutputs: ['ho2'] } } })
    expect(labelFollowLinks(equipment, cables)).toEqual([])
  })

  it('rät keine Quellen-Nummer aus der Position', () => {
    const { equipment, cables } = plan({ atemIn: { control: undefined } })
    const [row] = labelFollowRows(equipment, cables)
    expect(row.hinweis).toBe('atem-input')
    expect(labelFollowLinks(equipment, cables)).toEqual([])
  })

  it('nennt fehlende IP-Adressen als Hinweis', () => {
    expect(labelFollowRows(...Object.values(plan({ hub: { ipAddress: '' } })) as [EquipmentItem[], Cable[]])[0].hinweis).toBe('hub-ip')
    expect(labelFollowRows(...Object.values(plan({ atem: { ipAddress: undefined } })) as [EquipmentItem[], Cable[]])[0].hinweis).toBe('atem-ip')
  })

  it('erkennt Geräte nur am erklärten Protokoll, nicht am Namen', () => {
    const { equipment, cables } = plan({ hub: { controlProtocol: undefined, name: 'Smart Videohub 12G' } })
    expect(labelFollowRows(equipment, cables)).toEqual([])
    const ohneAtem = plan({ atem: { controlProtocol: undefined, name: 'ATEM 2 M/E' } })
    expect(labelFollowRows(ohneAtem.equipment, ohneAtem.cables)).toEqual([])
  })

  it('nimmt den eigenen Steuer-Port des Hubs', () => {
    const { equipment, cables } = plan({ hub: { controlPort: 9991 } })
    expect(labelFollowLinks(equipment, cables)[0].hubPort).toBe(9991)
  })

  it('normalisiert den gespeicherten Schalter', () => {
    expect(normaliseLabelFollow({ enabled: 'ja', excludedOutputs: ['a', 3] })).toEqual({
      enabled: false,
      excludedOutputs: ['a'],
    })
    expect(normaliseLabelFollow(null)).toBeUndefined()
  })
})
