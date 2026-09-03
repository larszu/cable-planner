import { describe, expect, it, beforeEach } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { useProjectStore } from '../src/renderer/store/projectStore'
import type { EquipmentItem } from '../src/renderer/types/equipment'

// ADR-005, Inkrement 4, Regel 3 — die vier Ablehnungen des Mobile-Kabelwegs.
//
// `addCableFromMobile` verwarf in vier Faellen mit einem nackten `return {}`;
// der Kommentar nannte das selbst „silently skip". Fuer den Techniker sah das
// aus wie Erfolg, weil das Handy vorher „wird am Desktop eingefuegt" gemeldet
// hatte — ein Versprechen im Futur von der Seite, die es nicht einloesen kann:
// der Server antwortet 200, sobald das JSON da ist, der Renderer entscheidet
// erst danach, und diese Entscheidung hat keinen Rueckweg.
//
// Dieser Test nagelt beide Haelften fest: dass jede Ablehnung im Bericht
// landet, und dass das Handy nicht mehr verspricht, was es nicht weiss.

const eq = (id: string, portId: string): EquipmentItem =>
  ({
    id,
    name: id,
    category: 'Sonstiges',
    inputs: [{ id: `${portId}-in`, name: 'IN 1', type: 'port', connectorType: 'BNC' }],
    outputs: [{ id: portId, name: 'OUT 1', type: 'port', connectorType: 'BNC' }],
    x: 0,
    y: 0,
    width: 200,
    height: 160,
  }) as unknown as EquipmentItem

const cable = (over: Record<string, unknown> = {}) => ({
  fromEquipmentId: 'a',
  fromPortId: 'a-out',
  toEquipmentId: 'b',
  toPortId: 'b-out-in',
  name: 'Kamera 1 → Regie',
  ...over,
})

const reasons = () => useProjectStore.getState().lastMobileDrop?.drops.map((d) => d.reason) ?? []

describe('addCableFromMobile meldet, was es ablehnt', () => {
  beforeEach(() => {
    const s = useProjectStore.getState()
    s.dismissMobileDrop()
    useProjectStore.setState({
      project: {
        ...s.project,
        equipment: [eq('a', 'a-out'), eq('b', 'b-out')],
        cables: [],
        mode: undefined,
      },
    })
  })

  it('gesperrter Plan: gemeldet statt still verworfen', () => {
    const s = useProjectStore.getState()
    useProjectStore.setState({ project: { ...s.project, mode: 'finalized' } })
    useProjectStore.getState().addCableFromMobile(cable())
    expect(useProjectStore.getState().project.cables).toHaveLength(0)
    expect(reasons()).toEqual(['plan-locked'])
  })

  it('fehlendes Geraet: gemeldet statt still verworfen', () => {
    useProjectStore.getState().addCableFromMobile(cable({ toEquipmentId: 'gibt-es-nicht' }))
    expect(useProjectStore.getState().project.cables).toHaveLength(0)
    expect(reasons()).toEqual(['equipment-gone'])
  })

  it('fehlender Port: gemeldet statt still verworfen', () => {
    useProjectStore.getState().addCableFromMobile(cable({ toPortId: 'gibt-es-nicht' }))
    expect(useProjectStore.getState().project.cables).toHaveLength(0)
    expect(reasons()).toEqual(['port-gone'])
  })

  it('Dublette: gemeldet statt still verworfen', () => {
    useProjectStore.getState().addCableFromMobile(cable())
    expect(useProjectStore.getState().project.cables).toHaveLength(1)
    expect(reasons()).toEqual([])

    useProjectStore.getState().addCableFromMobile(cable())
    expect(useProjectStore.getState().project.cables).toHaveLength(1)
    expect(reasons()).toEqual(['duplicate'])
  })

  it('sammelt mehrere Ablehnungen — sonst verschwinden die frueheren wieder', () => {
    useProjectStore.getState().addCableFromMobile(cable({ toEquipmentId: 'weg' }))
    useProjectStore.getState().addCableFromMobile(cable({ toPortId: 'weg' }))
    expect(reasons()).toEqual(['equipment-gone', 'port-gone'])
  })

  it('traegt den Kabelnamen mit, damit der Bericht greifbar ist', () => {
    useProjectStore.getState().addCableFromMobile(cable({ toEquipmentId: 'weg', name: '  Havarie  ' }))
    expect(useProjectStore.getState().lastMobileDrop?.drops[0].label).toBe('Havarie')
  })

  it('der gute Fall meldet nichts', () => {
    useProjectStore.getState().addCableFromMobile(cable())
    expect(useProjectStore.getState().project.cables).toHaveLength(1)
    expect(useProjectStore.getState().lastMobileDrop).toBeNull()
  })
})

describe('das Handy verspricht nicht mehr, was es nicht wissen kann', () => {
  const mobile = readFileSync(resolve(__dirname, '..', 'src/mobile/MobileApp.tsx'), 'utf8')

  it('sagt nicht mehr, das Kabel werde am Desktop eingefuegt', () => {
    // Der Satz stand als Erfolgsmeldung im Dialog; der Server bestaetigt aber
    // nur den Empfang. Als Kommentar (mit Begruendung) darf er bleiben —
    // gesucht wird die Zeichenkette ausserhalb von Kommentarzeilen.
    const code = mobile
      .split('\n')
      .filter((l) => !l.trim().startsWith('//') && !l.trim().startsWith('*') && !l.includes('/*'))
      .join('\n')
    expect(code).not.toContain('wird am Desktop mit')
  })

  it('sagt stattdessen, was tatsaechlich passiert ist', () => {
    expect(mobile).toContain('An den Desktop gesendet')
  })
})
