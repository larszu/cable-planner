/**
 * Auto-Kabelnummerierung (#-Quick-Win, Community-Anforderung Nr. 1 / WireCAD-
 * Kernfeature). Reine Helfer ohne Store-Zugriff, damit sie isoliert testbar
 * bleiben. Das Schema lebt in `ProjectMetadata.cableNumbering`.
 *
 * Zwei Einstiegspunkte:
 *  - `computeCableNumbers`  — vergibt allen Kabeln deterministisch eine
 *    Nummer ("Alle Kabel neu nummerieren"). Reihenfolge: optional je Layer
 *    gruppiert, dann nach Quell-Geraet + Quell-Port (wie die Patchliste).
 *  - `nextCableNumber`      — naechste freie Nummer fuer EIN neues Kabel,
 *    ohne die bestehenden umzunummerieren (Auto-Vergabe beim Anlegen).
 */

import type { Cable } from '../types/cable'
import type { EquipmentItem } from '../types/equipment'
import type { CableNumberingScheme } from '../types/project'

export const DEFAULT_CABLE_NUMBERING: CableNumberingScheme = {
  enabled: false,
  prefix: 'C',
  perLayer: false,
  separator: '-',
  padding: 3,
  start: 1,
}

/** Top-Level-Layer (vor dem ersten Punkt) auf ein 1-Zeichen-Kuerzel mappen. */
const LAYER_CODE: Record<string, string> = {
  video: 'V',
  audio: 'A',
  control: 'C',
  network: 'N',
  power: 'P',
}

export const layerCode = (layer?: string): string => {
  if (!layer) return 'X'
  const top = layer.split('.')[0].toLowerCase()
  return LAYER_CODE[top] ?? (top.slice(0, 1).toUpperCase() || 'X')
}

/** Erzeugt die formatierte Nummer aus Schema + (optionalem) Layer + Zaehler. */
export const formatCableNumber = (
  scheme: CableNumberingScheme,
  layer: string | undefined,
  n: number,
): string => {
  const num = String(n).padStart(Math.max(1, scheme.padding || 1), '0')
  const sep = scheme.separator ?? '-'
  if (scheme.perLayer) {
    const code = layerCode(layer)
    return scheme.prefix ? `${scheme.prefix}${code}${sep}${num}` : `${code}${sep}${num}`
  }
  return scheme.prefix ? `${scheme.prefix}${sep}${num}` : num
}

/** Beispiel-Nummer fuer die Live-Vorschau in den Einstellungen. */
export const cableNumberExample = (scheme: CableNumberingScheme): string =>
  formatCableNumber(scheme, scheme.perLayer ? 'video' : undefined, scheme.start || 1)

/** Stabiler Sortier-Schluessel: Quell-Geraetename + Index des Quell-Ports.
 *  Spiegelt die Default-Sortierung der Patchliste ("nach Quell-Geraet"). */
const sortKeyFor = (c: Cable, eqById: Map<string, EquipmentItem>) => {
  const eq = eqById.get(c.fromEquipmentId)
  const name = eq?.name ?? '~'
  const ports = eq ? [...eq.outputs, ...eq.inputs] : []
  const idx = ports.findIndex((p) => p.id === c.fromPortId)
  return { name, idx: idx < 0 ? 1e9 : idx }
}

const compareCables =
  (eqById: Map<string, EquipmentItem>) =>
  (a: Cable, b: Cable): number => {
    const ka = sortKeyFor(a, eqById)
    const kb = sortKeyFor(b, eqById)
    return ka.name.localeCompare(kb.name) || ka.idx - kb.idx || a.id.localeCompare(b.id)
  }

/**
 * Vergibt ALLEN Kabeln eine Nummer und liefert eine Map cableId -> Nummer.
 * Deterministisch: gleiche Eingabe -> gleiche Nummern.
 */
export const computeCableNumbers = (
  cables: Cable[],
  equipment: EquipmentItem[],
  scheme: CableNumberingScheme,
): Record<string, string> => {
  const eqById = new Map(equipment.map((e) => [e.id, e]))
  const cmp = compareCables(eqById)
  const result: Record<string, string> = {}

  if (scheme.perLayer) {
    const byLayer = new Map<string, Cable[]>()
    for (const c of cables) {
      const key = (c.layer ?? 'other').split('.')[0].toLowerCase()
      const arr = byLayer.get(key) ?? []
      arr.push(c)
      byLayer.set(key, arr)
    }
    // Layer-Reihenfolge alphabetisch stabilisieren.
    for (const key of [...byLayer.keys()].sort()) {
      const arr = byLayer.get(key)!.slice().sort(cmp)
      let n = scheme.start || 1
      for (const c of arr) {
        result[c.id] = formatCableNumber(scheme, c.layer, n)
        n++
      }
    }
  } else {
    const arr = cables.slice().sort(cmp)
    let n = scheme.start || 1
    for (const c of arr) {
      result[c.id] = formatCableNumber(scheme, c.layer, n)
      n++
    }
  }
  return result
}

/**
 * Naechste freie Nummer fuer ein NEU angelegtes Kabel — ohne die bestehenden
 * umzunummerieren. Nimmt das Maximum der bereits vergebenen laufenden Nummern
 * in der passenden Gruppe (je Layer bei `perLayer`) + 1.
 */
export const nextCableNumber = (
  cables: Cable[],
  scheme: CableNumberingScheme,
  layer: string | undefined,
): string => {
  const wantCode = scheme.perLayer ? layerCode(layer) : null
  let max = (scheme.start || 1) - 1
  for (const c of cables) {
    if (!c.cableNumber) continue
    if (wantCode !== null && layerCode(c.layer) !== wantCode) continue
    const m = c.cableNumber.match(/(\d+)\s*$/)
    if (m) max = Math.max(max, parseInt(m[1], 10))
  }
  return formatCableNumber(scheme, layer, max + 1)
}
