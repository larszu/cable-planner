import { describe, expect, it } from 'vitest'
import { BLACKMAGIC_CATALOG } from '../src/renderer/lib/blackmagicCatalog'
import {
  allRoutes,
  buildInnerMatrix,
  composeMultiviewer,
  composeSource,
  composeTarget,
  ease,
  fullBox,
  normaliseSwitching,
  sampleAt,
  simFrom,
  simRun,
  simStep,
  switchingProfileFor,
  wipeContains,
  type SimState,
  type SwitchingState,
} from '../src/renderer/lib/switching'
import type { EquipmentItem } from '../src/renderer/types/equipment'

// ───────────────────────────────────────────────────────────────────────────
// #1240 Stufe 3 — Simulation und Ergebnisbild.
// Abnahme (Beispiel aus dem Anwendergespraech): M/E 2 geht in SuperSource Box 1, auf M/E 1
// liegt ein USK mit Mediaplayer 1 (PNG) als Fill. Nach „Auto“ zeigt PGM das
// richtige Bild.
// ───────────────────────────────────────────────────────────────────────────

const device = (name: string, switching?: SwitchingState): EquipmentItem => {
  const e = BLACKMAGIC_CATALOG.find((x) => x.template.name === name)
  if (!e) throw new Error(name)
  const t = e.template
  return {
    id: 'atem',
    name: t.name,
    category: t.category,
    x: 0,
    y: 0,
    deviceTypeId: e.deviceTypeId,
    inputs: (t.inputs ?? []).map((p, i) => ({ ...p, id: `atem-in-${i}` })),
    outputs: (t.outputs ?? []).map((p, i) => ({ ...p, id: `atem-out-${i}` })),
    switching,
  } as unknown as EquipmentItem
}

const ATEM = 'Blackmagic ATEM 2 M/E Constellation 4K'

const input = (d: EquipmentItem, sim: SimState) => {
  const matrix = buildInnerMatrix(d, switchingProfileFor(d), sim.switching)
  return { matrix, routes: allRoutes(d, matrix, sim.switching), sim }
}

/** Bis zum Ende laufen lassen, in Bildern zu 20 ms. */
const tickUntilIdle = (sim: SimState, max = 500): SimState => {
  let s = sim
  for (let i = 0; i < max && Object.values(s.runs).some((r) => r.auto); i++) s = simStep(s, { type: 'tick', dtMs: 20 })
  return s
}

describe('Easing wie in lz-switcher-motion', () => {
  it('Stuetzwerte', () => {
    expect(ease({ family: 'linear', direction: 'in' }, 0.3)).toBeCloseTo(0.3)
    expect(ease({ family: 'cubic', direction: 'inOut' }, 0.25)).toBeCloseTo(0.0625)
    expect(ease({ family: 'cubic', direction: 'inOut' }, 0.75)).toBeCloseTo(0.9375)
    expect(ease({ family: 'quad', direction: 'out' }, 0.5)).toBeCloseTo(0.75)
    expect(ease({ family: 'back', direction: 'in' }, 0.5)).toBeCloseTo(-0.0876975)
    expect(ease({ family: 'bounce', direction: 'out' }, 0.5)).toBeCloseTo(0.765625)
    expect(ease({ family: 'expo', direction: 'in' }, 0)).toBe(0)
    for (const f of ['sine', 'circ', 'elastic', 'quint'] as const) {
      expect(ease({ family: f, direction: 'inOut' }, 0)).toBeCloseTo(0)
      expect(ease({ family: f, direction: 'inOut' }, 1)).toBeCloseTo(1)
    }
  })
})

