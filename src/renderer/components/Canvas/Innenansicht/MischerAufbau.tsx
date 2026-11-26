// #1240 Stufe 2 — Innenansicht „Aufbau“ eines Mischers.
//
// Bausteine sind Knoten, interne Kreuzpunkte Kanten: Eingaenge links,
// SuperSource, Keyer und M/E in der Mitte, PGM, Aux und Multiviewer rechts.
// Eine Kante ziehen setzt den Kreuzpunkt, Entf loest ihn. Ein Klick auf
// einen Baustein hebt seinen Weg durch das Geraet hervor (`innerPath.ts`).
import { memo, useCallback, useMemo, useState, type KeyboardEvent as ReactKeyboardEvent } from 'react'
import ReactFlow, {
  Background,
  BackgroundVariant,
  Handle,
  Position,
  ReactFlowProvider,
  type Connection,
  type Edge,
  type Node,
  type NodeProps,
} from 'reactflow'
import { useProjectStore } from '../../../store/projectStore'
import { format, useTranslation } from '../../../lib/i18n'
import {
  allRoutes,
  buildInnerMatrix,
  innerPathsFrom,
  innerPathsInto,
  routePatch,
  setKeyer,
  type InnerBlock,
  type SwitchingProfile,
} from '../../../lib/switching'
import type { EquipmentItem } from '../../../types/equipment'
import { MischerSeitenleiste } from './MischerSeitenleiste'
import { blockLabel, destLabel } from './labels'

interface BlockData {
  block: InnerBlock
  label: string
  sub?: string
  dests: { id: string; label: string; value?: string }[]
  highlight: boolean
  dim: boolean
  onAir?: boolean
  onToggleAir?: () => void
  airLabel: string
}

const ROW = 20
const HEAD = 26

const BlockNode = memo(({ data, selected }: NodeProps<BlockData>) => {
  const { block } = data
  return (
    <div
      className={`min-w-[150px] rounded-cp-control border bg-cp-surface-2 text-cp-xs shadow-cp-1 ${
        data.highlight ? 'border-cp-accent' : selected ? 'border-cp-border-strong' : 'border-cp-border'
      } ${data.dim ? 'opacity-50' : ''}`}
      data-block={block.id}
    >
      <div className="flex items-center justify-between gap-2 px-2" style={{ height: HEAD }}>
        <span className="truncate font-medium text-cp-text">{data.label}</span>
        {data.onToggleAir && (
          <label className="flex items-center gap-1 text-cp-text-muted nodrag">
            <input type="checkbox" checked={!!data.onAir} onChange={data.onToggleAir} aria-label={data.airLabel} />
            {data.airLabel}
          </label>
        )}
      </div>
      {data.sub && <div className="-mt-1 px-2 pb-1 text-cp-text-faint">{data.sub}</div>}
      {data.dests.map((d) => (
        <div
          key={d.id}
          className="relative flex items-center gap-1 px-2 text-cp-text-secondary"
          style={{ height: ROW }}
        >
          <Handle
            type="target"
            position={Position.Left}
            id={d.id}
            style={{ top: ROW / 2, width: 8, height: 8, left: -4 }}
          />
          <span>{d.label}</span>
          {d.value && <span className="ml-auto truncate text-cp-text-muted">{d.value}</span>}
        </div>
      ))}
      {block.source && (
        <Handle
          type="source"
          position={Position.Right}
          id="out"
          style={{ top: HEAD / 2, width: 8, height: 8, right: -4 }}
        />
      )}
      {(block.kind === 'program' || block.kind === 'multiviewer' || block.kind === 'mixEffect') && (
        <Handle
          type="target"
          position={Position.Left}
          id="in"
          style={{ top: HEAD / 2, width: 8, height: 8, left: -4 }}
          isConnectable={false}
        />
      )}
      {(block.kind === 'upstreamKeyer' || block.kind === 'downstreamKeyer') && (
        <Handle
          type="source"
          position={Position.Right}
          id="out"
          style={{ top: HEAD / 2, width: 8, height: 8, right: -4 }}
          isConnectable={false}
        />
      )}
    </div>
  )
})
BlockNode.displayName = 'BlockNode'

const NODE_TYPES = { block: BlockNode }

/** Spalten wie im Konzept: Eingaenge links, Ausgaenge rechts. */
const COL_X: Record<InnerBlock['kind'], number> = {
  input: 0,
  black: 0,
  bars: 0,
  color: 0,
  mediaPlayer: 0,
  superSource: 300,
  upstreamKeyer: 560,
  mixEffect: 800,
  downstreamKeyer: 1040,
  program: 1300,
  aux: 1300,
  multiviewer: 1300,
}

