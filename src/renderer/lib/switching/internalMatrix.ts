// ───────────────────────────────────────────────────────────────────────────
// Die interne Matrix eines Mischers (#1240, Stufe 1).
//
// Aus Profil (wie viele Bausteine) und Geraet (welche Anschluesse) entsteht
// eine Liste von BLOECKEN. Ein Block ist Quelle (er gibt ein Bild ab: Eingang,
// M/E, SuperSource, Mediaplayer, Farbgenerator), hat Ziele (seine Busse:
// Programm-Bus einer M/E, Box einer SuperSource, Fill eines Keyers, Aux) —
// oder beides. Ein Kreuzpunkt verbindet eine Quelle mit einem Ziel.
//
// Quellen-IDs folgen dem offen dokumentierten ATEM-Profil-XML (Eingang n = n,
// Schwarz 0, Bars 1000, Farbe 2000+n, Mediaplayer 3000+10n, SuperSource
// 6000+n, Aux 8000+n, M/E-Programm 10000+10n) — dieselben Zahlen, die
// `atemPortSources.ts` fuer Aux und PGM schon ableitet.
//
// REIN: keine Uhr, kein Store, kein IO.
// ───────────────────────────────────────────────────────────────────────────
import type { EquipmentItem } from '../../types/equipment'
import { inputSourceId } from '../atemPortSources'
import { deviceCrosspoints } from '../deviceCrosspoints'
import type { SwitchingBlockCounts, SwitchingProfile, SwitchingState } from './types'

export type InnerBlockKind =
  | 'input'
  | 'black'
  | 'bars'
  | 'color'
  | 'mediaPlayer'
  | 'mixEffect'
  | 'upstreamKeyer'
  | 'downstreamKeyer'
  | 'superSource'
  | 'program'
  | 'aux'
  | 'multiviewer'

/** Ein Bus am Block, auf den eine Quelle geschaltet wird. */
export interface InnerDest {
  /** z. B. `me:1/pgm`, `ss:1/box:2`, `me:1/key:1/fill`, `aux:3`. */
  id: string
  role: 'program' | 'preview' | 'box' | 'artFill' | 'artKey' | 'fill' | 'key' | 'aux' | 'still'
  index?: number
}

export interface InnerBlock {
  /** z. B. `in:3`, `me:2`, `ss:1`, `mp:1`, `me:1/key:1`, `aux:4`, `pgm`. */
  id: string
  kind: InnerBlockKind
  /** 1-basiert, wo der Block gezaehlt wird. */
  index: number
  /** Gibt der Block ein Bild in die interne Matrix ab? */
  source: boolean
  /** ATEM-Quellen-ID, wo der Block eine Quelle ist. */
  sourceId?: number
  dests: InnerDest[]
  /** Spalte der Innenansicht: Eingaenge links, Ausgaenge rechts. */
  column: 'in' | 'mid' | 'out'
  /** Keyer: die M/E, zu der er gehoert. */
  parent?: string
  /** Physischer Anschluss am Geraet (Eingang bzw. Ausgang). */
  portId?: string
  /** Name des Anschlusses, wo es einen gibt. */
  portName?: string
}

export interface InnerMatrix {
  blocks: InnerBlock[]
  byId: ReadonlyMap<string, InnerBlock>
  /** Ziel-ID -> Block, dem das Ziel gehoert. */
  destOwner: ReadonlyMap<string, InnerBlock>
}

const COUNT_KEYS: readonly (keyof SwitchingBlockCounts)[] = [
  'inputs',
  'mixEffects',
  'upstreamKeyers',
  'upstreamKeyersPerMe',
  'downstreamKeyers',
  'superSources',
  'superSourceBoxes',
  'mediaPlayers',
  'stills',
  'clips',
  'colorGenerators',
  'aux',
  'multiviewers',
  'dves',
  'macros',
]

/** Profilwert, sonst der vom Planer ergaenzte Wert. Ein belegter Profilwert gewinnt. */
export const effectiveCounts = (
  profile: SwitchingProfile | null | undefined,
  state: SwitchingState | undefined,
): SwitchingBlockCounts => {
  const out: SwitchingBlockCounts = {}
  for (const k of COUNT_KEYS) {
    const v = profile?.blocks[k] ?? state?.blocks?.[k]
    if (typeof v === 'number' && Number.isFinite(v) && v >= 0) out[k] = Math.floor(v)
  }
  return out
}

