import { create } from 'zustand'
import { v4 as uuidv4 } from 'uuid'
import { STORAGE_KEYS } from '../lib/storageKeys'
import type {
  InventoryItem,
  InventoryCase,
  StorageNode,
  StorageNodeKind,
  InventorySet,
  SetComponent,
  InventoryUnit,
  UnitEvent,
  UnitCondition,
  PhysicalDimensions,
  InventoryMaterialKind,
} from '../types/inventory'
import { wouldCreateCycle } from '../lib/storageTree'
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
  /** Lager-Baum (Lagerplätze + Container) — LPN-Modell. */
  nodes: StorageNode[]
  /** Logische Sets/Kits. */
  sets: InventorySet[]
  /** Serialisierte Einzel-Einheiten. */
  units: InventoryUnit[]
}

const defaults: PersistedInventory = { items: [], nodes: [], sets: [], units: [] }

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
    locationId: typeof r.locationId === 'string' && r.locationId ? r.locationId : undefined,
    dimensions: healDimensions(r.dimensions),
    materialKinds: healMaterialKinds(r.materialKinds),
    notes: typeof r.notes === 'string' ? r.notes : undefined,
    createdAt: typeof r.createdAt === 'string' ? r.createdAt : now,
    updatedAt: typeof r.updatedAt === 'string' ? r.updatedAt : now,
  }
}

const NODE_KINDS = new Set<StorageNodeKind>(['depot', 'room', 'shelf', 'bin', 'case', 'transportCase'])

/** Heilt einen geladenen Lager-Knoten. */
const healNode = (raw: unknown): StorageNode | null => {
  if (!raw || typeof raw !== 'object') return null
  const r = raw as Partial<StorageNode>
  if (typeof r.name !== 'string' || r.name.trim() === '') return null
  if (!r.kind || !NODE_KINDS.has(r.kind)) return null
  const now = new Date().toISOString()
  return {
    id: typeof r.id === 'string' && r.id ? r.id : uuidv4(),
    name: r.name,
    kind: r.kind,
    parentId: typeof r.parentId === 'string' && r.parentId ? r.parentId : undefined,
    code: typeof r.code === 'string' && r.code.trim() ? r.code.trim() : undefined,
    codeType: healCodeType(r.codeType),
    dimensions: healDimensions(r.dimensions),
    notes: typeof r.notes === 'string' ? r.notes : undefined,
    createdAt: typeof r.createdAt === 'string' ? r.createdAt : now,
    updatedAt: typeof r.updatedAt === 'string' ? r.updatedAt : now,
  }
}

/** Heilt ein geladenes Set. */
const healSet = (raw: unknown): InventorySet | null => {
  if (!raw || typeof raw !== 'object') return null
  const r = raw as Partial<InventorySet>
  if (typeof r.name !== 'string' || r.name.trim() === '') return null
  const now = new Date().toISOString()
  const components: SetComponent[] = Array.isArray(r.components)
    ? r.components
        .map((c): SetComponent | null => {
          if (!c || typeof c !== 'object') return null
          const cc = c as Partial<SetComponent>
          if (typeof cc.itemId !== 'string' || !cc.itemId) return null
          const qty = typeof cc.quantity === 'number' && cc.quantity > 0 ? Math.round(cc.quantity) : 1
          return { itemId: cc.itemId, quantity: qty }
        })
        .filter((c): c is SetComponent => c !== null)
    : []
  return {
    id: typeof r.id === 'string' && r.id ? r.id : uuidv4(),
    name: r.name,
    components,
    notes: typeof r.notes === 'string' ? r.notes : undefined,
    createdAt: typeof r.createdAt === 'string' ? r.createdAt : now,
    updatedAt: typeof r.updatedAt === 'string' ? r.updatedAt : now,
  }
}

/**
 * Migriert das Alt-Format (`cases: InventoryCase[]` mit `contents`) auf das
 * LPN-Modell: jedes Case → StorageNode(kind 'case'), jeder Inhalt → das
 * `locationId` des Artikels zeigt auf diesen Case-Knoten (letztes Case gewinnt,
 * da ein Artikel im Bulk-Modell einen aktuellen Ort hat). Idempotent: läuft nur,
 * wenn noch keine `nodes` vorhanden sind.
 */
