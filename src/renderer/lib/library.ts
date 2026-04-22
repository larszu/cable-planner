import type { EquipmentItem } from '../types/equipment'

// Built-in library intentionally empty. Users add their own devices via
// "+ Custom" or import from Rentman.
export const builtInLibrary: Omit<EquipmentItem, 'id' | 'x' | 'y'>[] = []
