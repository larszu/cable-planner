import { describe, expect, it } from 'vitest'
import { BLACKMAGIC_CATALOG } from '../src/renderer/lib/blackmagicCatalog'
import { signalChains } from '../src/renderer/lib/signalChain'
import {
  applySalvo,
  buildInnerMatrix,
  effectiveCounts,
  innerPathsFrom,
  innerPathsInto,
  isBreakaway,
  limitNotes,
  normaliseSwitching,
  pathBlocks,
  recallSnapshot,
  routePatch,
  routerMatrixOf,
  routerPatch,
  runMacro,
  setCrosspoint,
  setKeyer,
  setMediaSlot,
  switchingProfileFor,
  take,
  takeSnapshot,
  type MatrixState,
  type SwitchingBlockCountKey,
  type SwitchingProfile,
} from '../src/renderer/lib/switching'
import type { Cable } from '../src/renderer/types/cable'
import type { EquipmentItem } from '../src/renderer/types/equipment'

// ───────────────────────────────────────────────────────────────────────────
// #1240 Stufe 1 — Funktionsmodell fuer Mischer und Kreuzschienen.
// Abnahme aus dem Anwendergespraech: M/E 2 laeuft in SuperSource Box 1; auf
// M/E 1 liegt ein USK mit Mediaplayer 1 (PNG) als Fill. Der Signalweg-Code
// muss diesen Weg finden.
// ───────────────────────────────────────────────────────────────────────────

const entry = (needle: string) => {
  const e = BLACKMAGIC_CATALOG.find((x) => x.template.name === needle)
  if (!e) throw new Error(needle)
  return e
}

