// ───────────────────────────────────────────────────────────────────────────
// Portables Lager-Format — App-übergreifender Austausch (cable/light/multicam).
//
// Ein Lager, das in einem Planer angelegt wurde, soll in den anderen
// importierbar sein. Das Format ist bewusst schlank + versioniert und enthält
// nur die reinen Daten (items/nodes/sets/units) — keine App-Interna. Artikel
// werden per Freitext (manufacturer/model) + Label-`code` identifiziert; ein
// Katalog-GUID-Bezug ist bewusst nicht Teil des Formats.
// ───────────────────────────────────────────────────────────────────────────
import type { InventoryItem, StorageNode, InventorySet, InventoryUnit } from '../types/inventory'

export const INVENTORY_FORMAT = 'avplan-inventory'
export const INVENTORY_FORMAT_VERSION = 1

export interface InventorySnapshot {
  items: InventoryItem[]
  nodes: StorageNode[]
  sets: InventorySet[]
  units: InventoryUnit[]
}

interface PortableFile extends InventorySnapshot {
  format: typeof INVENTORY_FORMAT
  version: number
  /** ISO-Zeitstempel (vom Aufrufer gesetzt — hier keine Uhr). */
  exportedAt?: string
  /** Ursprungs-App (cable/light/multicam), rein informativ. */
  app?: string
}

/** Serialisiert einen Snapshot als portables JSON. */
export const serializeInventory = (snap: InventorySnapshot, meta?: { exportedAt?: string; app?: string }): string => {
  const file: PortableFile = {
    format: INVENTORY_FORMAT,
    version: INVENTORY_FORMAT_VERSION,
    exportedAt: meta?.exportedAt,
    app: meta?.app,
    items: snap.items,
    nodes: snap.nodes,
    sets: snap.sets,
    units: snap.units,
  }
  return JSON.stringify(file, null, 2)
}

const arr = <T>(v: unknown): T[] => (Array.isArray(v) ? (v as T[]) : [])

/**
 * Parst portables JSON zu einem Snapshot. Tolerant gegenüber fehlenden
 * Teil-Arrays, aber strikt beim Format-Marker — fremde/kaputte Dateien → null.
 * Heilung/Validierung der Einzel-Felder übernimmt der Store beim Import
 * (dieselbe Logik wie beim Laden aus localStorage).
 */
export const parseInventory = (json: string): InventorySnapshot | null => {
  let data: unknown
  try {
    data = JSON.parse(json)
  } catch {
    return null
  }
  if (!data || typeof data !== 'object') return null
  const f = data as Partial<PortableFile>
  if (f.format !== INVENTORY_FORMAT) return null
  if (typeof f.version !== 'number' || f.version > INVENTORY_FORMAT_VERSION) return null
  return {
    items: arr<InventoryItem>(f.items),
    nodes: arr<StorageNode>(f.nodes),
    sets: arr<InventorySet>(f.sets),
    units: arr<InventoryUnit>(f.units),
  }
}
