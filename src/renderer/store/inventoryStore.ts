import { create } from 'zustand'
import { v4 as uuidv4 } from 'uuid'
import { STORAGE_KEYS } from '../lib/storageKeys'
import type { InventoryItem } from '../types/inventory'
import type { EquipmentItem } from '../types/equipment'

/**
 * Phase 2 — Zentraler Bestand (docs/inventory-rental-readiness.md).
 *
 * Projektübergreifender Lager-Bestand, persistiert in localStorage
 * (`cable-planner:inventory`) — bewusst gleiche Strategie wie uiStore/
 * settingsStore/Library, damit der Bestand in Web UND Desktop überlebt und
 * unabhängig vom geöffneten Plan ist. Eine spätere Migration auf eine
 * IPC-JSON-DB ist möglich, ohne die Consumer zu ändern (die reden nur mit
 * diesem Store).
 */

const KEY = STORAGE_KEYS.inventory

interface PersistedInventory {
  items: InventoryItem[]
}

const defaults: PersistedInventory = { items: [] }

/** Heilt ein geladenes Item: erzwingt Pflichtfelder, kappt Unsinn. */
const healItem = (raw: unknown): InventoryItem | null => {
  if (!raw || typeof raw !== 'object') return null
  const r = raw as Partial<InventoryItem>
  if (typeof r.model !== 'string' || r.model.trim() === '') return null
  const now = new Date().toISOString()
  return {
    id: typeof r.id === 'string' && r.id ? r.id : uuidv4(),
    model: r.model,
    manufacturer: typeof r.manufacturer === 'string' ? r.manufacturer : undefined,
    category: typeof r.category === 'string' ? r.category : undefined,
    quantity: typeof r.quantity === 'number' && r.quantity >= 0 ? Math.round(r.quantity) : 0,
    rentPricePerDay:
      typeof r.rentPricePerDay === 'number' && r.rentPricePerDay >= 0 ? r.rentPricePerDay : undefined,
    stockLocation: typeof r.stockLocation === 'string' ? r.stockLocation : undefined,
    supplier: typeof r.supplier === 'string' ? r.supplier : undefined,
    ownership:
      r.ownership === 'owned' || r.ownership === 'rented' || r.ownership === 'subhire'
        ? r.ownership
        : undefined,
    notes: typeof r.notes === 'string' ? r.notes : undefined,
    createdAt: typeof r.createdAt === 'string' ? r.createdAt : now,
    updatedAt: typeof r.updatedAt === 'string' ? r.updatedAt : now,
  }
}

const load = (): PersistedInventory => {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return defaults
    const parsed = JSON.parse(raw) as Partial<PersistedInventory>
    if (!Array.isArray(parsed.items)) return defaults
    return { items: parsed.items.map(healItem).filter((i): i is InventoryItem => i !== null) }
  } catch {
    return defaults
  }
}

const persist = (items: InventoryItem[]) => {
  try {
    localStorage.setItem(KEY, JSON.stringify({ items }))
  } catch {
    /* ignore */
  }
}

/** Felder, die ein neues Item übergeben darf (alles außer den vom Store
 *  verwalteten id/createdAt/updatedAt). */
export type InventoryItemInput = Omit<InventoryItem, 'id' | 'createdAt' | 'updatedAt'>

interface InventoryState {
  items: InventoryItem[]
  /** Legt einen neuen Artikel an, liefert die erzeugte id. */
  addItem: (input: InventoryItemInput) => string
  /** Aktualisiert Felder eines Artikels (id/createdAt bleiben unangetastet). */
  updateItem: (id: string, patch: Partial<InventoryItemInput>) => void
  /** Entfernt einen Artikel. */
  removeItem: (id: string) => void
  /**
   * Seed aus dem aktuellen Plan: gruppiert Equipment nach Name (+ Kategorie)
   * und legt je Gruppe einen Artikel mit Menge = Anzahl der Instanzen an.
   * Bereits vorhandene Artikel (gleiches Modell+Kategorie, case-insensitive)
   * werden NICHT dupliziert — ihre Menge wird auf max(bestehend, gezählt)
   * angehoben. Liefert die Anzahl neu angelegter Artikel.
   */
  seedFromEquipment: (equipment: EquipmentItem[]) => number
}

const initial = load()

/** Normalisierungs-Schlüssel für Dedupe (Modell + Kategorie). */
const dedupeKey = (model: string, category?: string) =>
  `${model.trim().toLowerCase()}|${(category ?? '').trim().toLowerCase()}`

export const useInventoryStore = create<InventoryState>((set, get) => ({
  items: initial.items,
  addItem: (input) => {
    const now = new Date().toISOString()
    const item: InventoryItem = { ...input, id: uuidv4(), createdAt: now, updatedAt: now }
    set((state) => {
      const items = [...state.items, item]
      persist(items)
      return { items }
    })
    return item.id
  },
  updateItem: (id, patch) =>
    set((state) => {
      const items = state.items.map((it) =>
        it.id === id ? { ...it, ...patch, updatedAt: new Date().toISOString() } : it,
      )
      persist(items)
      return { items }
    }),
  removeItem: (id) =>
    set((state) => {
      const items = state.items.filter((it) => it.id !== id)
      persist(items)
      return { items }
    }),
  seedFromEquipment: (equipment) => {
    // Gruppieren nach Modell+Kategorie → gezählte Menge.
    const counts = new Map<string, { model: string; category?: string; qty: number; sample: EquipmentItem }>()
    for (const eq of equipment) {
      const model = (eq.name ?? '').trim()
      if (!model) continue
      const key = dedupeKey(model, eq.category)
      const existing = counts.get(key)
      if (existing) existing.qty += 1
      else counts.set(key, { model, category: eq.category, qty: 1, sample: eq })
    }

    let created = 0
    const now = new Date().toISOString()
    const current = get().items
    const byKey = new Map(current.map((it) => [dedupeKey(it.model, it.category), it] as const))
    const next = [...current]

    for (const { model, category, qty, sample } of counts.values()) {
      const key = dedupeKey(model, category)
      const hit = byKey.get(key)
      if (hit) {
        // Vorhandenen Artikel nicht duplizieren — nur Menge ggf. anheben.
        if (qty > hit.quantity) {
          const idx = next.findIndex((it) => it.id === hit.id)
          if (idx >= 0) next[idx] = { ...hit, quantity: qty, updatedAt: now }
        }
        continue
      }
      next.push({
        id: uuidv4(),
        model,
        category,
        quantity: qty,
        rentPricePerDay: sample.rentPricePerDay,
        stockLocation: sample.stockLocation,
        supplier: sample.supplier,
        ownership: sample.ownership,
        createdAt: now,
        updatedAt: now,
      })
      created += 1
    }

    // Persistieren deckt sowohl neue Artikel als auch reine Mengen-Anhebungen ab.
    persist(next)
    set({ items: next })
    return created
  },
}))
