// ───────────────────────────────────────────────────────────────────────────
// Modell <-> Emulator (#1240, Stufe 5). REIN.
//
// Der Emulator im Hauptprozess kennt nur ATEM-Nummern bzw. Videohub-Indizes
// in einer flachen Tabelle (`types/emulator.ts`). Hier entsteht diese
// Tabelle aus dem Geraet im Plan, und was ein Pult geschaltet hat, wird
// wieder zum Patch fuer das Geraet — ueber dieselben Wege, die die
// Innenansicht benutzt (`routePatch`, `routerPatch`), damit nie zwei
// Angaben fuer denselben Bus entstehen.
// ───────────────────────────────────────────────────────────────────────────
import type { EquipmentItem } from '../types/equipment'
import type { AtemEmuSource, AtemEmuTopology, EmuValues, VideohubEmuTopology } from '../types/emulator'
import {
  buildInnerMatrix,
  effectiveCounts,
  routeOf,
  routePatch,
  routerMatrixOf,
  routerPatch,
  switchingProfileFor,
  VIDEO_LEVEL,
  type InnerMatrix,
} from './switching'

const matrixOf = (device: EquipmentItem): InnerMatrix =>
  buildInnerMatrix(device, switchingProfileFor(device), device.switching)

const PORT_TYPE: Record<string, number> = {
  input: 0,
  black: 1,
  bars: 2,
  color: 3,
  mediaPlayer: 4,
  superSource: 6,
  mixEffect: 128,
}

const DEFAULT_NAME: Record<string, string> = {
  black: 'Black',
  bars: 'Color Bars',
  color: 'Color',
  mediaPlayer: 'Media Player',
  superSource: 'SuperSource',
  mixEffect: 'ME',
}

// ─── ATEM ──────────────────────────────────────────────────────────────

export const atemEmuTopology = (device: EquipmentItem): AtemEmuTopology => {
  const profile = switchingProfileFor(device)
  const state = device.switching
  const c = effectiveCounts(profile, state)
  const matrix = matrixOf(device)
  const names = state?.atemProfile?.inputs ?? {}
  const sources: AtemEmuSource[] = []
  const add = (id: number, long: string, internalPortType: number) => {
    const n = names[String(id)]
    sources.push({
      id,
      longName: (n?.longName || long).slice(0, 20),
      shortName: (n?.shortName || long.replace(/\s+/g, '')).slice(0, 4),
      internalPortType,
    })
  }
  for (const b of matrix.blocks) {
    if (b.sourceId === undefined) continue
    const base = b.kind === 'input' ? (b.portName ?? `Input ${b.index}`) : `${DEFAULT_NAME[b.kind] ?? b.kind}${b.kind === 'black' || b.kind === 'bars' ? '' : ` ${b.index}`}`
    add(b.sourceId, b.kind === 'mixEffect' ? `${base} Program` : b.kind === 'mediaPlayer' ? `${base}` : base, PORT_TYPE[b.kind] ?? 0)
    if (b.kind === 'mediaPlayer') add(b.sourceId + 1, `${base} Key`, 5)
    if (b.kind === 'mixEffect') add(b.sourceId + 1, `${base} Preview`, 128)
  }
  for (const b of matrix.blocks) if (b.kind === 'aux') add(8000 + b.index, `Aux ${b.index}`, 129)
  return {
    productName: state?.atemProfile?.product ?? device.name ?? 'ATEM',
    mixEffects: c.mixEffects ?? 0,
    keyersPerMe: c.upstreamKeyersPerMe ?? 0,
    downstreamKeyers: c.downstreamKeyers ?? 0,
    aux: c.aux ?? 0,
    mediaPlayers: c.mediaPlayers ?? 0,
    superSources: c.superSources ?? 0,
    superSourceBoxes: c.superSourceBoxes ?? 0,
    stills: c.stills ?? 0,
    macros: c.macros ?? 0,
    sources,
  }
}

export const atemEmuValues = (device: EquipmentItem): EmuValues => {
  const state = device.switching
  const matrix = matrixOf(device)
  const topo = atemEmuTopology(device)
  const v: EmuValues = {}
  const src = (dest: string) => {
    const s = routeOf(device, matrix, state, dest)
    return s ? matrix.byId.get(s)?.sourceId : undefined
  }
  const put = (k: string, val: number | boolean | string | undefined) => {
    if (val !== undefined) v[k] = val
  }
  for (let m = 0; m < topo.mixEffects; m++) {
    put(`me.${m}.pgm`, src(`me:${m + 1}/pgm`) ?? 0)
    put(`me.${m}.pvw`, src(`me:${m + 1}/pvw`) ?? 0)
    for (let k = 0; k < topo.keyersPerMe; k++) {
      put(`me.${m}.key.${k}.on`, state?.keyers?.[`me:${m + 1}/key:${k + 1}`]?.onAir === true)
      put(`me.${m}.key.${k}.fill`, src(`me:${m + 1}/key:${k + 1}/fill`) ?? 0)
      put(`me.${m}.key.${k}.key`, src(`me:${m + 1}/key:${k + 1}/key`) ?? 0)
    }
  }
  for (let d = 0; d < topo.downstreamKeyers; d++) {
    put(`dsk.${d}.on`, state?.keyers?.[`dsk:${d + 1}`]?.onAir === true)
    put(`dsk.${d}.fill`, src(`dsk:${d + 1}/fill`) ?? 0)
    put(`dsk.${d}.key`, src(`dsk:${d + 1}/key`) ?? 0)
  }
  for (let a = 0; a < topo.aux; a++) put(`aux.${a}`, src(`aux:${a + 1}`) ?? 0)
  for (let s = 0; s < topo.superSources; s++) {
    for (let b = 0; b < topo.superSourceBoxes; b++) {
      const id = src(`ss:${s + 1}/box:${b + 1}`)
      put(`ss.${s}.box.${b}.src`, id ?? 0)
      put(`ss.${s}.box.${b}.on`, state?.atemProfile?.boxes?.[`ss:${s + 1}/box:${b + 1}`] ?? id !== undefined)
    }
  }
  for (const s of topo.sources) {
    put(`in.${s.id}.long`, s.longName)
    put(`in.${s.id}.short`, s.shortName)
  }
  return v
}

