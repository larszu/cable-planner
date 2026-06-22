// #118 — Schwebende Inline-Selektions-Toolbar.
//
// Erscheint direkt neben der aktuellen Canvas-Auswahl (draw.io-Style) und
// bietet kontextabhängige Schnellaktionen, ohne dass der User in die feste
// obere CanvasToolbar greifen muss. Die globale CanvasToolbar bleibt für
// globale Toggles (Snap, Routing, Layer …) zuständig.
//
// Aktionen je nach Auswahl:
//   - 1 Gerät      → Duplizieren · Rahmen um Auswahl · Löschen
//   - 2+ Geräte    → Ausrichten (6×) + Verteilen (ab 3) · Rahmen · Löschen
//   - 1 Location   → Löschen
// Kabel haben bereits ihr eigenes Rechtsklick-Menü (CableContextMenu).
//
// Per-Setting abschaltbar (uiStore.inlineToolbarEnabled). Im gesperrten /
// Viewer-Plan wird sie nicht angezeigt (keine Edit-Aktionen).

import { useNodes, useViewport, useReactFlow } from 'reactflow'
import {
  AlignHorizontalJustifyStart,
  AlignHorizontalJustifyCenter,
  AlignHorizontalJustifyEnd,
  AlignVerticalJustifyStart,
  AlignVerticalJustifyCenter,
  AlignVerticalJustifyEnd,
  AlignHorizontalDistributeCenter,
  AlignVerticalDistributeCenter,
  Copy,
  SquareDashed,
  Trash2,
} from 'lucide-react'
import { Icon } from '../shared/Icon'
import { useProjectStore } from '../../store/projectStore'
import { useUiStore } from '../../store/uiStore'
import { useTranslation } from '../../lib/i18n'
import { computeEquipmentLayout } from '../../lib/equipmentLayout'
import { computeAlignedPositions, type AlignMode, type AlignItem } from '../../lib/alignEquipment'
import { triggerCanvasDuplicate } from '../../lib/canvasViewport'

