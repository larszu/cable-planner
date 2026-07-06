import { describe, expect, it } from 'vitest'
import { runDrawingChecks } from '../src/renderer/lib/drawingChecks'
import type { EquipmentItem } from '../src/renderer/types/equipment'
import type { DrumKitPlan } from '../src/renderer/types/drumKit'

// Shure Beta 91A aus dem Katalog braucht 48V-Phantom (powering: 'p48').
const BETA91 = '875fe949-20d3-4c51-b83b-a729c73b363d'

const eq = (over: Partial<EquipmentItem>): EquipmentItem => ({
  id: 'e1',
  name: 'Gerät',
  category: 'Mischpult',
  inputs: [],
  outputs: [],
  x: 0,
  y: 0,
  width: 200,
  height: 160,
  ...over,
})

const xlrIn = (id: string): EquipmentItem['inputs'][number] => ({
  id,
  name: id,
  type: 'XLR',
  connectorType: 'XLR',
})

const kit = (over: Partial<DrumKitPlan>): DrumKitPlan => ({
  zones: [{ id: 'kick', label: 'Kick', kind: 'kick', x: 0.5, y: 0.7 }],
  mics: [],
  technique: 'custom',
  ...over,
})

describe('drawingChecks — Drum-Mikrofonierung (#Grundsatz: nichts erfinden)', () => {
  it('warnt bei zu wenigen XLR-Mic-Inputs im Plan', () => {
    const drumKit = kit({
      mics: [
        { id: 'm1', zoneId: 'kick', micDeviceTypeId: BETA91 },
        { id: 'm2', zoneId: 'kick', micDeviceTypeId: BETA91 },
      ],
    })
    const { findings } = runDrawingChecks({
      equipment: [eq({ id: 'pult', name: 'Pult', inputs: [xlrIn('i1')] })],
      cables: [],
      drumKit,
    })
    const f = findings.find((x) => x.id === 'drum-mic-inputs')
    expect(f).toBeTruthy()
    expect(f?.severity).toBe('warning')
  })

  it('warnt NICHT, wenn genug XLR-Inputs vorhanden sind', () => {
    const drumKit = kit({
      mics: [{ id: 'm1', zoneId: 'kick', micDeviceTypeId: BETA91 }],
    })
    const { findings } = runDrawingChecks({
      equipment: [eq({ id: 'pult', name: 'Pult', inputs: [xlrIn('i1'), xlrIn('i2')] })],
      cables: [],
      drumKit,
    })
    expect(findings.some((x) => x.id === 'drum-mic-inputs')).toBe(false)
  })

  it('meldet Phantom-Bedarf aus echten Katalogdaten (kein Raten)', () => {
    const drumKit = kit({
      mics: [{ id: 'm1', zoneId: 'kick', micDeviceTypeId: BETA91 }],
    })
    const { findings } = runDrawingChecks({
      equipment: [eq({ id: 'pult', name: 'Pult', inputs: [xlrIn('i1')] })],
      cables: [],
      drumKit,
    })
    const f = findings.find((x) => x.id === 'drum-phantom')
    expect(f).toBeTruthy()
    expect(f?.severity).toBe('info')
  })

  it('markiert unbekannte Mics ehrlich als nicht prüfbar', () => {
    const drumKit = kit({
      mics: [{ id: 'm1', zoneId: 'kick' }],
    })
    const { findings } = runDrawingChecks({
      equipment: [eq({ id: 'pult', name: 'Pult', inputs: [xlrIn('i1')] })],
      cables: [],
      drumKit,
    })
    const f = findings.find((x) => x.id === 'drum-unknown-mics')
    expect(f).toBeTruthy()
    expect(f?.severity).toBe('warning')
  })

  it('macht gar nichts ohne Drum-Kit', () => {
    const { findings } = runDrawingChecks({
      equipment: [eq({ id: 'pult', name: 'Pult' })],
      cables: [],
    })
    expect(findings.some((x) => x.category === 'Drum-Mikrofonierung')).toBe(false)
  })
})
