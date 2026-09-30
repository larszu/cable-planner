import type { EquipmentItem } from '../types/equipment'

/**
 * #306 — sieht das Geraet wie ein Display aus? Nach Kategorie, Name oder
 * schon eingetragener Aufloesung/Diagonale. Eine Stelle fuer den
 * Display-Block und das Testbild am Display (larszu/lz-scopes#15).
 */
export const siehtAusWieDisplay = (
  e: Pick<EquipmentItem, 'category' | 'name' | 'resolution' | 'displaySizeInch'>,
): boolean =>
  /monitor|display|screen|tv|oled|lcd|led|multiviewer|projector|beamer/.test(e.category.toLowerCase()) ||
  /monitor|display|screen|tv|oled|lcd|led\b|projector|beamer/.test(e.name.toLowerCase()) ||
  e.resolution !== undefined ||
  e.displaySizeInch !== undefined