const migrateLegacyCases = (
  parsed: { cases?: unknown },
  items: InventoryItem[],
): { nodes: StorageNode[]; items: InventoryItem[] } => {
  const rawCases = Array.isArray(parsed.cases) ? parsed.cases : []
  if (rawCases.length === 0) return { nodes: [], items }
  const nodes: StorageNode[] = []
  const locByItem = new Map<string, string>()
  for (const rc of rawCases) {
    if (!rc || typeof rc !== 'object') continue
    const c = rc as Partial<InventoryCase>
    if (typeof c.name !== 'string' || !c.name.trim()) continue
    const id = typeof c.id === 'string' && c.id ? c.id : uuidv4()
    const now = new Date().toISOString()
    nodes.push({
      id,
      name: c.name,
      kind: 'case',
      code: typeof c.code === 'string' && c.code.trim() ? c.code.trim() : undefined,
      codeType: healCodeType(c.codeType),
      dimensions: healDimensions(c.dimensions),
      notes: typeof c.notes === 'string' ? c.notes : undefined,
      createdAt: typeof c.createdAt === 'string' ? c.createdAt : now,
      updatedAt: typeof c.updatedAt === 'string' ? c.updatedAt : now,
    })
    if (Array.isArray(c.contents)) {
      for (const p of c.contents) {
        const pc = p as Partial<{ itemId: string }>
        if (typeof pc?.itemId === 'string' && pc.itemId) locByItem.set(pc.itemId, id)
      }
    }
  }
  const migratedItems = items.map((it) =>
    locByItem.has(it.id) ? { ...it, locationId: locByItem.get(it.id) } : it,
  )
  return { nodes, items: migratedItems }
}

const UNIT_CONDITIONS = new Set<UnitCondition>(['ok', 'defect', 'inRepair', 'retired'])

/** Heilt eine geladene Einheit. */
const healUnit = (raw: unknown): InventoryUnit | null => {
  if (!raw || typeof raw !== 'object') return null
  const r = raw as Partial<InventoryUnit>
  if (typeof r.itemId !== 'string' || !r.itemId) return null
  const now = new Date().toISOString()
  const history: UnitEvent[] = Array.isArray(r.history)
    ? r.history
        .map((e): UnitEvent | null => {
          if (!e || typeof e !== 'object') return null
          const ev = e as Partial<UnitEvent>
          if (typeof ev.at !== 'string' || typeof ev.detail !== 'string') return null
          const kind =
            ev.kind === 'created' || ev.kind === 'moved' || ev.kind === 'condition' || ev.kind === 'note'
              ? ev.kind
              : 'note'
          return { at: ev.at, kind, detail: ev.detail }
        })
        .filter((e): e is UnitEvent => e !== null)
    : []
  return {
    id: typeof r.id === 'string' && r.id ? r.id : uuidv4(),
    itemId: r.itemId,
    serial: typeof r.serial === 'string' && r.serial.trim() ? r.serial.trim() : undefined,
    code: typeof r.code === 'string' && r.code.trim() ? r.code.trim() : undefined,
    codeType: healCodeType(r.codeType),
    locationId: typeof r.locationId === 'string' && r.locationId ? r.locationId : undefined,
    condition: r.condition && UNIT_CONDITIONS.has(r.condition) ? r.condition : 'ok',
    notes: typeof r.notes === 'string' ? r.notes : undefined,
    history,
    createdAt: typeof r.createdAt === 'string' ? r.createdAt : now,
    updatedAt: typeof r.updatedAt === 'string' ? r.updatedAt : now,
  }
}

