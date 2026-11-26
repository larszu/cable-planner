import { describe, expect, it } from 'vitest'
import { BLACKMAGIC_CATALOG } from '../src/renderer/lib/blackmagicCatalog'
import {
  atemEmuTopology,
  atemEmuValues,
  atemPatchFromEmu,
  videohubEmuValues,
  videohubPatchFromEmu,
} from '../src/renderer/lib/emulatorState'
import { buildInnerMatrix, routePatch, routerMatrixOf, switchingProfileFor } from '../src/renderer/lib/switching'
import type { EquipmentItem } from '../src/renderer/types/equipment'

// #1240 Stufe 5 — Modell <-> Emulator-Tabelle.

const device = (name: string, id: string): EquipmentItem => {
  const e = BLACKMAGIC_CATALOG.find((x) => x.template.name === name)
  if (!e) throw new Error(name)
  const t = e.template
  return {
    id,
    name: t.name,
    category: t.category,
    x: 0,
    y: 0,
    deviceTypeId: e.deviceTypeId,
    inputs: (t.inputs ?? []).map((p, i) => ({ ...p, id: `${id}-in-${i}` })),
    outputs: (t.outputs ?? []).map((p, i) => ({ ...p, id: `${id}-out-${i}` })),
  } as unknown as EquipmentItem
}

describe('ATEM', () => {
  const d0 = device('Blackmagic ATEM 2 M/E Constellation HD', 'atem')
  const m = buildInnerMatrix(d0, switchingProfileFor(d0), undefined)
  let d: EquipmentItem = { ...d0, ...routePatch(d0, m, 'me:2/pgm', 'in:2') }
  d = { ...d, ...routePatch(d, m, 'ss:1/box:1', 'me:2') }
  d = { ...d, ...routePatch(d, m, 'me:1/pgm', 'ss:1') }

  it('Topologie und Werte aus dem Plan', () => {
    const t = atemEmuTopology(d)
    expect(t.mixEffects).toBe(2)
    expect(t.superSourceBoxes).toBe(4)
    expect(t.sources.map((s) => s.id)).toEqual(expect.arrayContaining([0, 1, 1000, 2001, 3010, 3011, 6000, 10010, 10011, 8001]))
    const v = atemEmuValues(d)
    expect(v['me.0.pgm']).toBe(6000)
    expect(v['me.1.pgm']).toBe(2)
    expect(v['ss.0.box.0.src']).toBe(10020)
    expect(v['ss.0.box.0.on']).toBe(true)
    expect(v['ss.0.box.1.on']).toBe(false)
  })

  it('Pultaenderungen werden zum Patch; Aux auf einen Eingang landet am Geraet', () => {
    const p = atemPatchFromEmu(d, { 'me.0.pgm': 3, 'me.0.key.0.on': true, 'dsk.1.on': true, 'aux.0': 4, 'me.1.pvw': 7001 })
    const e = { ...d, ...p }
    expect(e.switching?.routes?.['me:1/pgm']).toBe('in:3')
    expect(e.switching?.keyers?.['me:1/key:1']?.onAir).toBe(true)
    expect(e.switching?.keyers?.['dsk:2']?.onAir).toBe(true)
    expect(e.switching?.routes?.['me:2/pvw']).toBeUndefined()
    expect(atemEmuValues(e)['aux.0']).toBe(4)
    expect(atemPatchFromEmu(d, { 'me.0.pgm': 7001 })).toEqual({})
  })
})

describe('Videohub', () => {
  const d = device('Blackmagic Smart Videohub 20x20', 'vh')
  it('Routing und Sperren hin und zurueck', () => {
    const e = { ...d, ...videohubPatchFromEmu(d, { 'route.2': 5 }) }
    expect(routerMatrixOf(e).levels.video['vh-out-2']).toBe('vh-in-5')
    const v = videohubEmuValues({ ...e, switching: { ...e.switching, locks: { 'vh-out-3': 'lock' } } })
    expect(v['route.2']).toBe(5)
    expect(v['lock.3']).toBe(true)
    expect(v['lock.2']).toBe(false)
  })
})
