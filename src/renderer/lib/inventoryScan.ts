// ───────────────────────────────────────────────────────────────────────────
// Lager-Scan-Auflösung — Code (QR/Barcode) → Artikel, Lager-Knoten oder Einheit.
//
// Anders als `qrPayload.ts` (projektgebundene Kabel/Geräte) löst dies gegen den
// projektübergreifenden Lager-Bestand auf: gescannter Code wird gegen die festen
// Codes von Artikeln, Lagerplätzen/Cases und serialisierten Einheiten (auch
// Seriennummer) gematcht. Tolerant, aber ohne Raten — leerer Code → null.
// ───────────────────────────────────────────────────────────────────────────
import type { InventoryItem, StorageNode, InventoryUnit } from '../types/inventory'

export type InventoryScanMatch =
  | { kind: 'item'; item: InventoryItem }
  | { kind: 'node'; node: StorageNode }
  | { kind: 'unit'; unit: InventoryUnit }

const norm = (s: string | undefined): string => (s ?? '').trim().toLowerCase()

export interface ScanSources {
  items: InventoryItem[]
  nodes: StorageNode[]
  units: InventoryUnit[]
}

/**
 * Löst einen gescannten/eingegebenen Code auf. Reihenfolge: Einheit (Code oder
 * Seriennr.) → Lager-Knoten (Code) → Artikel (Code). Einheiten zuerst, weil ihr
 * Code am spezifischsten ist. Liefert den ersten Treffer oder null.
 */
export const resolveInventoryCode = (
  raw: string,
  { items, nodes, units }: ScanSources,
): InventoryScanMatch | null => {
  const needle = norm(raw)
  if (!needle) return null

  const unit = units.find((u) => norm(u.code) === needle || norm(u.serial) === needle)
  if (unit) return { kind: 'unit', unit }

  const node = nodes.find((n) => norm(n.code) === needle)
  if (node) return { kind: 'node', node }

  const item = items.find((it) => norm(it.code) === needle)
  if (item) return { kind: 'item', item }

  return null
}