const load = (): PersistedInventory => {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return defaults
    const parsed = JSON.parse(raw) as Partial<PersistedInventory> & { cases?: unknown }
    let items = Array.isArray(parsed.items)
      ? parsed.items.map(healItem).filter((i): i is InventoryItem => i !== null)
      : []
    let nodes = Array.isArray(parsed.nodes)
      ? parsed.nodes.map(healNode).filter((n): n is StorageNode => n !== null)
      : []
    // Alt-Format-Migration: nur, wenn noch keine nodes existieren.
    if (nodes.length === 0 && Array.isArray(parsed.cases) && parsed.cases.length > 0) {
      const migrated = migrateLegacyCases(parsed, items)
      nodes = migrated.nodes
      items = migrated.items
    }
    const sets = Array.isArray(parsed.sets)
      ? parsed.sets.map(healSet).filter((s): s is InventorySet => s !== null)
      : []
    const units = Array.isArray(parsed.units)
      ? parsed.units.map(healUnit).filter((u): u is InventoryUnit => u !== null)
      : []
    return { items, nodes, sets, units }
  } catch {
    return defaults
  }
}

const persist = (
  items: InventoryItem[],
  nodes: StorageNode[],
  sets: InventorySet[],
  units: InventoryUnit[],
) => {
  try {
    localStorage.setItem(KEY, JSON.stringify({ items, nodes, sets, units }))
  } catch {
    /* ignore */
  }
}

/** Felder, die ein neues Item übergeben darf (alles außer den vom Store
 *  verwalteten id/createdAt/updatedAt). */
export type InventoryItemInput = Omit<InventoryItem, 'id' | 'createdAt' | 'updatedAt'>
/** Felder, die ein neuer Lager-Knoten übergeben darf. */
export type StorageNodeInput = Omit<StorageNode, 'id' | 'createdAt' | 'updatedAt'>
/** Felder, die ein neues Set übergeben darf. */
export type InventorySetInput = Omit<InventorySet, 'id' | 'createdAt' | 'updatedAt'>
/** Felder, die eine neue Einheit übergeben darf (Store verwaltet id/history/Zeit). */
export type InventoryUnitInput = Omit<InventoryUnit, 'id' | 'history' | 'createdAt' | 'updatedAt'>

interface InventoryState {
  items: InventoryItem[]
  /** Lager-Baum: Lagerplätze + Container (LPN-Modell). */
  nodes: StorageNode[]
  /** Logische Sets/Kits. */
  sets: InventorySet[]
  /** Serialisierte Einzel-Einheiten. */
  units: InventoryUnit[]
  /** Legt einen neuen Artikel an, liefert die erzeugte id. */
  addItem: (input: InventoryItemInput) => string
  /** Aktualisiert Felder eines Artikels (id/createdAt bleiben unangetastet). */
  updateItem: (id: string, patch: Partial<InventoryItemInput>) => void
  /** Entfernt einen Artikel (und aus allen Set-Komponenten). */
  removeItem: (id: string) => void
  /**
   * Seed aus dem aktuellen Plan: gruppiert Equipment nach Name (+ Kategorie)
   * und legt je Gruppe einen Artikel mit Menge = Anzahl der Instanzen an.
   * Bereits vorhandene Artikel (gleiches Modell+Kategorie, case-insensitive)
   * werden NICHT dupliziert — ihre Menge wird auf max(bestehend, gezählt)
   * angehoben. Liefert die Anzahl neu angelegter Artikel.
   */
  seedFromEquipment: (equipment: EquipmentItem[]) => number
  /** Legt einen Lager-Knoten (Lagerplatz oder Container) an, liefert die id. */
  addNode: (input: StorageNodeInput) => string
  /** Aktualisiert Felder eines Knotens (parentId via moveNode). */
  updateNode: (id: string, patch: Partial<Omit<StorageNodeInput, 'parentId'>>) => void
  /**
   * Hängt einen Knoten unter einen neuen Parent (Verschieben im Baum /
   * Case-in-Case). Zyklen (Knoten in sich/seinen Nachfahren) werden abgewiesen.
   */
  moveNode: (id: string, newParentId: string | undefined) => void
  /**
   * Entfernt einen Knoten. Direkte Kinder werden zum Parent des gelöschten
   * Knotens hochgezogen (kein Waisen-Subtree); Artikel, die dort lagen,
   * verlieren ihren Lagerort (locationId → undefined).
   */
  removeNode: (id: string) => void
  /**
   * Weist einem Artikel einen Lagerort zu (Lagerplatz ODER Container). Zeigt
   * `nodeId` auf einen Container, ist der Artikel damit eingepackt. `undefined`
   * = kein Lagerort. Kein Pack-Zustand außerhalb des Baums — LPN-Prinzip.
   */
  setItemLocation: (itemId: string, nodeId: string | undefined) => void
  /** Legt ein Set an, liefert die id. */
  addSet: (input: InventorySetInput) => string
  /** Aktualisiert Felder eines Sets. */
  updateSet: (id: string, patch: Partial<InventorySetInput>) => void
  /** Entfernt ein Set (Artikel bleiben im Bestand). */
  removeSet: (id: string) => void
  /** Legt eine serialisierte Einheit an (mit „created"-Historieneintrag). */
  addUnit: (input: InventoryUnitInput) => string
  /** Aktualisiert Stammfelder einer Einheit (Ort/Zustand via move/condition). */
  updateUnit: (id: string, patch: Partial<Pick<InventoryUnit, 'serial' | 'code' | 'codeType' | 'notes'>>) => void
  /** Entfernt eine Einheit. */
  removeUnit: (id: string) => void
  /** Verschiebt eine Einheit an einen Lagerort (hängt „moved" an die Historie). */
  moveUnit: (id: string, nodeId: string | undefined, locationLabel: string) => void
  /** Ändert den Zustand einer Einheit (hängt „condition" an die Historie). */
  setUnitCondition: (id: string, condition: UnitCondition) => void
}