export const InlineSelectionToolbar = () => {
  const t = useTranslation()
  const enabled = useUiStore((s) => s.inlineToolbarEnabled)
  const snapToGrid = useUiStore((s) => s.snapToGrid)
  const gridSize = useUiStore((s) => s.gridSize)
  const nodes = useNodes()
  // Re-render bei Pan/Zoom, damit die Toolbar an der Auswahl kleben bleibt.
  useViewport()
  const { flowToScreenPosition, setNodes } = useReactFlow()

  const equipment = useProjectStore((s) => s.project.equipment)
  const greengo = useProjectStore((s) => s.project.greengoConfig)
  const updateEquipment = useProjectStore((s) => s.updateEquipment)
  const deleteSelected = useProjectStore((s) => s.deleteSelected)
  const addLocationAroundEquipment = useProjectStore((s) => s.addLocationAroundEquipment)
  const projectMode = useProjectStore((s) => s.project.mode ?? 'editing')

  // Im gesperrten/Viewer-Plan keine Edit-Schnellaktionen, und nur wenn aktiviert.
  if (!enabled || projectMode !== 'editing') return null

  const selected = nodes.filter((n) => n.selected)
  if (selected.length === 0) return null

  const eqNodes = selected.filter((n) => n.type === 'equipment')
  const locNodes = selected.filter((n) => n.type === 'location')

  // Bounding-Box der Auswahl in Flow-Koordinaten (gemessene Node-Maße).
  const measured = selected.filter((n) => n.width != null && n.height != null)
  if (measured.length === 0) return null
  const minX = Math.min(...measured.map((n) => n.position.x))
  const minY = Math.min(...measured.map((n) => n.position.y))
  const maxX = Math.max(...measured.map((n) => n.position.x + (n.width ?? 0)))
  const maxY = Math.max(...measured.map((n) => n.position.y + (n.height ?? 0)))

  const topCenter = flowToScreenPosition({ x: (minX + maxX) / 2, y: minY })
  const bottomCenter = flowToScreenPosition({ x: (minX + maxX) / 2, y: maxY })
  // Standard oberhalb der Auswahl; wenn dort die obere Toolbar im Weg wäre,
  // unterhalb platzieren.
  const GAP = 46
  const placeAbove = topCenter.y - GAP > 72
  const screenX = topCenter.x
  const screenY = placeAbove ? topCenter.y - GAP : bottomCenter.y + 8

  const ids = eqNodes.map((n) => n.id)
  const snap = (v: number) =>
    snapToGrid && gridSize > 0 ? Math.round(v / gridSize) * gridSize : Math.round(v)

  const doAlign = (mode: AlignMode) => {
    const items: AlignItem[] = equipment
      .filter((e) => ids.includes(e.id))
      .map((item) => {
        const { width, height } = computeEquipmentLayout(item, greengo)
        return { id: item.id, x: item.x, y: item.y, w: width, h: height }
      })
    const moves = computeAlignedPositions(items, mode, { snap, singleSelectionBounds: null })
    if (moves.size === 0) return
    for (const [id, pos] of moves) updateEquipment(id, pos)
    setNodes((rf) => rf.map((n) => (moves.has(n.id) ? { ...n, position: moves.get(n.id)! } : n)))
  }

  const multiEq = eqNodes.length >= 2 && locNodes.length === 0
  const hasEquipment = eqNodes.length >= 1

  const btn =
    'flex h-7 w-7 items-center justify-center rounded text-cp-text-secondary hover:bg-cp-surface-2 hover:text-cp-text'

  const alignButtons: Array<{ mode: AlignMode; icon: typeof Copy; label: string }> = [
    { mode: 'left', icon: AlignHorizontalJustifyStart, label: t('inlineToolbar.alignLeft', 'Links ausrichten') },
    { mode: 'center-h', icon: AlignHorizontalJustifyCenter, label: t('inlineToolbar.alignCenterH', 'Horizontal zentrieren') },
    { mode: 'right', icon: AlignHorizontalJustifyEnd, label: t('inlineToolbar.alignRight', 'Rechts ausrichten') },
    { mode: 'top', icon: AlignVerticalJustifyStart, label: t('inlineToolbar.alignTop', 'Oben ausrichten') },
    { mode: 'center-v', icon: AlignVerticalJustifyCenter, label: t('inlineToolbar.alignCenterV', 'Vertikal zentrieren') },
    { mode: 'bottom', icon: AlignVerticalJustifyEnd, label: t('inlineToolbar.alignBottom', 'Unten ausrichten') },
  ]

  return (
    <div
      className="nodrag nopan fixed z-40 flex items-center gap-0.5 rounded-lg border border-cp-border bg-cp-surface-1/95 p-1 shadow-xl backdrop-blur"
      style={{ left: screenX, top: Math.max(8, screenY), transform: 'translateX(-50%)' }}
      onMouseDown={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
      role="toolbar"
      aria-label={t('inlineToolbar.label', 'Auswahl-Werkzeuge')}
    >
      {multiEq &&
        alignButtons.map(({ mode, icon, label }) => (
          <button key={mode} type="button" className={btn} title={label} aria-label={label} onClick={() => doAlign(mode)}>
            <Icon icon={icon} size="xs" />
          </button>
        ))}
      {multiEq && eqNodes.length >= 3 && (
        <>
          <button
            type="button"
            className={btn}
            title={t('inlineToolbar.distributeH', 'Horizontal verteilen')}
            aria-label={t('inlineToolbar.distributeH', 'Horizontal verteilen')}
            onClick={() => doAlign('distribute-h')}
          >
            <Icon icon={AlignHorizontalDistributeCenter} size="xs" />
          </button>
          <button
            type="button"
            className={btn}
            title={t('inlineToolbar.distributeV', 'Vertikal verteilen')}
            aria-label={t('inlineToolbar.distributeV', 'Vertikal verteilen')}
            onClick={() => doAlign('distribute-v')}
          >
            <Icon icon={AlignVerticalDistributeCenter} size="xs" />
          </button>
        </>
      )}
      {multiEq && <span className="mx-0.5 h-5 w-px bg-cp-border-muted" />}
      {hasEquipment && (
        <>
          <button
            type="button"
            className={btn}
            title={t('inlineToolbar.duplicate', 'Duplizieren')}
            aria-label={t('inlineToolbar.duplicate', 'Duplizieren')}
            onClick={() => triggerCanvasDuplicate()}
          >
            <Icon icon={Copy} size="xs" />
          </button>
          <button
            type="button"
            className={btn}
            title={t('inlineToolbar.frame', 'Rahmen um Auswahl')}
            aria-label={t('inlineToolbar.frame', 'Rahmen um Auswahl')}
            onClick={() => addLocationAroundEquipment(ids)}
          >
            <Icon icon={SquareDashed} size="xs" />
          </button>
        </>
      )}
      <button
        type="button"
        className={`${btn} hover:bg-red-900/40 hover:text-red-300`}
        title={t('inlineToolbar.delete', 'Löschen')}
        aria-label={t('inlineToolbar.delete', 'Löschen')}
        onClick={() => deleteSelected()}
      >
        <Icon icon={Trash2} size="xs" />
      </button>
    </div>
  )
}