describe('Zustandsmaschine', () => {
  it('Cut tauscht Programm und Vorschau', () => {
    const s = simRun(simFrom({}), [
      { type: 'program', me: 'me:1', source: 'in:1' },
      { type: 'preview', me: 'me:1', source: 'in:2' },
      { type: 'cut', me: 'me:1' },
    ])
    expect(s.switching.routes).toMatchObject({ 'me:1/pgm': 'in:2', 'me:1/pvw': 'in:1' })
  })

  it('Auto laeuft ueber die Rate, mit Easing, und ist dann fertig', () => {
    let s = simRun(simFrom({ routes: { 'me:1/pgm': 'in:1', 'me:1/pvw': 'in:2' } }), [
      { type: 'transition', me: 'me:1', patch: { rateMs: 1000, easing: { family: 'cubic', direction: 'inOut' } } },
      { type: 'auto', me: 'me:1' },
      { type: 'tick', dtMs: 250 },
    ])
    expect(s.runs['me:1'].progress).toBeCloseTo(0.0625)
    expect(s.switching.routes?.['me:1/pgm']).toBe('in:1')
    s = simStep(s, { type: 'tick', dtMs: 750 })
    expect(s.runs['me:1'].auto).toBe(false)
    expect(s.runs['me:1'].tbarInverted).toBe(true)
    expect(s.switching.routes?.['me:1/pgm']).toBe('in:2')
  })

  it('T-Bar: das erreichte Ende ist der neue Anfang', () => {
    let s = simFrom({ routes: { 'me:1/pgm': 'in:1', 'me:1/pvw': 'in:2' } })
    s = simStep(s, { type: 'tbar', me: 'me:1', value: 0.5 })
    expect(s.runs['me:1'].progress).toBeGreaterThan(0)
    s = simStep(s, { type: 'tbar', me: 'me:1', value: 1 })
    expect(s.switching.routes?.['me:1/pgm']).toBe('in:2')
    expect(s.runs['me:1']).toMatchObject({ tbar: 1, tbarInverted: true, progress: 0 })
    // Zurueck nach unten ist der naechste Uebergang.
    s = simStep(s, { type: 'tbar', me: 'me:1', value: 0 })
    expect(s.switching.routes?.['me:1/pgm']).toBe('in:1')
  })

  it('ist deterministisch', () => {
    const cmds = [
      { type: 'auto', me: 'me:1' },
      { type: 'tick', dtMs: 333 },
      { type: 'keyer', id: 'me:1/key:1', onAir: true },
      { type: 'tick', dtMs: 900 },
    ] as const
    const a = simRun(simFrom({ routes: { 'me:1/pgm': 'in:1', 'me:1/pvw': 'in:3' } }), cmds)
    const b = simRun(simFrom({ routes: { 'me:1/pgm': 'in:1', 'me:1/pvw': 'in:3' } }), cmds)
    expect(a).toEqual(b)
  })
})