const range = (n: number | undefined): number[] => Array.from({ length: Math.max(0, n ?? 0) }, (_, i) => i + 1)

/** Ausgang „SDI Out n“ bzw. „Multiview … n“ am Geraet. */
const outputPortByNumber = (device: EquipmentItem, pattern: RegExp, n: number) =>
  device.outputs.find((p) => {
    const m = pattern.exec(p.name ?? '')
    return m ? Number(m[1]) === n : false
  })

export const buildInnerMatrix = (
  device: EquipmentItem,
  profile: SwitchingProfile | null | undefined,
  state: SwitchingState | undefined,
): InnerMatrix => {
  const c = effectiveCounts(profile, state)
  const blocks: InnerBlock[] = []

  // Eingaenge: die ersten n Videoeingaenge des Geraets, mit ihrer ATEM-ID
  // (ein gesetztes `atemSourceId` gewinnt, sonst die Position).
  const inputCount = c.inputs ?? 0
  device.inputs.forEach((p, idx) => {
    const id = inputSourceId(p, idx)
    if (id < 1 || id > inputCount || blocks.some((b) => b.id === `in:${id}`)) return
    blocks.push({
      id: `in:${id}`,
      kind: 'input',
      index: id,
      source: true,
      sourceId: id,
      dests: [],
      column: 'in',
      portId: p.id,
      portName: p.name,
    })
  })
  blocks.sort((a, b) => a.index - b.index)

  if (profile?.role !== 'router') {
    blocks.push({ id: 'black', kind: 'black', index: 1, source: true, sourceId: 0, dests: [], column: 'in' })
    blocks.push({ id: 'bars', kind: 'bars', index: 1, source: true, sourceId: 1000, dests: [], column: 'in' })
  }
  for (const i of range(c.colorGenerators)) {
    blocks.push({ id: `color:${i}`, kind: 'color', index: i, source: true, sourceId: 2000 + i, dests: [], column: 'in' })
  }
  for (const i of range(c.mediaPlayers)) {
    blocks.push({
      id: `mp:${i}`,
      kind: 'mediaPlayer',
      index: i,
      source: true,
      sourceId: 3000 + 10 * i,
      dests: [{ id: `mp:${i}/still`, role: 'still' }],
      column: 'in',
    })
  }
  for (const i of range(c.superSources)) {
    const boxes = range(c.superSourceBoxes).map((b) => ({ id: `ss:${i}/box:${b}`, role: 'box' as const, index: b }))
    blocks.push({
      id: `ss:${i}`,
      kind: 'superSource',
      index: i,
      source: true,
      sourceId: 6000 + i,
      dests: [...boxes, { id: `ss:${i}/art-fill`, role: 'artFill' }, { id: `ss:${i}/art-key`, role: 'artKey' }],
      column: 'mid',
    })
  }
  const perMe = c.upstreamKeyersPerMe ?? 0
  for (const i of range(c.mixEffects)) {
    blocks.push({
      id: `me:${i}`,
      kind: 'mixEffect',
      index: i,
      source: true,
      sourceId: 10000 + 10 * i,
      dests: [
        { id: `me:${i}/pgm`, role: 'program' },
        { id: `me:${i}/pvw`, role: 'preview' },
      ],
      column: 'mid',
    })
    for (const k of range(perMe)) {
      blocks.push({
        id: `me:${i}/key:${k}`,
        kind: 'upstreamKeyer',
        index: k,
        source: false,
        dests: [
          { id: `me:${i}/key:${k}/fill`, role: 'fill' },
          { id: `me:${i}/key:${k}/key`, role: 'key' },
        ],
        column: 'mid',
        parent: `me:${i}`,
      })
    }
  }
  for (const i of range(c.downstreamKeyers)) {
    blocks.push({
      id: `dsk:${i}`,
      kind: 'downstreamKeyer',
      index: i,
      source: false,
      dests: [
        { id: `dsk:${i}/fill`, role: 'fill' },
        { id: `dsk:${i}/key`, role: 'key' },
      ],
      column: 'mid',
    })
  }
  if ((c.mixEffects ?? 0) > 0) {
    blocks.push({ id: 'pgm', kind: 'program', index: 1, source: false, dests: [], column: 'out' })
  }
  for (const i of range(c.aux)) {
    const port = outputPortByNumber(device, /\bSDI\s*Out\s*0*(\d+)\b/i, i)
    blocks.push({
      id: `aux:${i}`,
      kind: 'aux',
      index: i,
      source: false,
      dests: [{ id: `aux:${i}`, role: 'aux', index: i }],
      column: 'out',
      ...(port ? { portId: port.id, portName: port.name } : {}),
    })
  }
  for (const i of range(c.multiviewers)) {
    const port = outputPortByNumber(device, /\bMulti\s*-?view\w*\s*(?:Out\w*\s*)?(?:HDMI\s*)?0*(\d+)\b/i, i)
    blocks.push({
      id: `mv:${i}`,
      kind: 'multiviewer',
      index: i,
      source: false,
      dests: [],
      column: 'out',
      ...(port ? { portId: port.id, portName: port.name } : {}),
    })
  }

  const byId = new Map(blocks.map((b) => [b.id, b]))
  const destOwner = new Map<string, InnerBlock>()
  for (const b of blocks) for (const d of b.dests) destOwner.set(d.id, b)
  return { blocks, byId, destOwner }
}

