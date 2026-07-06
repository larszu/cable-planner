// ───────────────────────────────────────────────────────────────────────────
// Inventory-Reporting — reine Kennzahlen über den Bestand.
//
// Adressiert die häufigste Kundenkritik an Rentman/easyjob („Reporting zu
// flach"): kompakte, sofort ablesbare Summen — nach Kategorie, Eigentum,
// Material-Art, Lagerort und Zustand der Einheiten. Rein abgeleitet, kein
// Raten (fehlende Angaben zählen als „unbekannt", nicht geschätzt).
// ───────────────────────────────────────────────────────────────────────────
import type { InventoryItem, StorageNode, InventoryUnit } from '../types/inventory'
import { rootLocation } from './storageTree'

export interface CountValue {
  key: string
  /** Anzahl Artikel-Positionen. */
  items: number
  /** Summe der Stückzahlen. */
  units: number
}

export interface InventoryReport {
  /** Anzahl Artikel-Positionen (Modelle). */
  itemCount: number
  /** Summe aller Bulk-Stückzahlen. */
  totalUnits: number
  /** Anzahl serialisierter Einheiten. */
  serializedCount: number
  /** Tagesmiet-Volumen = Σ rentPricePerDay × quantity (nur wo Preis bekannt). */
  dailyRentalValue: number
  /** Anzahl Artikel ohne hinterlegten Mietpreis (Wert unvollständig). */
  itemsWithoutPrice: number
  /** Aufschlüsselung nach Kategorie. */
  byCategory: CountValue[]
  /** Aufschlüsselung nach Eigentum (owned/rented/subhire/unbekannt). */
  byOwnership: CountValue[]
  /** Aufschlüsselung nach Material-Art (rental/consumable/unklassifiziert). */
  byMaterial: CountValue[]
  /** Stückzahlen je physischem Wurzel-Lagerort (Depot etc.) + „ohne Lagerort". */
  byLocation: CountValue[]
  /** Einheiten je Zustand (ok/defect/inRepair/retired). */
  unitsByCondition: CountValue[]
}

const bump = (map: Map<string, CountValue>, key: string, units: number) => {
  const cur = map.get(key) ?? { key, items: 0, units: 0 }
  cur.items += 1
  cur.units += units
  map.set(key, cur)
}

const sortDesc = (m: Map<string, CountValue>): CountValue[] =>
  [...m.values()].sort((a, b) => b.units - a.units || a.key.localeCompare(b.key))

export const buildInventoryReport = (
  items: InventoryItem[],
  nodes: StorageNode[],
  units: InventoryUnit[],
): InventoryReport => {
  const byCategory = new Map<string, CountValue>()
  const byOwnership = new Map<string, CountValue>()
  const byMaterial = new Map<string, CountValue>()
  const byLocation = new Map<string, CountValue>()

  let totalUnits = 0
  let dailyRentalValue = 0
  let itemsWithoutPrice = 0

  for (const it of items) {
    const qty = it.quantity
    totalUnits += qty
    if (typeof it.rentPricePerDay === 'number') dailyRentalValue += it.rentPricePerDay * qty
    else itemsWithoutPrice += 1

    bump(byCategory, it.category?.trim() || '—', qty)
    bump(byOwnership, it.ownership ?? 'unbekannt', qty)
    if (!it.materialKinds?.length) bump(byMaterial, 'unklassifiziert', qty)
    else for (const k of it.materialKinds) bump(byMaterial, k, qty)

    const root = it.locationId ? rootLocation(nodes, it.locationId) : undefined
    bump(byLocation, root?.name ?? 'ohne Lagerort', qty)
  }

  const unitsByCondition = new Map<string, CountValue>()
  for (const u of units) bump(unitsByCondition, u.condition, 1)

  return {
    itemCount: items.length,
    totalUnits,
    serializedCount: units.length,
    dailyRentalValue: Math.round(dailyRentalValue * 100) / 100,
    itemsWithoutPrice,
    byCategory: sortDesc(byCategory),
    byOwnership: sortDesc(byOwnership),
    byMaterial: sortDesc(byMaterial),
    byLocation: sortDesc(byLocation),
    unitsByCondition: sortDesc(unitsByCondition),
  }
}
