import { describe, expect, it } from 'vitest'
import { detectDeviceKind } from '../src/renderer/lib/deviceKind'
import { isPatchPanelDevice, patchPanelCounterpart } from '../src/renderer/lib/patchPanel'
import { chainOneLine, signalChains } from '../src/renderer/lib/signalChain'
import { buildGraphContext, resolveSignalSource } from '../src/renderer/lib/labelDerivation'
import type { Cable } from '../src/renderer/types/cable'
import type { EquipmentItem } from '../src/renderer/types/equipment'

// ───────────────────────────────────────────────────────────────────────────
// Issue #664 — „Patchbays als Gerätekategorie erstellen und mehrere Ebenen der
// Verkabelung anzeigbar machen für Festinstallationen. Zum Beispiel Kabel geht
// von a über b von b über c nach d. Bei d ist ein Patchbay und da geht es dann
// von d nach e und von e zum Endgerät oder einem Wandanschluss."
//
// Die Kette aus dem Issue, als Fixture: Kamera → Wandanschluss → Patchfeld A →
// Patchfeld B → ATEM.
// ───────────────────────────────────────────────────────────────────────────

const port = (id: string, name: string, connectorType = 'BNC') =>
  ({ id, name, type: 'video', connectorType }) as never

const geraet = (over: Partial<EquipmentItem> & { id: string; name: string }): EquipmentItem =>
  ({
    category: 'Video',
    inputs: [],
    outputs: [],
    x: 0,
    y: 0,
    width: 100,
    height: 60,
    ...over,
  }) as EquipmentItem

/** n Ein- und n Ausgänge, gleich nummeriert — eine echte Blende. */
const blende = (id: string, name: string, n: number, category = 'Patch panels'): EquipmentItem =>
  geraet({
    id,
    name,
    category,
    inputs: Array.from({ length: n }, (_, i) => port(`${id}-in-${i + 1}`, `In ${i + 1}`)),
    outputs: Array.from({ length: n }, (_, i) => port(`${id}-out-${i + 1}`, `Out ${i + 1}`)),
  })

const kabel = (id: string, from: [string, string], to: [string, string]): Cable =>
  ({
    id,
    name: id,
    type: 'SDI',
    length: 10,
    color: '#fff',
    cableNumber: id.toUpperCase(),
    fromEquipmentId: from[0],
    fromPortId: from[1],
    toEquipmentId: to[0],
    toPortId: to[1],
    notes: '',
  }) as Cable

const kamera = geraet({
  id: 'cam',
  name: 'Kamera 1',
  category: 'Kameras',
  outputs: [port('cam-out', 'SDI Out')],
})
const wand = blende('wall', 'Wandanschluss Studio', 4)
const ppA = blende('ppa', 'Patchfeld A', 24)
const ppB = blende('ppb', 'Patchfeld B', 24)
const atem = geraet({
  id: 'atem',
  name: 'ATEM Constellation',
  inputs: Array.from({ length: 8 }, (_, i) => port(`atem-in-${i + 1}`, `In ${i + 1}`)),
})

const KETTE: Cable[] = [
  kabel('k1', ['cam', 'cam-out'], ['wall', 'wall-in-2']),
  kabel('k2', ['wall', 'wall-out-2'], ['ppa', 'ppa-in-3']),
  kabel('k3', ['ppa', 'ppa-out-3'], ['ppb', 'ppb-in-3']),
  kabel('k4', ['ppb', 'ppb-out-3'], ['atem', 'atem-in-4']),
]
const PLAN = [kamera, wand, ppA, ppB, atem]