/**
 * Welche Quelle liegt auf diesem Ziel?
 *
 * Ein Aux auf einen EXTERNEN Eingang steht in `plannedCrosspoints` am Geraet
 * (dort liest ihn der Signalweg des Plans), alles andere in `routes`.
 */
export const routeOf = (
  device: EquipmentItem,
  matrix: InnerMatrix,
  state: SwitchingState | undefined,
  destId: string,
): string | undefined => {
  const owner = matrix.destOwner.get(destId)
  if (owner?.kind === 'aux' && owner.portId) {
    const inPort = deviceCrosspoints(device).get(owner.portId)
    if (inPort) {
      const input = matrix.blocks.find((b) => b.kind === 'input' && b.portId === inPort)
      if (input) return input.id
    }
  }
  return state?.routes?.[destId]
}

/** Alle gesetzten internen Kreuzpunkte, `ziel -> quelle`. */
export const allRoutes = (
  device: EquipmentItem,
  matrix: InnerMatrix,
  state: SwitchingState | undefined,
): Map<string, string> => {
  const out = new Map<string, string>()
  for (const b of matrix.blocks) {
    for (const d of b.dests) {
      const src = routeOf(device, matrix, state, d.id)
      if (src) out.set(d.id, src)
    }
  }
  return out
}

/**
 * Den Patch fuer einen neuen Kreuzpunkt bilden (`source` leer = loesen).
 *
 * Ein Aux auf einen externen Eingang geht nach `plannedCrosspoints`, jede
 * andere Quelle nach `routes` — und der jeweils andere Ort wird geleert,
 * damit nie zwei Angaben fuer denselben Bus stehen.
 */
export const routePatch = (
  device: EquipmentItem,
  matrix: InnerMatrix,
  destId: string,
  source: string | undefined,
): Pick<EquipmentItem, 'switching' | 'plannedCrosspoints'> => {
  const state = device.switching ?? {}
  const routes = { ...(state.routes ?? {}) }
  let planned = device.plannedCrosspoints ? { ...device.plannedCrosspoints } : undefined
  const owner = matrix.destOwner.get(destId)
  const src = source ? matrix.byId.get(source) : undefined
  delete routes[destId]
  if (owner?.kind === 'aux' && owner.portId) {
    if (planned) delete planned[owner.portId]
    if (src?.kind === 'input' && src.portId) {
      planned = { ...(planned ?? {}), [owner.portId]: src.portId }
    } else if (source) {
      routes[destId] = source
    }
  } else if (source) {
    routes[destId] = source
  }
  if (planned && Object.keys(planned).length === 0) planned = undefined
  return {
    switching: { ...state, routes },
    plannedCrosspoints: planned,
  }
}
