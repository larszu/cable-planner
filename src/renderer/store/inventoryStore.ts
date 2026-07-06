import { create } from 'zustand'
import { v4 as uuidv4 } from 'uuid'
import { STORAGE_KEYS } from '../lib/storageKeys'
import type {
  InventoryItem,
  InventoryCase,
  CasePackedItem,
  PhysicalDimensions,
  InventoryMaterialKind,
} from '../types/inventory'
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
  cases: InventoryCase[]
}

const defaults: PersistedInventory = { items: [], cases: [] }

/** Heilt optionale Maße (nur positive Zahlen; sonst weglassen — nichts erfinden). */
const healDimensions = (raw: unknown): PhysicalDimensions | undefined => {
  if (!raw || typeof raw !== 'object') return undefined
  const r = raw as Partial<PhysicalDimensions>
  const num = (v: unknown): number | undefined =>
    typeof v === 'number' && Number.isFinite(v) && v > 0 ? v : undefined
  const d: PhysicalDimensions = {
    widthMm: num(r.widthMm),
    heightMm: num(r.heightMm),
    depthMm: num(r.depthMm),
    weightKg: num(r.weightKg),
  }
  return d.widthMm || d.heightMm || d.depthMm || d.weightKg ? d : undefined
}

const healCodeType = (v: unknown): InventoryItem['codeType'] =>
  v === 'qr' || v === 'barcode' ? v : undefined

const healMaterialKinds = (v: unknown): InventoryMaterialKind[] | undefined => {
  if (!Array.isArray(v)) return undefined
  const kinds = v.filter((k): k is InventoryMaterialKind => k === 'rental' || k === 'consumable')
  return kinds.length ? [...new Set(kinds)] : undefined
}

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
    code: typeof r.code === 'string' && r.code.trim() ? r.code.trim() : undefined,
    codeType: healCodeType(r.codeType),
    dimensions: healDimensions(r.dimensions),
    materialKinds: healMaterialKinds(r.materialKinds),
    notes: typeof r.notes === 'string' ? r.notes : undefined,
    createdAt: typeof r.createdAt === 'string' ? r.createdAt : now,
    updatedAt: typeof r.updatedAt === 'string' ? r.updatedAt : now,
  }
}

/** Heilt ein geladenes Case. */
const healCase = (raw: unknown): InventoryCase | null => {
  if (!raw || typeof raw !== 'object') return null
  const r = raw as Partial<InventoryCase>
  if (typeof r.name !== 'string' || r.name.trim() === '') return null
  const now = new Date().toISOString()
  const contents: CasePackedItem[] = Array.isArray(r.contents)
    ? r.contents
        .map((c): CasePackedItem | null => {
          if (!c || typeof c !== 'object') return null
          const cc = c as Partial<CasePackedItem>
          if (typeof cc.itemId !== 'string' || !cc.itemId) return null
          const qty = typeof cc.quantity === 'number' && cc.quantity > 0 ? Math.round(cc.quantity) : 1
          return { itemId: cc.itemId, quantity: qty }
        })
        .filter((c): c is CasePackedItem => c !== null)
    : []
  return {
    id: typeof r.id === 'string' && r.id ? r.id : uuidv4(),
    name: r.name,
    dimensions: healDimensions(r.dimensions),
    code: typeof r.code === 'string' && r.code.trim() ? r.code.trim() : undefined,
    codeType: healCodeType(r.codeType),
    stockLocation: typeof r.stockLocation === 'string' ? r.stockLocation : undefined,
    contents,
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
    const items = Array.isArray(parsed.items)
      ? parsed.items.map(healItem).filter((i): i is InventoryItem => i !== null)
      : []
    const cases = Array.isArray(parsed.cases)
      ? parsed.cases.map(healCase).filter((c): c is InventoryCase => c !== null)
      : []
    return { items, cases }
  } catch {
    return defaults
  }
}

const persist = (items: InventoryItem[], cases: InventoryCase[]) => {
  try {
    localStorage.setItem(KEY, JSON.stringify({ items, cases }))
  } catch {
    /* ignore */
  }
}

/** Felder, die ein neues Item übergeben darf (alles außer den vom Store
 *  verwalteten id/createdAt/updatedAt). */
export type InventoryItemInput = Omit<InventoryItem, 'id' | 'createdAt' | 'updatedAt'>
/** Felder, die ein neues Case übergeben darf (Store verwaltet id/Zeitstempel). */
export type InventoryCaseInput = Omit<InventoryCase, 'id' | 'createdAt' | 'updatedAt'>