/** Ein Geraet aus dem Katalog, mit stabilen Port-IDs wie im Plan. */
const device = (name: string, id = 'atem'): EquipmentItem => {
  const e = entry(name)
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

const ATEM_2ME_4K = 'Blackmagic ATEM 2 M/E Constellation 4K'

describe('Profile im Katalog', () => {
  const profiled = BLACKMAGIC_CATALOG.filter((e) => e.switchingProfile)

  it('alle ATEM Constellation im Katalog tragen ein Profil mit M/E-Zahl als Feld', () => {
    const constellations = BLACKMAGIC_CATALOG.filter((e) => /constellation/i.test(e.template.name))
    expect(constellations.length).toBeGreaterThanOrEqual(8)
    for (const e of constellations) {
      expect(e.switchingProfile?.role).toBe('mixer')
      expect(e.switchingProfile?.blocks.mixEffects).toBeGreaterThan(0)
    }
    expect(entry(ATEM_2ME_4K).switchingProfile?.blocks.mixEffects).toBe(2)
    expect(entry('Blackmagic ATEM Constellation 8K').switchingProfile?.blocks.mixEffects).toBe(4)
  })

  it('Smart Videohubs sind Kreuzschienen mit einer Ebene, Groesse wie die Ports', () => {
    for (const e of BLACKMAGIC_CATALOG.filter((x) => /smart videohub/i.test(x.template.name))) {
      const p = e.switchingProfile as SwitchingProfile
      expect(p.role).toBe('router')
      expect(p.levels).toEqual([{ id: 'video', label: 'Video' }])
      const sdiIn = (e.template.inputs ?? []).filter((x) => /^SDI In/.test(x.name)).length
      expect(p.blocks.inputs).toBe(sdiIn)
      expect(p.outputs).toBe((e.template.outputs ?? []).filter((x) => /^SDI Out/.test(x.name)).length)
    }
  })

  it('jede Zahl hat eine Herstellerquelle', () => {
    const herkunft = /^https:\/\/(www\.blackmagicdesign\.com|documents\.blackmagicdesign\.com|web\.archive\.org\/web\/\d+\/https:\/\/www\.blackmagicdesign\.com)\//
    expect(profiled.length).toBeGreaterThanOrEqual(12)
    for (const e of profiled) {
      const p = e.switchingProfile as SwitchingProfile
      expect(p.manufacturerUrl).toMatch(herkunft)
      for (const k of Object.keys(p.blocks) as SwitchingBlockCountKey[]) {
        expect(p.sources?.[k] ?? p.manufacturerUrl).toMatch(herkunft)
      }
      if (p.features) expect(p.sources?.features ?? p.manufacturerUrl).toMatch(herkunft)
    }
  })

  it('die Betriebsart 8K nennt nur belegte Grenzen', () => {
    const p = entry('Blackmagic ATEM Constellation 8K').switchingProfile as SwitchingProfile
    const k8 = p.modes?.find((m) => m.id === '8k')
    expect(k8?.limits).toMatchObject({ inputs: 10, aux: 6, mediaPlayers: 1, upstreamKeyers: 4 })
    expect(k8?.limits.mixEffects).toBeUndefined()
  })

  it('das Profil kommt ueber die Geraetetyp-ID ans Geraet', () => {
    expect(switchingProfileFor(device(ATEM_2ME_4K))?.blocks.superSources).toBe(1)
    expect(switchingProfileFor({ deviceTypeId: undefined })).toBeNull()
  })
})

describe('Interne Matrix', () => {
  const d = device(ATEM_2ME_4K)
  const m = buildInnerMatrix(d, switchingProfileFor(d), undefined)

  it('Bausteine aus dem Profil, Eingaenge und Aux an den Anschluessen', () => {
    const count = (k: string) => m.blocks.filter((b) => b.kind === k).length
    expect(count('input')).toBe(20)
    expect(count('mixEffect')).toBe(2)
    expect(count('upstreamKeyer')).toBe(8)
    expect(count('superSource')).toBe(1)
    expect(m.byId.get('ss:1')?.dests.filter((x) => x.role === 'box')).toHaveLength(4)
    expect(count('aux')).toBe(12)
    expect(m.byId.get('aux:3')?.portName).toBe('SDI Out 3')
    expect(m.byId.get('mv:2')?.portName).toBe('Multiview Out 2 (12G-SDI)')
    expect(m.byId.get('in:1')?.portName).toBe('SDI In 1')
    // Quellen-IDs wie im ATEM-Profil-XML
    expect(m.byId.get('me:2')?.sourceId).toBe(10020)
    expect(m.byId.get('mp:1')?.sourceId).toBe(3010)
    expect(m.byId.get('ss:1')?.sourceId).toBe(6001)
  })

  it('ohne Profil gibt es nur, was der Planer ergaenzt', () => {
    const ohne = { ...d, deviceTypeId: undefined } as EquipmentItem
    expect(buildInnerMatrix(ohne, null, undefined).blocks.filter((b) => b.kind !== 'black' && b.kind !== 'bars')).toHaveLength(0)
    const c = effectiveCounts(null, { blocks: { mixEffects: 1, inputs: 4 } })
    expect(c).toEqual({ mixEffects: 1, inputs: 4 })
    // ein belegter Profilwert gewinnt
    expect(effectiveCounts(switchingProfileFor(d), { blocks: { mixEffects: 7 } }).mixEffects).toBe(2)
  })
})

describe('Abnahme: M/E 2 -> SuperSource Box 1, USK auf M/E 1 mit Mediaplayer 1', () => {
  const base = device(ATEM_2ME_4K)
  const profile = switchingProfileFor(base)
  let d: EquipmentItem = base
  const route = (dest: string, src: string | undefined) => {
    d = { ...d, ...routePatch(d, buildInnerMatrix(d, profile, d.switching), dest, src) }
  }
  route('me:2/pgm', 'in:2')
  route('ss:1/box:1', 'me:2')
  route('me:1/pgm', 'ss:1')
  route('mp:1/still', 'still:1')
  route('me:1/key:1/fill', 'mp:1')
  d = { ...d, switching: setMediaSlot(setKeyer(d.switching, 'me:1/key:1', { onAir: true, type: 'luma' }), 1, 'anhang-png') }
  const m = buildInnerMatrix(d, profile, d.switching)

  it('der Weg von M/E 2 kommt ueber Box 1 und M/E 1 im Programm an', () => {
    const wege = innerPathsFrom(d, m, d.switching, 'me:2')
    const pgm = wege.find((w) => w.outputId === 'pgm')
    expect(pgm?.end).toBe('output')
    expect(pathBlocks(pgm!)).toEqual(['me:2', 'ss:1', 'me:1', 'pgm'])
    expect(pgm?.hops[0]).toEqual({ source: 'me:2', dest: 'ss:1/box:1', block: 'ss:1' })
  })

  it('der Mediaplayer kommt ueber den USK im Programm an, das PNG liegt im Pool', () => {
    const wege = innerPathsFrom(d, m, d.switching, 'mp:1')
    expect(wege.map((w) => pathBlocks(w))).toContainEqual(['mp:1', 'me:1/key:1', 'me:1', 'pgm'])
    expect(d.switching?.routes?.['mp:1/still']).toBe('still:1')
    expect(d.switching?.media?.['still:1']).toEqual({ anhangId: 'anhang-png' })
  })

  it('PGM kennt beide Zulaeufe', () => {
    const into = innerPathsInto(d, m, d.switching, 'pgm').map((w) => w.hops[0].source)
    expect(into).toEqual(expect.arrayContaining(['in:2', 'me:2', 'ss:1', 'mp:1']))
  })

  it('ein Keyer, der nicht auf Sendung ist, endet benannt', () => {
    const aus = { ...d.switching, keyers: { 'me:1/key:1': { onAir: false } } }
    const wege = innerPathsFrom(d, m, aus, 'mp:1')
    expect(wege[0].end).toBe('off-air')
  })

  it('eine Schleife haengt nicht', () => {
    let s = { ...d.switching, routes: { ...d.switching?.routes, 'me:2/pgm': 'ss:1' } }
    s = { ...s }
    const wege = innerPathsFrom(d, buildInnerMatrix(d, profile, s), s, 'ss:1')
    expect(wege.some((w) => w.end === 'loop')).toBe(true)
  })
})

describe('Aux auf einen Eingang ist auch fuer den Plan-Signalweg ein Weiterweg', () => {
  it('steht in plannedCrosspoints und signalChains laeuft durch', () => {
    let d = device(ATEM_2ME_4K)
    const m = buildInnerMatrix(d, switchingProfileFor(d), undefined)
    d = { ...d, ...routePatch(d, m, 'aux:1', 'in:3') }
    expect(d.plannedCrosspoints).toEqual({ [m.byId.get('aux:1')!.portId!]: m.byId.get('in:3')!.portId! })
    expect(d.switching?.routes?.['aux:1']).toBeUndefined()

    const cam = { id: 'cam', name: 'Cam', x: 0, y: 0, inputs: [], outputs: [{ id: 'c', name: 'SDI' }] } as unknown as EquipmentItem
    const mon = { id: 'mon', name: 'Mon', x: 0, y: 0, inputs: [{ id: 'mi', name: 'SDI' }], outputs: [] } as unknown as EquipmentItem
    const cables = [
      { id: 'k1', fromEquipmentId: 'cam', fromPortId: 'c', toEquipmentId: 'atem', toPortId: m.byId.get('in:3')!.portId },
      { id: 'k2', fromEquipmentId: 'atem', fromPortId: m.byId.get('aux:1')!.portId, toEquipmentId: 'mon', toPortId: 'mi' },
    ] as unknown as Cable[]
    const kette = signalChains([cam, d, mon], cables, { vonEquipmentId: 'cam' })[0]
    expect(kette.steps.at(-1)?.toEquipmentId).toBe('mon')
    expect(kette.steps[0].through).toBe('mixer')

    // Auf eine interne Quelle: plannedCrosspoints wird frei, routes traegt es.
    d = { ...d, ...routePatch(d, m, 'aux:1', 'me:1') }
    expect(d.plannedCrosspoints).toBeUndefined()
    expect(d.switching?.routes?.['aux:1']).toBe('me:1')
  })
})

describe('Kreuzschiene: Ebenen, Breakaway, Sperre, Take, Salvo', () => {
  const profile: SwitchingProfile = {
    role: 'router',
    manufacturerUrl: 'https://example.invalid',
    blocks: { inputs: 4 },
    outputs: 4,
    levels: [
      { id: 'video', label: 'Video' },
      { id: 'a1', label: 'Audio 1' },
    ],
  }
  const leer: MatrixState = { levels: {}, pending: {}, locks: {} }

  it('alle Ebenen oder eine Ebene (Breakaway)', () => {
    let s = setCrosspoint(leer, profile, { dest: 'o1', source: 'i1', level: 'all' }).state
    expect(s.levels).toEqual({ video: { o1: 'i1' }, a1: { o1: 'i1' } })
    expect(isBreakaway(s, 'o1')).toBe(false)
    s = setCrosspoint(s, profile, { dest: 'o1', source: 'i2', level: 'a1' }).state
    expect(isBreakaway(s, 'o1')).toBe(true)
  })

  it('lock verweigert immer, protect nur ohne Absicht', () => {
    const gesperrt = { ...leer, locks: { o1: 'lock' as const, o2: 'protect' as const } }
    expect(setCrosspoint(gesperrt, profile, { dest: 'o1', source: 'i1', level: 'all' }).refused).toBe('locked')
    expect(setCrosspoint(gesperrt, profile, { dest: 'o2', source: 'i1', level: 'all' }).refused).toBe('protected')
    expect(setCrosspoint(gesperrt, profile, { dest: 'o2', source: 'i1', level: 'all', override: true }).refused).toBeUndefined()
  })

  it('Take schaltet alles Vorgemerkte gemeinsam', () => {
    let s = setCrosspoint(leer, profile, { dest: 'o1', source: 'i1', level: 'video', preset: true }).state
    s = setCrosspoint(s, profile, { dest: 'o2', source: 'i3', level: 'video', preset: true }).state
    expect(s.levels).toEqual({})
    const r = take(s)
    expect(r.state.levels.video).toEqual({ o1: 'i1', o2: 'i3' })
    expect(r.state.pending).toEqual({})
  })

  it('Salvo setzt seine Kreuzpunkte, gesperrte Ziele bleiben', () => {
    const s = { ...leer, locks: { o2: 'lock' as const } }
    const r = applySalvo(s, { id: 's', name: 'Teil 1', crosspoints: { video: { o1: 'i4', o2: 'i4' } } })
    expect(r.state.levels.video).toEqual({ o1: 'i4' })
    expect(r.refused).toEqual(['o2'])
  })

  it('Video liegt beim Videohub in der Index-Tabelle, die der Export liest', () => {
    const vh = device('Blackmagic Smart Videohub 20x20', 'vh')
    const s = setCrosspoint(routerMatrixOf(vh), switchingProfileFor(vh), { dest: 'vh-out-2', source: 'vh-in-5', level: 'all' }).state
    const patch = routerPatch(vh, s)
    expect(patch.videohubRouting?.planned).toEqual({ 2: 5 })
    expect(patch.plannedCrosspoints).toBeUndefined()
    expect(routerMatrixOf({ ...vh, ...patch }).levels.video).toEqual({ 'vh-out-2': 'vh-in-5' })
  })
})

describe('Betriebsart, Snapshot, Makro, Heilung', () => {
  it('8K-Betriebsart meldet zu viele Aux als Hinweis', () => {
    const d = device('Blackmagic ATEM Constellation 8K')
    const p = switchingProfileFor(d)
    const routes = Object.fromEntries(Array.from({ length: 7 }, (_, i) => [`aux:${i + 1}`, 'me:1']))
    const s = { mode: '8k', routes }
    expect(limitNotes(p, buildInnerMatrix(d, p, s), s)).toEqual([{ key: 'aux', limit: 6, used: 7 }])
    expect(limitNotes(p, buildInnerMatrix(d, p, s), { ...s, mode: 'uhd' })).toEqual([])
  })

  it('Snapshot friert ein, Makro schaltet der Reihe nach', () => {
    let s = takeSnapshot({ routes: { 'me:1/pgm': 'in:1' } }, 'a', 'Opener')
    s = { ...s, routes: { 'me:1/pgm': 'in:2' } }
    expect(recallSnapshot(s, 'a').routes).toEqual({ 'me:1/pgm': 'in:1' })
    const r = runMacro(s, {
      id: 'm',
      name: 'Key an',
      steps: [{ route: { dest: 'me:1/key:1/fill', source: 'mp:1' } }, { keyer: { id: 'me:1/key:1', onAir: true } }],
    })
    expect(r.routes?.['me:1/key:1/fill']).toBe('mp:1')
    expect(r.keyers?.['me:1/key:1']?.onAir).toBe(true)
  })

  it('Heilung wirft kaputte Teile und Wege ins Leere heraus', () => {
    const d = device(ATEM_2ME_4K)
    const s = normaliseSwitching(d, {
      routes: { 'me:1/pgm': 'in:3', 'me:9/pgm': 'in:1', 'aux:1': 'gibtsnicht', 'mp:1/still': 'still:2' },
      keyers: { 'me:1/key:1': { onAir: true, type: 'quatsch' } },
      media: { 'still:2': { anhangId: 'x' }, 'still:3': { fotoId: 'f' }, 'still:4': {}, 'unsinn': { anhangId: 'y' } },
      locks: { a: 'lock', b: 'nein' },
    })
    expect(s?.routes).toEqual({ 'me:1/pgm': 'in:3', 'mp:1/still': 'still:2' })
    expect(s?.keyers).toEqual({ 'me:1/key:1': { onAir: true } })
    expect(s?.media).toEqual({ 'still:2': { anhangId: 'x' }, 'still:3': { fotoId: 'f' } })
    expect(s?.locks).toEqual({ a: 'lock' })
    expect(normaliseSwitching(d, { routes: { quatsch: 1 } })).toBeUndefined()
    expect(normaliseSwitching(d, 'kaputt')).toBeUndefined()
  })
})
