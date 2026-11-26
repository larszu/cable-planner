// ───────────────────────────────────────────────────────────────────────────
// Signalweg DURCH das Geraet (#1240, Stufe 1).
//
// `signalChain.ts` verfolgt ein Signal von Kabel zu Kabel und behandelt einen
// Mischer als Ziel, ausser ein Kreuzpunkt fuehrt es durch. Hier geht es im
// Inneren weiter: von einer Quelle (Eingang, Mediaplayer, M/E …) ueber die
// internen Kreuzpunkte bis zu einem Ausgang (Programm, Aux) — oder bis zu
// einer benannten Stelle, an der der Weg endet.
//
// Wie dort hat das Ende immer einen Namen (`InnerPathEnd`): „liegt auf der
// Vorschau“ und „Keyer ist nicht auf Sendung“ sehen auf dem Bildschirm
// gleich aus wie „kommt im Programm an“, bedeuten aber das Gegenteil.
//
// Ein Aux auf einen externen Eingang wird ueber `plannedCrosspoints` gelesen
// und ist damit auch fuer `signalChain.ts` ein Weiterweg — EINE Angabe fuer
// beide Wege.
//
// REIN: keine Uhr, kein Store, kein IO.
// ───────────────────────────────────────────────────────────────────────────
import type { EquipmentItem } from '../../types/equipment'
import { allRoutes, type InnerMatrix } from './internalMatrix'
import type { SwitchingState } from './types'

export interface InnerHop {
  /** Quelle des Kreuzpunkts (Block-ID). */
  source: string
  /** Ziel des Kreuzpunkts (Bus-ID), bei `pgm` der Block selbst. */
  dest: string
  /** Block, dem das Ziel gehoert. */
  block: string
}

export type InnerPathEnd =
  /** Kommt an einem Ausgang an (Programm, Aux). */
  | 'output'
  /** Liegt nur auf einer Vorschau. */
  | 'preview'
  /** Liegt an einem Keyer, der nicht auf Sendung ist. */
  | 'off-air'
  /** Die Quelle ist nirgends geschaltet. */
  | 'unused'
  /** Der Weg lief in sich zurueck. */
  | 'loop'

export interface InnerPath {
  hops: InnerHop[]
  end: InnerPathEnd
  /** Ausgangs-Block (`pgm`, `aux:n`), wo `end === 'output'`. */
  outputId?: string
  /** Physischer Ausgang am Geraet, wo es einen gibt. */
  portId?: string
}

const MAX_PATHS = 200

export const innerPathsFrom = (
  device: EquipmentItem,
  matrix: InnerMatrix,
  state: SwitchingState | undefined,
  fromId: string,
): InnerPath[] => {
  const routes = allRoutes(device, matrix, state)
  const consumers = new Map<string, string[]>()
  for (const [dest, src] of routes) {
    const list = consumers.get(src)
    if (list) list.push(dest)
    else consumers.set(src, [dest])
  }
  const onAir = (id: string) => state?.keyers?.[id]?.onAir === true
  const out: InnerPath[] = []

  const walk = (current: string, hops: InnerHop[], seen: Set<string>) => {
    if (out.length >= MAX_PATHS) return
    const block = matrix.byId.get(current)
    const next: InnerHop[] = (consumers.get(current) ?? []).map((dest) => ({
      source: current,
      dest,
      block: matrix.destOwner.get(dest)?.id ?? dest,
    }))
    // M/E 1 ist das Programm: es geht ohne eigenen Kreuzpunkt auf PGM.
    if (block?.kind === 'mixEffect' && block.index === 1 && matrix.byId.has('pgm')) {
      next.push({ source: current, dest: 'pgm', block: 'pgm' })
    }
    if (next.length === 0) {
      out.push({ hops, end: 'unused' })
      return
    }
    for (const hop of next) {
      const path = [...hops, hop]
      const owner = matrix.byId.get(hop.block)
      const dest = owner?.dests.find((d) => d.id === hop.dest)
      if (!owner) continue
      if (owner.kind === 'program') {
        out.push({ hops: path, end: 'output', outputId: 'pgm', ...(owner.portId ? { portId: owner.portId } : {}) })
      } else if (owner.kind === 'aux') {
        out.push({ hops: path, end: 'output', outputId: owner.id, ...(owner.portId ? { portId: owner.portId } : {}) })
      } else if (owner.kind === 'downstreamKeyer') {
        if (onAir(owner.id)) out.push({ hops: [...path, { source: owner.id, dest: 'pgm', block: 'pgm' }], end: 'output', outputId: 'pgm' })
        else out.push({ hops: path, end: 'off-air' })
      } else if (owner.kind === 'upstreamKeyer') {
        if (!onAir(owner.id) || !owner.parent) out.push({ hops: path, end: 'off-air' })
        else if (seen.has(owner.parent)) out.push({ hops: path, end: 'loop' })
        else walk(owner.parent, path, new Set([...seen, owner.parent]))
      } else if (dest?.role === 'preview') {
        out.push({ hops: path, end: 'preview' })
      } else if (owner.source) {
        if (seen.has(owner.id)) out.push({ hops: path, end: 'loop' })
        else walk(owner.id, path, new Set([...seen, owner.id]))
      }
    }
  }

  walk(fromId, [], new Set([fromId]))
  return out
}

/** Alle Wege, die an diesem Ausgang ankommen — von jeder Quelle aus. */
export const innerPathsInto = (
  device: EquipmentItem,
  matrix: InnerMatrix,
  state: SwitchingState | undefined,
  outputId: string,
): InnerPath[] =>
  matrix.blocks
    .filter((b) => b.source)
    .flatMap((b) => innerPathsFrom(device, matrix, state, b.id))
    .filter((p) => p.end === 'output' && p.outputId === outputId)

/** Die Bloecke eines Weges in Reihenfolge, ohne Doppelte. */
export const pathBlocks = (path: InnerPath): string[] => {
  const ids: string[] = []
  for (const h of path.hops) {
    if (!ids.includes(h.source)) ids.push(h.source)
    if (!ids.includes(h.block)) ids.push(h.block)
  }
  return ids
}