interface InventoryState {
  items: InventoryItem[]
  cases: InventoryCase[]
  /** Legt einen neuen Artikel an, liefert die erzeugte id. */
  addItem: (input: InventoryItemInput) => string
  /** Aktualisiert Felder eines Artikels (id/createdAt bleiben unangetastet). */
  updateItem: (id: string, patch: Partial<InventoryItemInput>) => void
  /** Entfernt einen Artikel (und aus allen Cases, in denen er verpackt ist). */
  removeItem: (id: string) => void
  /**
   * Seed aus dem aktuellen Plan: gruppiert Equipment nach Name (+ Kategorie)
   * und legt je Gruppe einen Artikel mit Menge = Anzahl der Instanzen an.
   * Bereits vorhandene Artikel (gleiches Modell+Kategorie, case-insensitive)
   * werden NICHT dupliziert — ihre Menge wird auf max(bestehend, gezählt)
   * angehoben. Liefert die Anzahl neu angelegter Artikel.
   */
  seedFromEquipment: (equipment: EquipmentItem[]) => number
  /** Legt ein neues Case an, liefert die erzeugte id. */
  addCase: (input: InventoryCaseInput) => string
  /** Aktualisiert Felder eines Cases. */
  updateCase: (id: string, patch: Partial<InventoryCaseInput>) => void
  /** Entfernt ein Case (Artikel bleiben im Bestand). */
  removeCase: (id: string) => void
  /**
   * Verpackt `quantity` Stück eines Artikels in ein Case (addiert, wenn bereits
   * enthalten). Kein Bestands-Abzug — Cases sind eine Sicht, kein Buchungskonto.
   */
  packItem: (caseId: string, itemId: string, quantity: number) => void
  /** Entfernt einen Artikel komplett aus einem Case. */
  unpackItem: (caseId: string, itemId: string) => void
}

const initial = load()

/** Normalisierungs-Schlüssel für Dedupe (Modell + Kategorie). */
const dedupeKey = (model: string, category?: string) =>
  `${model.trim().toLowerCase()}|${(category ?? '').trim().toLowerCase()}`

export const useInventoryStore = create<InventoryState>((set, get) => ({
  items: initial.items,
  cases: initial.cases,
  addItem: (input) => {
    const now = new Date().toISOString()
    const item: InventoryItem = { ...input, id: uuidv4(), createdAt: now, updatedAt: now }
    set((state) => {
      const items = [...state.items, item]
      persist(items, state.cases)
      return { items }
    })
    return item.id
  },
  updateItem: (id, patch) =>
    set((state) => {
      const items = state.items.map((it) =>
        it.id === id ? { ...it, ...patch, updatedAt: new Date().toISOString() } : it,
      )
      persist(items, state.cases)
      return { items }
    }),
  removeItem: (id) =>
    set((state) => {
      const items = state.items.filter((it) => it.id !== id)
      // Aus allen Cases entfernen, damit keine toten Referenzen bleiben.
      const cases = state.cases.map((c) =>
        c.contents.some((p) => p.itemId === id)
          ? { ...c, contents: c.contents.filter((p) => p.itemId !== id), updatedAt: new Date().toISOString() }
          : c,
      )
      persist(items, cases)
      return { items, cases }
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
    persist(next, get().cases)
    set({ items: next })
    return created
  },
  addCase: (input) => {
    const now = new Date().toISOString()
    const box: InventoryCase = {
      ...input,
      contents: input.contents ?? [],
      id: uuidv4(),
      createdAt: now,
      updatedAt: now,
    }
    set((state) => {
      const cases = [...state.cases, box]
      persist(state.items, cases)
      return { cases }
    })
    return box.id
  },
  updateCase: (id, patch) =>
    set((state) => {
      const cases = state.cases.map((c) =>
        c.id === id ? { ...c, ...patch, updatedAt: new Date().toISOString() } : c,
      )
      persist(state.items, cases)
      return { cases }
    }),
  removeCase: (id) =>
    set((state) => {
      const cases = state.cases.filter((c) => c.id !== id)
      persist(state.items, cases)
      return { cases }
    }),
  packItem: (caseId, itemId, quantity) =>
    set((state) => {
      const qty = quantity > 0 ? Math.round(quantity) : 1
      const cases = state.cases.map((c) => {
        if (c.id !== caseId) return c
        const existing = c.contents.find((p) => p.itemId === itemId)
        const contents = existing
          ? c.contents.map((p) => (p.itemId === itemId ? { ...p, quantity: p.quantity + qty } : p))
          : [...c.contents, { itemId, quantity: qty }]
        return { ...c, contents, updatedAt: new Date().toISOString() }
      })
      persist(state.items, cases)
      return { cases }
    }),
  unpackItem: (caseId, itemId) =>
    set((state) => {
      const cases = state.cases.map((c) =>
        c.id === caseId
          ? { ...c, contents: c.contents.filter((p) => p.itemId !== itemId), updatedAt: new Date().toISOString() }
          : c,
      )
      persist(state.items, cases)
      return { cases }
    }),
}))