const heightOf = (b: InnerBlock, hasSub: boolean) => HEAD + (hasSub ? 14 : 0) + b.dests.length * ROW + 4

const Flaeche = ({ device, profile }: { device: EquipmentItem; profile: SwitchingProfile | null }) => {
  const t = useTranslation()
  const updateEquipment = useProjectStore((s) => s.updateEquipment)
  const anhaenge = useProjectStore((s) => s.project.anhaenge)
  const [auswahl, setAuswahl] = useState<string | null>(null)
  const [kante, setKante] = useState<string | null>(null)
  const state = device.switching
  const matrix = useMemo(() => buildInnerMatrix(device, profile, state), [device, profile, state])
  const routes = useMemo(() => allRoutes(device, matrix, state), [device, matrix, state])

  const highlighted = useMemo(() => {
    const hops = new Set<string>()
    const blocks = new Set<string>()
    if (!auswahl) return { hops, blocks }
    const b = matrix.byId.get(auswahl)
    const paths =
      b?.kind === 'program' || b?.kind === 'aux'
        ? innerPathsInto(device, matrix, state, auswahl)
        : innerPathsFrom(device, matrix, state, auswahl)
    for (const p of paths) {
      if (p.end !== 'output' && b?.kind !== 'program' && b?.kind !== 'aux') continue
      for (const h of p.hops) {
        hops.add(`${h.source}>${h.dest}`)
        blocks.add(h.source)
        blocks.add(h.block)
      }
    }
    blocks.add(auswahl)
    return { hops, blocks }
  }, [auswahl, device, matrix, state])

  const setRoute = useCallback(
    (dest: string, source: string | undefined) => updateEquipment(device.id, routePatch(device, matrix, dest, source)),
    [device, matrix, updateEquipment],
  )

  const nodes = useMemo<Node<BlockData>[]>(() => {
    const y: Partial<Record<number, number>> = {}
    const stillName = (slot: string | undefined) => {
      if (!slot) return undefined
      const a = anhaenge?.find((x) => x.id === state?.media?.[slot]?.anhangId)
      return a
        ? a.titel || a.datei.fileName
        : format(t('switching.media.slotEmpty', 'Still {n} (empty)'), {
            n: slot.split(':')[1],
          })
    }
    const out: Node<BlockData>[] = []
    for (const b of matrix.blocks) {
      const x = COL_X[b.kind]
      const sub =
        b.kind === 'aux' || b.kind === 'multiviewer'
          ? b.portName
          : b.kind !== 'input' && b.sourceId !== undefined
            ? `#${b.sourceId}`
            : undefined
      const keyer = b.kind === 'upstreamKeyer' || b.kind === 'downstreamKeyer'
      // Keyer stehen neben ihrer M/E: beide Spalten beginnen auf derselben Zeile.
      const kx = COL_X.upstreamKeyer
      if (b.kind === 'mixEffect') y[x] = y[kx] = Math.max(y[kx] ?? 0, y[x] ?? 0)
      const top = y[x] ?? 0
      y[x] = top + heightOf(b, !!sub) + (b.kind === 'input' ? 6 : 14)
      out.push({
        id: b.id,
        type: 'block',
        position: { x, y: top },
        data: {
          block: b,
          label: blockLabel(b, t),
          sub,
          dests: b.dests.map((d) => {
            const src = d.role === 'still' ? state?.routes?.[d.id] : routes.get(d.id)
            const srcBlock = src ? matrix.byId.get(src) : undefined
            return {
              id: d.id,
              label: destLabel(d, t),
              value: d.role === 'still' ? stillName(src) : srcBlock ? blockLabel(srcBlock, t) : undefined,
            }
          }),
          highlight: highlighted.blocks.has(b.id),
          dim: !!auswahl && !highlighted.blocks.has(b.id),
          airLabel: t('switching.keyer.onAir', 'On air'),
          ...(keyer
            ? {
                onAir: state?.keyers?.[b.id]?.onAir === true,
                onToggleAir: () =>
                  updateEquipment(device.id, {
                    switching: setKeyer(state, b.id, {
                      onAir: !(state?.keyers?.[b.id]?.onAir === true),
                    }),
                  }),
              }
            : {}),
        },
      })
    }
    return out
  }, [matrix, routes, state, t, highlighted, auswahl, anhaenge, device.id, updateEquipment])

  const edges = useMemo<Edge[]>(() => {
    const out: Edge[] = []
    const on = (k: string) => highlighted.hops.has(k)
    for (const [dest, src] of routes) {
      const owner = matrix.destOwner.get(dest)
      if (!owner || !matrix.byId.get(src)?.source) continue
      const k = `${src}>${dest}`
      out.push({
        id: `r:${dest}`,
        source: src,
        sourceHandle: 'out',
        target: owner.id,
        targetHandle: dest,
        animated: on(k),
        selected: kante === `r:${dest}`,
        style: {
          stroke: on(k) ? 'var(--cp-accent)' : 'var(--cp-text-muted)',
          strokeWidth: on(k) ? 2.5 : 1.5,
        },
      })
    }
    // Feste Wege im Geraet: Keyer auf ihre M/E, DSK und M/E 1 auf PGM.
    const fest = (source: string, target: string, aktiv: boolean, hop: string) =>
      out.push({
        id: `f:${source}`,
        source,
        sourceHandle: 'out',
        target,
        targetHandle: 'in',
        deletable: false,
        animated: on(hop),
        style: {
          stroke: on(hop) ? 'var(--cp-accent)' : 'var(--cp-border-strong)',
          strokeDasharray: aktiv ? undefined : '4 4',
          strokeWidth: on(hop) ? 2.5 : 1,
        },
      })
    for (const b of matrix.blocks) {
      if (b.kind === 'upstreamKeyer' && b.parent) {
        const aktiv = state?.keyers?.[b.id]?.onAir === true
        if (aktiv) fest(b.id, b.parent, true, `${b.id}>${b.parent}`)
      }
      if (b.kind === 'downstreamKeyer' && state?.keyers?.[b.id]?.onAir) fest(b.id, 'pgm', true, `${b.id}>pgm`)
    }
    if (matrix.byId.has('pgm') && matrix.byId.has('me:1')) fest('me:1', 'pgm', true, 'me:1>pgm')
    // Ein Keyer-Weg ist hervorgehoben, wenn sein Fill es ist.
    return out.map((e) =>
      e.id.startsWith('f:') &&
      e.target.startsWith('me:') &&
      highlighted.blocks.has(e.source) &&
      highlighted.blocks.has(e.target)
        ? {
            ...e,
            animated: true,
            style: { ...e.style, stroke: 'var(--cp-accent)', strokeWidth: 2.5 },
          }
        : e,
    )
  }, [routes, matrix, state, highlighted, kante])

  const onConnect = useCallback(
    (c: Connection) => {
      if (!c.source || !c.targetHandle) return
      const src = matrix.byId.get(c.source)
      const owner = matrix.destOwner.get(c.targetHandle)
      if (!src?.source || !owner) return
      if (owner.dests.find((d) => d.id === c.targetHandle)?.role === 'still') return
      setRoute(c.targetHandle, c.source)
    },
    [matrix, setRoute],
  )

  const onKeyDown = (e: ReactKeyboardEvent) => {
    if ((e.key === 'Delete' || e.key === 'Backspace') && kante?.startsWith('r:')) {
      e.preventDefault()
      e.stopPropagation()
      setRoute(kante.slice(2), undefined)
      setKante(null)
    }
  }

  return (
    <div className="flex h-full" onKeyDown={onKeyDown} tabIndex={-1}>
      <div className="relative min-w-0 flex-1">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          nodeTypes={NODE_TYPES}
          onConnect={onConnect}
          onNodeClick={(_e, n) => setAuswahl((a) => (a === n.id ? null : n.id))}
          onEdgeClick={(_e, ed) => setKante(ed.id.startsWith('r:') ? ed.id : null)}
          onPaneClick={() => {
            setAuswahl(null)
            setKante(null)
          }}
          deleteKeyCode={null}
          nodesDraggable={false}
          fitView
          fitViewOptions={{ padding: 0.04 }}
          minZoom={0.2}
          proOptions={{ hideAttribution: true }}
        >
          <Background variant={BackgroundVariant.Dots} gap={20} size={1} />
        </ReactFlow>
        {kante?.startsWith('r:') && (
          <div className="absolute bottom-3 left-3 flex items-center gap-2 rounded-cp-card border border-cp-border bg-cp-surface-raised px-3 py-1.5 text-cp-xs shadow-cp-2">
            <span>{t('switching.route.selected', 'Route selected')}</span>
            <button
              type="button"
              className="rounded-cp-s px-2 py-0.5 text-cp-danger hover:bg-cp-surface-3"
              onClick={() => {
                setRoute(kante.slice(2), undefined)
                setKante(null)
              }}
            >
              {t('switching.route.remove', 'Remove route')}
            </button>
          </div>
        )}
      </div>
      <MischerSeitenleiste device={device} profile={profile} matrix={matrix} auswahl={auswahl} />
    </div>
  )
}

export const MischerAufbau = (props: { device: EquipmentItem; profile: SwitchingProfile | null }) => (
  <ReactFlowProvider>
    <Flaeche {...props} />
  </ReactFlowProvider>
)
