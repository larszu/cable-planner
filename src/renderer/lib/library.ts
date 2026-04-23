import type { EquipmentItem } from '../types/equipment'

// Built-in library intentionally empty. Users add their own devices via
// "+ Custom" or import from Rentman.
export const builtInLibrary: Omit<EquipmentItem, 'id' | 'x' | 'y'>[] = []

/**
 * Calculates the next drop position for a newly placed equipment item,
 * distributing items in a grid pattern (6 per row, 220 px spacing).
 */
export const nextPlacementPosition = (count: number): { x: number; y: number } => ({
  x: 80 + (count % 6) * 220,
  y: 80 + Math.floor(count / 6) * 180,
})
