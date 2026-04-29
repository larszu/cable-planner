import type { EquipmentItem } from '../types/equipment'
import { getViewportCenter } from './canvasViewport'
import { useUiStore } from '../store/uiStore'

// Built-in library intentionally empty. Users add their own devices via
// "+ Custom" or import from Rentman.
export const builtInLibrary: Omit<EquipmentItem, 'id' | 'x' | 'y'>[] = []

/** Round a coordinate to the configured grid (or to integer when snap is off). */
export const snapCoordinate = (value: number): number => {
  const { snapToGrid, gridSize } = useUiStore.getState()
  if (snapToGrid && gridSize > 0) {
    return Math.round(value / gridSize) * gridSize
  }
  return Math.round(value)
}

/**
 * Position for a newly placed equipment item added via click (NOT drag-drop).
 *
 * Always lands at the centre of the current canvas viewport so the user
 * sees it immediately and can drag it from there. Existing devices are
 * never moved or rearranged.
 *
 * If several items are added in quick succession we apply a small diagonal
 * offset so they don't stack pixel-perfect on top of each other. We do NOT
 * search the existing layout for free space — that would be unpredictable.
 */
const PROBE_W = 240
const PROBE_H = 140

export const nextPlacementPosition = (
  count: number,
  _existing: { x: number; y: number; width?: number; height?: number }[] = [],
): { x: number; y: number } => {
  const vc = getViewportCenter()
  const cx = vc?.x ?? 400
  const cy = vc?.y ?? 240
  // Small step diagonally for repeat clicks so the next click isn't hidden
  // exactly behind the previous one.
  const step = (count % 8) * 24
  return {
    x: snapCoordinate(cx - PROBE_W / 2 + step),
    y: snapCoordinate(cy - PROBE_H / 2 + step),
  }
}