describe('Ergebnisbild', () => {
  it('Abnahme: M/E 2 in Box 1, USK mit Mediaplayer 1 auf M/E 1, nach Auto zeigt PGM das richtige Bild', () => {
    const d = device(ATEM)
    let sim = simFrom({
      routes: {
        'me:2/pgm': 'in:2',
        'ss:1/box:1': 'me:2',
        'ss:1/box:2': 'in:3',
        'me:1/pgm': 'in:1',
        'me:1/pvw': 'ss:1',
        'me:1/key:1/fill': 'mp:1',
        'mp:1/still': 'still:1',
      },
      keyers: { 'me:1/key:1': { onAir: true, type: 'luma' } },
      media: { 'still:1': { fotoId: 'bauchbinde' } },
    })
    // Vorher: PGM zeigt Eingang 1 und den Key.
    expect(sampleAt(composeSource(input(d, sim), 'pgm'), 0.25, 0.25).map((o) => o.leaf)).toEqual(['mp:1', 'in:1'])
    sim = tickUntilIdle(simStep(sim, { type: 'auto', me: 'me:1' }))
    expect(sim.switching.routes?.['me:1/pgm']).toBe('ss:1')
    const ops = composeSource(input(d, sim), 'pgm')
    // Box 1 oben links: der Key liegt oben, darunter Eingang 2 ueber M/E 2.
    expect(sampleAt(ops, 0.25, 0.25).map((o) => o.leaf)).toEqual(['mp:1', 'in:2', 'black'])
    // Box 2 oben rechts: Eingang 3.
    expect(sampleAt(ops, 0.75, 0.25)[1].leaf).toBe('in:3')
    // Unten (Box 3 und 4 leer): nur Key und Hintergrund der SuperSource.
    expect(sampleAt(ops, 0.25, 0.75).map((o) => o.leaf)).toEqual(['mp:1', 'black'])
    // Box 1 ist ein halbes Bild oben links.
    const box1 = ops.find((o) => o.leaf === 'in:2')
    expect(box1?.rect).toEqual({ x: 0, y: 0, w: 0.5, h: 0.5 })
  })

  it('Mix halb: beide Quellen, die kommende mit halber Deckkraft', () => {
    const d = device(ATEM)
    const sim = simStep(simFrom({ routes: { 'me:1/pgm': 'in:1', 'me:1/pvw': 'in:2' }, transitions: { 'me:1': { easing: { family: 'linear', direction: 'in' } } } }), {
      type: 'tbar',
      me: 'me:1',
      value: 0.5,
    })
    const top = sampleAt(composeSource(input(d, sim), 'pgm'), 0.5, 0.5)
    expect(top.map((o) => [o.leaf, o.alpha])).toEqual([
      ['in:2', 0.5],
      ['in:1', 1],
    ])
  })

  it('Dip geht ueber die Dip-Quelle, Wipe schneidet nach Muster', () => {
    const d = device(ATEM)
    const base = { routes: { 'me:1/pgm': 'in:1', 'me:1/pvw': 'in:2' } }
    const lin = { family: 'linear', direction: 'in' } as const
    const dip = simStep(simFrom({ ...base, transitions: { 'me:1': { style: 'dip', dipSource: 'bars', easing: lin } } }), {
      type: 'tbar',
      me: 'me:1',
      value: 0.75,
    })
    expect(sampleAt(composeSource(input(d, dip), 'pgm'), 0.5, 0.5).map((o) => o.leaf)).toEqual(['in:2', 'bars'])
    const wipe = simStep(simFrom({ ...base, transitions: { 'me:1': { style: 'wipe', wipe: 'right', easing: lin } } }), {
      type: 'tbar',
      me: 'me:1',
      value: 0.4,
    })
    const ops = composeSource(input(d, wipe), 'pgm')
    expect(sampleAt(ops, 0.2, 0.5)[0].leaf).toBe('in:2')
    expect(sampleAt(ops, 0.6, 0.5)[0].leaf).toBe('in:1')
    expect(wipeContains('circle', 0.1, { x: 0, y: 0, w: 1, h: 1 }, 0.5, 0.5)).toBe(true)
    expect(wipeContains('circle', 0.1, { x: 0, y: 0, w: 1, h: 1 }, 0.05, 0.05)).toBe(false)
  })

  it('DSK liegt auf PGM, nicht auf dem M/E-Ausgang; Aux zeigt seine Quelle', () => {
    const d = device(ATEM, undefined)
    const sim = simFrom({
      routes: { 'me:1/pgm': 'in:1', 'dsk:1/fill': 'bars', 'aux:2': 'me:1' },
      keyers: { 'dsk:1': { onAir: true } },
    })
    const i = input(d, sim)
    expect(sampleAt(composeSource(i, 'pgm'), 0.5, 0.5)[0].leaf).toBe('bars')
    expect(sampleAt(composeTarget(i, 'aux:2'), 0.5, 0.5).map((o) => o.leaf)).toEqual(['in:1'])
  })

  it('Multiviewer: Vorschau und Programm gross, Eingaenge klein', () => {
    const d = device(ATEM)
    const sim = simFrom({ routes: { 'me:1/pgm': 'in:1', 'me:1/pvw': 'in:5' } })
    const { ops, windows } = composeMultiviewer(input(d, sim), undefined)
    expect(windows.slice(0, 2).map((w) => w.target)).toEqual(['pvw:me:1', 'pgm'])
    expect(sampleAt(ops, 0.25, 0.25)[0].leaf).toBe('in:5')
    expect(sampleAt(ops, 0.75, 0.25)[0].leaf).toBe('in:1')
    expect(sampleAt(ops, 0.125, 0.625)[0].leaf).toBe('in:1')
    expect(sampleAt(ops, 0.375, 0.625)[0].leaf).toBe('in:2')
  })

  it('eine Schleife zeigt Schwarz statt endlos zu laufen', () => {
    const d = device(ATEM)
    const sim = simFrom({ routes: { 'me:1/pgm': 'ss:1', 'ss:1/box:1': 'me:1' } })
    const ops = composeSource(input(d, sim), 'pgm')
    expect(sampleAt(ops, 0.25, 0.25)[0].leaf).toBe('black')
  })

  it('Boxen: Vorgabe ist das Quad, Heilung behaelt Uebergang und Box', () => {
    expect(fullBox(4, undefined)).toMatchObject({ x: 8, y: -4.5, size: 0.5, enabled: true })
    const d = device(ATEM)
    const s = normaliseSwitching(d, {
      transitions: { 'me:1': { style: 'wipe', wipe: 'circle', rateMs: 500, easing: { family: 'sine', direction: 'out' } }, x: {} },
      boxes: { 'ss:1/box:1': { x: 1, size: 0.3, enabled: false }, 'kaputt': { x: 1 } },
    })
    expect(s?.transitions).toEqual({ 'me:1': { style: 'wipe', wipe: 'circle', rateMs: 500, easing: { family: 'sine', direction: 'out' } } })
    expect(s?.boxes).toEqual({ 'ss:1/box:1': { x: 1, size: 0.3, enabled: false } })
  })
})