describe('eine Patchblende wird als solche erkannt', () => {
  it('über die Kategorie, ohne zusätzliches Häkchen', () => {
    expect(isPatchPanelDevice(ppA)).toBe(true)
  })

  it('über das Flag, auch ohne die Kategorie', () => {
    const alt = blende('x', 'Blende', 8, 'Video')
    expect(isPatchPanelDevice(alt)).toBe(false)
    expect(isPatchPanelDevice({ ...alt, isPatchPanel: true })).toBe(true)
  })

  it('und NICHT als Kreuzschiene — das war der eigentliche Defekt', () => {
    // 24 BNC rein, 24 BNC raus: die Struktur-Heuristik in `detectDeviceKind`
    // hielt jede Blende für einen Videohub. Danach verlangte die Ableitung
    // einen geschalteten Kreuzpunkt, den eine Blende nie hat.
    expect(detectDeviceKind(blende('y', 'Blende 24', 24, 'Video'))).toBe('videohub')
    expect(detectDeviceKind(ppA)).toBe(null)
  })
})

describe('der Durchgang ist die Position, in beide Richtungen', () => {
  it('vom Ausgang zum gleichnummerigen Eingang', () => {
    expect(patchPanelCounterpart(ppA, { id: 'ppa-out-3' })?.id).toBe('ppa-in-3')
  })

  it('und zurück', () => {
    expect(patchPanelCounterpart(ppA, { id: 'ppa-in-3' })?.id).toBe('ppa-out-3')
  })

  it('nicht bei ungleicher Bestückung — dann sagt die Position nichts', () => {
    const schief = geraet({
      id: 'schief',
      name: 'Halbe Blende',
      category: 'Patch panels',
      inputs: [port('s-in-1', 'In 1'), port('s-in-2', 'In 2')],
      outputs: [port('s-out-1', 'Out 1')],
    })
    expect(patchPanelCounterpart(schief, { id: 's-out-1' })).toBe(null)
  })

  it('nicht bei einem Gerät, das keine Blende ist', () => {
    expect(patchPanelCounterpart(atem, { id: 'atem-in-4' })).toBe(null)
  })
})

describe('die Rückwärtssuche läuft durch die Blenden bis zur Kamera', () => {
  it('nennt die Kamera, nicht das letzte Patchfeld', () => {
    const ctx = buildGraphContext(PLAN, KETTE)
    expect(resolveSignalSource('atem-in-4', ctx)?.equipmentId).toBe('cam')
  })

  it('hält an der Blende an, wenn sie ungleich bestückt ist — kein Raten', () => {
    // Gegenprobe zur Regel „gleich viele Buchsen": Patchfeld B bekommt einen
    // Eingang mehr, die Position sagt danach nichts mehr.
    const schief = { ...ppB, inputs: [...ppB.inputs, port('ppb-in-25', 'In 25')] }
    const ctx = buildGraphContext([kamera, wand, ppA, schief, atem], KETTE)
    expect(resolveSignalSource('atem-in-4', ctx)?.equipmentId).toBe('ppb')
  })

  it('hält an der Blende an, wenn sie keine Blende mehr ist', () => {
    const normal = { ...ppB, category: 'Video' }
    const ctx = buildGraphContext([kamera, wand, ppA, normal, atem], KETTE)
    expect(resolveSignalSource('atem-in-4', ctx)?.equipmentId).toBe('ppb')
  })
})

describe('die Kette ist als Ganzes anzeigbar', () => {
  it('setzt die vier Einzelkabel zu einem Weg zusammen', () => {
    const chains = signalChains(PLAN, KETTE)
    expect(chains).toHaveLength(1)
    expect(chains[0].steps.map((s) => s.cableId)).toEqual(['k1', 'k2', 'k3', 'k4'])
    expect(chains[0].levels).toBe(3)
    expect(chains[0].end).toBe('ziel')
  })

  it('nennt Anfang und Ende in einer Zeile', () => {
    const zeile = chainOneLine(signalChains(PLAN, KETTE)[0])
    expect(zeile).toContain('Kamera 1')
    expect(zeile).toContain('ATEM Constellation')
    expect(zeile).toContain('Patchfeld A')
  })

  it('fängt keine zweite Kette in der Mitte an', () => {
    // Ohne diese Regel stünde derselbe Weg viermal da — einmal ab jedem
    // Zwischenglied.
    expect(signalChains(PLAN, KETTE).map((c) => c.steps[0].cableId)).toEqual(['k1'])
  })

  it('lässt direkte Verbindungen weg — die stehen in der Patchliste', () => {
    const direkt = [kabel('d1', ['cam', 'cam-out'], ['atem', 'atem-in-1'])]
    expect(signalChains([kamera, atem], direkt)).toEqual([])
  })
})

