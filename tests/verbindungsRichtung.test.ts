/**
 * #1029 — Kabel Eingang→Eingang wurde ohne Warnung angelegt.
 * #1031 — Port-Griff bei 40 % Zoom ~6 px gross.
 */
import { describe, expect, it, beforeEach } from 'vitest'
import { useProjectStore } from '../src/renderer/store/projectStore'
import { useUiStore } from '../src/renderer/store/uiStore'
import { richteVerbindungAus } from '../src/renderer/lib/connectionDirection'
import { griffAusdehnung, MIN_SCREEN_PX } from '../src/renderer/lib/griffFlaeche'
import type { EquipmentItem, Port } from '../src/renderer/types/equipment'

const port = (id: string, direction?: Port['direction']): Port => ({
  id,
  name: id,
  originalName: id,
  type: 'BNC',
  connectorType: 'BNC',
  ...(direction ? { direction } : {}),
})

const geraet = (id: string, inputs: Port[], outputs: Port[]): EquipmentItem => ({
  id,
  name: id,
  type: 'Device',
  category: 'Video',
  x: 0,
  y: 0,
  inputs,
  outputs,
})

const atem = geraet('atem', [port('sdi-in-3')], [port('sdi-out-1')])
const kamera = geraet('kamera', [port('sdi-in-return')], [port('sdi-out')])
const switchA = geraet('switch-a', [port('rj45-1', 'bidirectional')], [])
const switchB = geraet('switch-b', [port('rj45-1', 'bidirectional')], [])
const equipment = [atem, kamera, switchA, switchB]

const verb = (source: string, sourceHandle: string, target: string, targetHandle: string) => ({
  source,
  sourceHandle,
  target,
  targetHandle,
})

describe('richteVerbindungAus', () => {
  it('lehnt Eingang→Eingang ab (der beobachtete Fall)', () => {
    const r = richteVerbindungAus(equipment, verb('atem', 'sdi-in-3', 'kamera', 'sdi-in-return'))
    expect(r).toEqual({ ok: false, grund: 'inputToInput' })
  })

  it('lehnt Ausgang→Ausgang ab', () => {
    const r = richteVerbindungAus(equipment, verb('atem', 'sdi-out-1', 'kamera', 'sdi-out'))
    expect(r).toEqual({ ok: false, grund: 'outputToOutput' })
  })

  it('laesst Ausgang→Eingang unveraendert', () => {
    const c = verb('kamera', 'sdi-out', 'atem', 'sdi-in-3')
    expect(richteVerbindungAus(equipment, c)).toEqual({ ok: true, connection: c, umgedreht: false })
  })

  it('dreht Eingang→Ausgang auf Ausgang→Eingang', () => {
    const r = richteVerbindungAus(equipment, verb('atem', 'sdi-in-3', 'kamera', 'sdi-out'))
    expect(r).toEqual({ ok: true, umgedreht: true, connection: verb('kamera', 'sdi-out', 'atem', 'sdi-in-3') })
  })

  it('bidirektional passt an beide Enden und richtet den gerichteten Port aus', () => {
    expect(richteVerbindungAus(equipment, verb('switch-a', 'rj45-1', 'switch-b', 'rj45-1')).ok).toBe(true)
    const r = richteVerbindungAus(equipment, verb('atem', 'sdi-in-3', 'switch-a', 'rj45-1'))
    expect(r).toMatchObject({ ok: true, umgedreht: true, connection: { source: 'switch-a', target: 'atem' } })
  })

  it('unbekannte Endpunkte bleiben unbewertet', () => {
    const c = verb('stummel', 'x', 'atem', 'sdi-in-3')
    expect(richteVerbindungAus(equipment, c)).toEqual({ ok: true, connection: c, umgedreht: false })
  })
})

describe('queueConnection richtet aus', () => {
  beforeEach(() => {
    const s = useProjectStore.getState()
    useProjectStore.setState({
      project: { ...s.project, equipment, cables: [], mode: undefined },
      portConflict: undefined,
      pendingConnection: undefined,
      pendingWaypoints: undefined,
      showCableDialog: false,
    })
  })

  it('Eingang→Eingang oeffnet keinen Kabeldialog', () => {
    useProjectStore.getState().queueConnection(verb('atem', 'sdi-in-3', 'kamera', 'sdi-in-return'))
    expect(useProjectStore.getState().showCableDialog).toBe(false)
    expect(useProjectStore.getState().pendingConnection).toBeUndefined()
  })

  it('Eingang→Ausgang wird gedreht, die Knicke drehen mit', () => {
    const knicke = [{ x: 1, y: 1 }, { x: 2, y: 2 }]
    useProjectStore.getState().queueConnection(verb('atem', 'sdi-in-3', 'kamera', 'sdi-out'), knicke)
    const s = useProjectStore.getState()
    expect(s.showCableDialog).toBe(true)
    expect(s.pendingConnection).toMatchObject({ source: 'kamera', sourceHandle: 'sdi-out', target: 'atem' })
    expect(s.pendingWaypoints).toEqual([{ x: 2, y: 2 }, { x: 1, y: 1 }])
  })
})

describe('Klick-Zeichnen: Ablehnung steht in der Leiste', () => {
  it('rejectPendingCableEnd markiert, der naechste Knick loescht die Markierung', () => {
    const ui = useUiStore.getState()
    ui.startPendingCable({ nodeId: 'atem', handleId: 'sdi-in-3', handleType: 'target' })
    useUiStore.getState().rejectPendingCableEnd('inputToInput')
    expect(useUiStore.getState().pendingCable?.abgelehnt).toBe('inputToInput')
    useUiStore.getState().addPendingWaypoint({ x: 0, y: 0 })
    expect(useUiStore.getState().pendingCable?.abgelehnt).toBeUndefined()
    useUiStore.getState().clearPendingCable()
  })
})

describe('griffAusdehnung', () => {
  const PORT_ROW = 22
  const HANDLE = 16

  it('bei 100 % keine Ausdehnung — an der Maus aendert sich nichts', () => {
    expect(griffAusdehnung(1, PORT_ROW, HANDLE)).toEqual({ aussen: 0, vertikal: 0 })
  })

  it('bei 40 % mindestens MIN_SCREEN_PX nach aussen', () => {
    const { aussen } = griffAusdehnung(0.4, PORT_ROW, HANDLE)
    expect((HANDLE + aussen) * 0.4).toBeGreaterThanOrEqual(MIN_SCREEN_PX - 0.05)
  })

  it('vertikal nie bis in die Nachbar-Reihe', () => {
    for (const zoom of [0.1, 0.2, 0.4, 0.6]) {
      const { vertikal } = griffAusdehnung(zoom, PORT_ROW, HANDLE)
      expect(HANDLE + 2 * vertikal).toBeLessThan(PORT_ROW)
    }
  })

  it('unsinniger Zoom ergibt keine Ausdehnung', () => {
    expect(griffAusdehnung(0, PORT_ROW, HANDLE)).toEqual({ aussen: 0, vertikal: 0 })
    expect(griffAusdehnung(Number.NaN, PORT_ROW, HANDLE)).toEqual({ aussen: 0, vertikal: 0 })
  })
})