/**
 * Was ein Pult am Emulator geschaltet hat, als Patch fuer das Geraet.
 * Quellen, fuer die der Plan keinen Baustein hat, werden uebergangen.
 */
export const atemPatchFromEmu = (device: EquipmentItem, changed: EmuValues): Partial<EquipmentItem> => {
  const matrix = matrixOf(device)
  const bySource = new Map(matrix.blocks.filter((b) => b.sourceId !== undefined).map((b) => [b.sourceId as number, b.id]))
  let cur: EquipmentItem = device
  let touched = false
  const route = (dest: string, id: unknown) => {
    if (typeof id !== 'number' || !matrix.destOwner.has(dest)) return
    const src = bySource.get(id)
    if (!src) return
    cur = { ...cur, ...routePatch(cur, matrix, dest, src) }
    touched = true
  }
  const keyer = (id: string, on: unknown) => {
    if (typeof on !== 'boolean') return
    const st = cur.switching ?? {}
    cur = { ...cur, switching: { ...st, keyers: { ...(st.keyers ?? {}), [id]: { ...(st.keyers?.[id] ?? {}), onAir: on } } } }
    touched = true
  }
  for (const [k, val] of Object.entries(changed)) {
    const p = k.split('.')
    const n = Number(p[1]) + 1
    if (p[0] === 'me' && (p[2] === 'pgm' || p[2] === 'pvw')) route(`me:${n}/${p[2]}`, val)
    else if (p[0] === 'me' && p[2] === 'key') {
      const kk = `me:${n}/key:${Number(p[3]) + 1}`
      if (p[4] === 'on') keyer(kk, val)
      else route(`${kk}/${p[4]}`, val)
    } else if (p[0] === 'dsk') {
      if (p[2] === 'on') keyer(`dsk:${n}`, val)
      else route(`dsk:${n}/${p[2]}`, val)
    } else if (p[0] === 'aux') route(`aux:${n}`, val)
    else if (p[0] === 'ss' && p[4] === 'src') route(`ss:${n}/box:${Number(p[3]) + 1}`, val)
    else if (p[0] === 'ss' && p[4] === 'on' && cur.switching?.atemProfile && typeof val === 'boolean') {
      const ap = cur.switching.atemProfile
      cur = { ...cur, switching: { ...cur.switching, atemProfile: { ...ap, boxes: { ...(ap.boxes ?? {}), [`ss:${n}/box:${Number(p[3]) + 1}`]: val } } } }
      touched = true
    } else if (p[0] === 'in' && cur.switching?.atemProfile && typeof val === 'string') {
      const ap = cur.switching.atemProfile
      const prev = ap.inputs?.[p[1]] ?? { shortName: '', longName: '' }
      const next = p[2] === 'short' ? { ...prev, shortName: val } : { ...prev, longName: val }
      cur = { ...cur, switching: { ...cur.switching, atemProfile: { ...ap, inputs: { ...(ap.inputs ?? {}), [p[1]]: next } } } }
      touched = true
    }
  }
  if (!touched) return {}
  return { switching: cur.switching, plannedCrosspoints: cur.plannedCrosspoints }
}

// ─── Videohub ──────────────────────────────────────────────────────────

export const videohubEmuTopology = (device: EquipmentItem): VideohubEmuTopology => ({
  friendlyName: device.name || 'Videohub',
  inputs: device.inputs.length,
  outputs: device.outputs.length,
})

export const videohubEmuValues = (device: EquipmentItem): EmuValues => {
  const m = routerMatrixOf(device)
  const inIdx = new Map(device.inputs.map((p, i) => [p.id, i]))
  const v: EmuValues = {}
  device.inputs.forEach((p, i) => (v[`in.${i}`] = p.name || `Input ${i + 1}`))
  device.outputs.forEach((p, o) => {
    v[`out.${o}`] = p.name || `Output ${o + 1}`
    const src = m.levels[VIDEO_LEVEL]?.[p.id]
    const i = src ? inIdx.get(src) : undefined
    if (i !== undefined) v[`route.${o}`] = i
    v[`lock.${o}`] = m.locks[p.id] !== undefined
  })
  return v
}

/** Kreuzpunkte vom Pult in den Plan. Beschriftungen bleiben Sache des Plans. */
export const videohubPatchFromEmu = (device: EquipmentItem, changed: EmuValues): Partial<EquipmentItem> => {
  const m = routerMatrixOf(device)
  const video = { ...(m.levels[VIDEO_LEVEL] ?? {}) }
  let touched = false
  for (const [k, val] of Object.entries(changed)) {
    const [kind, idx] = k.split('.')
    if (kind !== 'route' || typeof val !== 'number') continue
    const out = device.outputs[Number(idx)]
    const inp = device.inputs[val]
    if (!out || !inp) continue
    video[out.id] = inp.id
    touched = true
  }
  if (!touched) return {}
  return routerPatch(device, { ...m, levels: { ...m.levels, [VIDEO_LEVEL]: video } })
}