describe('wo die Kette endet, steht warum', () => {
  it('unterscheidet Endgerät von Aufgeben', () => {
    const chains = signalChains(PLAN, KETTE)
    expect(chains[0].end).toBe('ziel')
    expect(chains[0].endNote).toBe('')
  })

  it('meldet den unverkabelten Weiterweg als solchen', () => {
    const chains = signalChains(PLAN, KETTE.slice(0, 3))
    expect(chains[0].end).toBe('nicht-verkabelt')
    expect(chains[0].endNote).toContain('Patchfeld')
  })

  it('meldet die ungleich bestückte Blende mit Zahlen', () => {
    const schief = { ...ppB, inputs: [...ppB.inputs, port('ppb-in-25', 'In 25')] }
    const chains = signalChains([kamera, wand, ppA, schief, atem], KETTE)
    expect(chains[0].end).toBe('mehrdeutig')
    expect(chains[0].endNote).toContain('25')
  })

  it('meldet die Kreuzschiene ohne gesetzten Kreuzpunkt', () => {
    const hub = geraet({
      id: 'hub',
      name: 'Smart Videohub 12x12',
      inputs: Array.from({ length: 12 }, (_, i) => port(`hub-in-${i + 1}`, `In ${i + 1}`)),
      outputs: Array.from({ length: 12 }, (_, i) => port(`hub-out-${i + 1}`, `Out ${i + 1}`)),
    })
    const chains = signalChains(
      [kamera, wand, hub, atem],
      [
        kabel('c1', ['cam', 'cam-out'], ['wall', 'wall-in-1']),
        kabel('c2', ['wall', 'wall-out-1'], ['hub', 'hub-in-2']),
      ],
    )
    // Die Kette läuft durch den Wandanschluss und bleibt an der Kreuzschiene
    // stehen — mit dem Grund, nicht wortlos.
    expect(chains).toHaveLength(1)
    expect(chains[0].end).toBe('mehrdeutig')
    expect(chains[0].endNote).toContain('Kreuzpunkt')
  })
})

describe('der geschaltete Kreuzpunkt trägt die Kette weiter', () => {
  const hub = geraet({
    id: 'hub',
    name: 'Smart Videohub 12x12',
    inputs: Array.from({ length: 12 }, (_, i) => port(`hub-in-${i + 1}`, `In ${i + 1}`)),
    outputs: Array.from({ length: 12 }, (_, i) => port(`hub-out-${i + 1}`, `Out ${i + 1}`)),
    videohubRouting: { planned: { 5: 1 } },
  })
  const gepatcht: Cable[] = [
    kabel('r1', ['cam', 'cam-out'], ['ppa', 'ppa-in-1']),
    kabel('r2', ['ppa', 'ppa-out-1'], ['hub', 'hub-in-2']),
    kabel('r3', ['hub', 'hub-out-6'], ['atem', 'atem-in-1']),
  ]

  it('läuft von der Kamera über Blende und Kreuzschiene bis zum Mischer', () => {
    const chains = signalChains([kamera, ppA, hub, atem], gepatcht)
    expect(chains[0].steps.map((s) => s.cableId)).toEqual(['r1', 'r2', 'r3'])
    expect(chains[0].steps[1].through).toBe('router')
  })

  it('hält ohne gesetzten Kreuzpunkt an — geraten wird nichts', () => {
    const ohne = { ...hub, videohubRouting: undefined }
    const chains = signalChains([kamera, ppA, ohne, atem], gepatcht)
    expect(chains[0].end).toBe('mehrdeutig')
    expect(chains[0].steps.map((s) => s.cableId)).toEqual(['r1', 'r2'])
  })
})
