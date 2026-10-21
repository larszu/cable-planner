// Leerlauf-Last (2026-10-21): die gepackte App brauchte auf einem grossen Plan
// im Leerlauf 25–35 % eines Kerns. Diese Tests halten die Stellschrauben fest,
// die das behoben haben — jede einzelne kam unbemerkt zustande und kaeme
// genauso unbemerkt zurueck.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import { edgeFlow, EMPTY_LIVE, hatFrischeMeldung, linkIndex } from '../src/renderer/lib/signalAnimation'
import { liveTickerLaeuft, useLiveStore, LIVE_TICK_MS } from '../src/renderer/store/liveStore'
import {
  flushProjectAutosave,
  projektGeaendert,
  scheduleProjectAutosave,
} from '../src/renderer/store/projectAutosave'
import { equipmentObstacles } from '../src/renderer/lib/equipmentObstacles'
import { rasterAus } from '../src/renderer/lib/raster'
import type { CablePlannerProject } from '../src/renderer/types/project'
import type { EquipmentItem } from '../src/renderer/types/equipment'

const kabel = { id: 'c1', bidirectional: false }

describe('Fluss-Animation nur, wo etwas live ist', () => {
  it('Schema bewegt sich nicht — auch mit eingeschalteter Bewegung', () => {
    expect(edgeFlow(kabel, EMPTY_LIVE, 0, { motion: true }).animate).toBe(false)
  })
  it('eine frische Meldung bewegt sich', () => {
    const snap = { links: [{ cableId: 'c1', state: 'carrying' as const, at: 1000, source: 'atem' as const }], tally: [], lastContactAt: 1000 }
    expect(edgeFlow(kabel, snap, 1200, { motion: true }).animate).toBe(true)
  })
  it('der Link-Index wird je Snapshot einmal gebaut', () => {
    const snap = { links: [{ cableId: 'c1', state: 'idle' as const, at: 0, source: 'atem' as const }], tally: [] }
    expect(linkIndex(snap)).toBe(linkIndex(snap))
  })
})

describe('ein gemeinsamer Live-Takt, der von selbst stehenbleibt', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => {
    useLiveStore.getState().verbindungWeg()
    vi.useRealTimers()
  })

  it('laeuft ohne Kontakt nicht', () => {
    useLiveStore.getState().verbindungWeg()
    expect(liveTickerLaeuft()).toBe(false)
  })

  it('laeuft, solange etwas veralten kann, und steht danach', () => {
    useLiveStore.getState().melde({ tally: [] }, Date.now())
    expect(liveTickerLaeuft()).toBe(true)
    vi.advanceTimersByTime(LIVE_TICK_MS * 10)
    expect(hatFrischeMeldung(useLiveStore.getState().snapshot, Date.now())).toBe(false)
    expect(liveTickerLaeuft()).toBe(false)
  })

  it('ein Abmelden ohne etwas zu raeumen erzeugt keinen neuen Zustand', () => {
    useLiveStore.getState().verbindungWeg()
    const vorher = useLiveStore.getState().snapshot
    useLiveStore.getState().verbindungWeg('links')
    useLiveStore.getState().verbindungWeg()
    expect(useLiveStore.getState().snapshot).toBe(vorher)
  })
})

describe('Kanten rechnen nicht je Rendern neu', () => {
  it('Hindernisse werden je Geraetestand einmal gebaut', () => {
    const equipment = [{ id: 'a', name: 'A', category: 'video', x: 0, y: 0, inputs: [], outputs: [] }] as unknown as EquipmentItem[]
    const r = rasterAus(12)
    expect(equipmentObstacles(equipment, undefined, r)).toBe(equipmentObstacles(equipment, undefined, rasterAus(12)))
    expect(equipmentObstacles([...equipment], undefined, r)).not.toBe(equipmentObstacles(equipment, undefined, r))
  })

  it('CableEdge und EquipmentNode sind memoisiert und abonnieren kein hoveredCableId', () => {
    const edge = readFileSync('src/renderer/components/Canvas/CableEdge.tsx', 'utf8')
    const node = readFileSync('src/renderer/components/Canvas/EquipmentNode.tsx', 'utf8')
    expect(edge).toContain('export const CableEdge = memo(')
    expect(node).toContain('export const EquipmentNode = memo(')
    expect(edge).not.toMatch(/\(s\) => s\.hoveredCableId\)/)
    expect(node).not.toMatch(/\(s\) => s\.hoveredCableId\)/)
  })
})

describe('Abfragen nur ueber den gemeinsamen Helfer', () => {
  it('kein rohes setInterval in den abfragenden Komponenten', () => {
    for (const f of [
      'src/renderer/components/Layout/StatusBar.tsx',
      'src/renderer/components/Settings/tabs/McpTab.tsx',
      'src/renderer/components/Atem/AtemAudioRouterDialog.tsx',
      'src/renderer/components/Canvas/StreamPreviewTile.tsx',
      'src/renderer/components/Properties/sections/GreenGoLiveSection.tsx',
      'src/renderer/components/ShowControl/OscEmpfangPanel.tsx',
      'src/renderer/hooks/useAtemTallyFeed.ts',
      'src/renderer/hooks/useVideohubLinkFeed.ts',
      'src/renderer/hooks/useCanvasFlow.ts',
    ]) {
      expect(readFileSync(f, 'utf8'), f).not.toContain('setInterval(')
    }
  })
})

const projekt = (teil: Partial<CablePlannerProject> = {}): CablePlannerProject =>
  ({
    metadata: { name: 'p', description: '', createdAt: '', updatedAt: '' },
    equipment: [],
    cables: [],
    canvasState: { x: 0, y: 0, zoom: 1 },
    ...teil,
  }) as CablePlannerProject

describe('Autosave: nur echte Aenderungen, nie verloren', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    localStorage.clear()
  })
  afterEach(() => vi.useRealTimers())

  it('ein reiner Ausschnitt-Wechsel ist keine Aenderung', () => {
    const a = projekt()
    expect(projektGeaendert(a, { ...a, canvasState: { x: 5, y: 5, zoom: 2 } })).toBe(false)
    expect(projektGeaendert(a, { ...a, cables: [] })).toBe(true)
  })

  it('schreibt einen Ausschnitt-Wechsel nicht', () => {
    const a = projekt()
    scheduleProjectAutosave(a)
    vi.runAllTimers()
    const spy = vi.spyOn(localStorage, 'setItem')
    scheduleProjectAutosave({ ...a, canvasState: { x: 1, y: 2, zoom: 3 } })
    vi.runAllTimers()
    expect(spy).not.toHaveBeenCalled()
  })

  it('schreibt beim Verbergen des Fensters sofort, ohne auf den Takt zu warten', () => {
    const a = projekt({ equipment: [] })
    scheduleProjectAutosave(a)
    flushProjectAutosave()
    expect(localStorage.getItem('cable-planner:projectAutosave')).toContain('"name":"p"')
  })

  it('der letzte Stand gewinnt, auch wenn er nur den Ausschnitt mitbringt', () => {
    const a = projekt()
    scheduleProjectAutosave(a)
    const b = { ...a, equipment: [] }
    scheduleProjectAutosave(b)
    scheduleProjectAutosave({ ...b, canvasState: { x: 9, y: 9, zoom: 1 } })
    vi.runAllTimers()
    expect(JSON.parse(localStorage.getItem('cable-planner:projectAutosave')!).canvasState.x).toBe(9)
  })
})