const initial = load()

/** Normalisierungs-Schlüssel für Dedupe (Modell + Kategorie). */
const dedupeKey = (model: string, category?: string) =>
  `${model.trim().toLowerCase()}|${(category ?? '').trim().toLowerCase()}`

export const useInventoryStore = create<InventoryState>((set, get) => ({
  items: initial.items,
  nodes: initial.nodes,
  sets: initial.sets,
  units: initial.units,
  addItem: (input) => {
    const now = new Date().toISOString()
    const item: InventoryItem = { ...input, id: uuidv4(), createdAt: now, updatedAt: now }
    set((state) => {
      const items = [...state.items, item]
      persist(items, state.nodes, state.sets, state.units)
      return { items }
    })
    return item.id
  },
  updateItem: (id, patch) =>
    set((state) => {
      const items = state.items.map((it) =>
        it.id === id ? { ...it, ...patch, updatedAt: new Date().toISOString() } : it,
      )
      persist(items, state.nodes, state.sets, state.units)
      return { items }
    }),
  removeItem: (id) =>
    set((state) => {
      const items = state.items.filter((it) => it.id !== id)
      // Aus allen Set-Komponenten entfernen, damit keine toten Referenzen bleiben.
      const sets = state.sets.map((s) =>
        s.components.some((c) => c.itemId === id)
          ? { ...s, components: s.components.filter((c) => c.itemId !== id), updatedAt: new Date().toISOString() }
          : s,
      )
      // Serialisierte Einheiten dieses Modells mit-entfernen (keine Waisen-Units).
      const units = state.units.filter((u) => u.itemId !== id)
      persist(items, state.nodes, sets, units)
      return { items, sets, units }
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
    persist(next, get().nodes, get().sets, get().units)
    set({ items: next })
    return created
  },
  addNode: (input) => {
    const now = new Date().toISOString()
    const node: StorageNode = { ...input, id: uuidv4(), createdAt: now, updatedAt: now }
    set((state) => {
      const nodes = [...state.nodes, node]
      persist(state.items, nodes, state.sets, state.units)
      return { nodes }
    })
    return node.id
  },
  updateNode: (id, patch) =>
    set((state) => {
      const nodes = state.nodes.map((n) =>
        n.id === id ? { ...n, ...patch, updatedAt: new Date().toISOString() } : n,
      )
      persist(state.items, nodes, state.sets, state.units)
      return { nodes }
    }),
  moveNode: (id, newParentId) =>
    set((state) => {
      // Zyklus-Schutz: ein Knoten darf nicht in sich/seinen Nachfahren landen.
      if (wouldCreateCycle(state.nodes, id, newParentId)) return {}
      const nodes = state.nodes.map((n) =>
        n.id === id ? { ...n, parentId: newParentId, updatedAt: new Date().toISOString() } : n,
      )
      persist(state.items, nodes, state.sets, state.units)
      return { nodes }
    }),
  removeNode: (id) =>
    set((state) => {
      const removed = state.nodes.find((n) => n.id === id)
      const parentId = removed?.parentId
      // Kinder zum Parent des gelöschten Knotens hochziehen (kein Waisen-Subtree).
      const nodes = state.nodes
        .filter((n) => n.id !== id)
        .map((n) =>
          n.parentId === id ? { ...n, parentId, updatedAt: new Date().toISOString() } : n,
        )
      // Artikel, die hier lagen, verlieren ihren Lagerort.
      const items = state.items.map((it) =>
        it.locationId === id ? { ...it, locationId: undefined, updatedAt: new Date().toISOString() } : it,
      )
      // Einheiten, die hier lagen, ebenso (mit Historieneintrag).
      const nowIso = new Date().toISOString()
      const units = state.units.map((u) =>
        u.locationId === id
          ? {
              ...u,
              locationId: undefined,
              history: [...u.history, { at: nowIso, kind: 'moved' as const, detail: 'Lagerort gelöscht' }],
              updatedAt: nowIso,
            }
          : u,
      )
      persist(items, nodes, state.sets, units)
      return { items, nodes, units }
    }),
  setItemLocation: (itemId, nodeId) =>
    set((state) => {
      const items = state.items.map((it) =>
        it.id === itemId ? { ...it, locationId: nodeId, updatedAt: new Date().toISOString() } : it,
      )
      persist(items, state.nodes, state.sets, state.units)
      return { items }
    }),
  addSet: (input) => {
    const now = new Date().toISOString()
    const s: InventorySet = { ...input, components: input.components ?? [], id: uuidv4(), createdAt: now, updatedAt: now }
    set((state) => {
      const sets = [...state.sets, s]
      persist(state.items, state.nodes, sets, state.units)
      return { sets }
    })
    return s.id
  },
  updateSet: (id, patch) =>
    set((state) => {
      const sets = state.sets.map((s) =>
        s.id === id ? { ...s, ...patch, updatedAt: new Date().toISOString() } : s,
      )
      persist(state.items, state.nodes, sets, state.units)
      return { sets }
    }),
  removeSet: (id) =>
    set((state) => {
      const sets = state.sets.filter((s) => s.id !== id)
      persist(state.items, state.nodes, sets, state.units)
      return { sets }
    }),
  addUnit: (input) => {
    const now = new Date().toISOString()
    const unit: InventoryUnit = {
      ...input,
      id: uuidv4(),
      history: [{ at: now, kind: 'created', detail: 'angelegt' }],
      createdAt: now,
      updatedAt: now,
    }
    set((state) => {
      const units = [...state.units, unit]
      persist(state.items, state.nodes, state.sets, units)
      return { units }
    })
    return unit.id
  },
  updateUnit: (id, patch) =>
    set((state) => {
      const units = state.units.map((u) =>
        u.id === id ? { ...u, ...patch, updatedAt: new Date().toISOString() } : u,
      )
      persist(state.items, state.nodes, state.sets, units)
      return { units }
    }),
  removeUnit: (id) =>
    set((state) => {
      const units = state.units.filter((u) => u.id !== id)
      persist(state.items, state.nodes, state.sets, units)
      return { units }
    }),
  moveUnit: (id, nodeId, locationLabel) =>
    set((state) => {
      const now = new Date().toISOString()
      const units = state.units.map((u) =>
        u.id === id
          ? {
              ...u,
              locationId: nodeId,
              history: [...u.history, { at: now, kind: 'moved' as const, detail: nodeId ? `nach ${locationLabel}` : 'aus Lagerort entfernt' }],
              updatedAt: now,
            }
          : u,
      )
      persist(state.items, state.nodes, state.sets, units)
      return { units }
    }),
  setUnitCondition: (id, condition) =>
    set((state) => {
      const now = new Date().toISOString()
      const units = state.units.map((u) =>
        u.id === id
          ? {
              ...u,
              condition,
              history: [...u.history, { at: now, kind: 'condition' as const, detail: `Zustand → ${condition}` }],
              updatedAt: now,
            }
          : u,
      )
      persist(state.items, state.nodes, state.sets, units)
      return { units }
    }),
}))
