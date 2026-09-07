// ───────────────────────────────────────────────────────────────────────────
// Lager-Baum (LPN) — reine Resolver über StorageNodes + InventoryItems.
//
// Grundsatz „nichts erfinden": Alles wird aus dem Baum ABGELEITET, nichts
// dupliziert. Der effektive Lagerort eines Artikels ergibt sich aus der
// Container-Kette (Case → Case → Transport-Case → Lagerplatz), nicht aus einem
// gepflegten Zweitfeld. Zyklen werden abgewehrt, damit die Ableitung immer
// terminiert.
// ───────────────────────────────────────────────────────────────────────────
import type {
  StorageNode,
  StorageNodeKind,
  InventoryItem,
  InventorySet,
} from '../types/inventory'
import { CONTAINER_KINDS } from '../types/inventory'

const CONTAINER_SET = new Set<StorageNodeKind>(CONTAINER_KINDS)

/** true, wenn der Knoten ein Container ist (Case/Transport-Case). */
export const isContainerKind = (kind: StorageNodeKind): boolean => CONTAINER_SET.has(kind)

/** Baut eine id→Node-Map für schnelle Lookups. */
const nodeMap = (nodes: StorageNode[]): Map<string, StorageNode> =>
  new Map(nodes.map((n) => [n.id, n]))

/**
 * Pfad von der Wurzel bis zum Knoten (inklusive). Bricht bei Zyklen sauber ab
 * (jeder Knoten nur einmal). Unbekannte id → leeres Array.
 */
export const nodePath = (nodes: StorageNode[], id: string | undefined): StorageNode[] => {
  if (!id) return []
  const byId = nodeMap(nodes)
  const chain: StorageNode[] = []
  const seen = new Set<string>()
  let cur = byId.get(id)
  while (cur && !seen.has(cur.id)) {
    seen.add(cur.id)
    chain.push(cur)
    cur = cur.parentId ? byId.get(cur.parentId) : undefined
  }
  return chain.reverse()
}

/** Oberster Vorfahr eines Knotens (der „physische" Lagerort). */
export const rootLocation = (
  nodes: StorageNode[],
  id: string | undefined,
): StorageNode | undefined => nodePath(nodes, id)[0]

/**
 * Lesbarer Pfad, z. B. „Depot › Raum 1 › Regal A3 › Case 2". Bei unbekanntem
 * Knoten leerer String.
 */
export const nodePathLabel = (
  nodes: StorageNode[],
  id: string | undefined,
  separator = ' › ',
): string => nodePath(nodes, id).map((n) => n.name).join(separator)

/**
 * Alle Nachfahren-Ids eines Knotens (transitiv), OHNE den Knoten selbst.
 * Zyklensicher.
 */
export const descendantNodeIds = (nodes: StorageNode[], id: string): Set<string> => {
  const childrenByParent = new Map<string, string[]>()
  for (const n of nodes) {
    if (!n.parentId) continue
    const arr = childrenByParent.get(n.parentId) ?? []
    arr.push(n.id)
    childrenByParent.set(n.parentId, arr)
  }
  const out = new Set<string>()
  const stack = [...(childrenByParent.get(id) ?? [])]
  while (stack.length) {
    const cur = stack.pop()!
    if (out.has(cur)) continue
    out.add(cur)
    for (const c of childrenByParent.get(cur) ?? []) stack.push(c)
  }
  return out
}

/**
 * Artikel, deren Lagerort dieser Knoten ist. Mit `recursive` zählen auch
 * Artikel in verschachtelten Unter-Containern/-Lagerplätzen mit (z. B. alle
 * Artikel in einem Transport-Case über alle Ebenen).
 */
export const itemsInNode = (
  items: InventoryItem[],
  nodes: StorageNode[],
  id: string,
  opts: { recursive?: boolean } = {},
): InventoryItem[] => {
  if (!opts.recursive) return items.filter((it) => it.locationId === id)
  const ids = descendantNodeIds(nodes, id)
  ids.add(id)
  return items.filter((it) => it.locationId != null && ids.has(it.locationId))
}

/**
 * Würde das Umhängen von `id` unter `newParentId` einen Zyklus erzeugen?
 * True, wenn newParentId gleich id ist oder ein Nachfahr von id (dann läge der
 * Knoten in sich selbst). `undefined` (Wurzel) ist immer erlaubt.
 */
export const wouldCreateCycle = (
  nodes: StorageNode[],
  id: string,
  newParentId: string | undefined,
): boolean => {
  if (!newParentId) return false
  if (newParentId === id) return true
  return descendantNodeIds(nodes, id).has(newParentId)
}

/**
 * Verfügbarkeit eines logischen Sets = wie oft lässt es sich aus dem Bestand
 * bauen (Minimum über Komponenten: floor(Bestand / Bedarf)). Fehlt ein Artikel
 * oder ist der Bedarf ≤ 0, ist das Set nicht baubar (0). Leeres Set → 0.
 */
export const availabilityOfSet = (items: InventoryItem[], set: InventorySet): number => {
  if (set.components.length === 0) return 0
  const qtyById = new Map(items.map((it) => [it.id, it.quantity]))
  let min = Infinity
  for (const c of set.components) {
    if (c.quantity <= 0) return 0
    const have = qtyById.get(c.itemId)
    if (have == null) return 0
    min = Math.min(min, Math.floor(have / c.quantity))
  }
  return min === Infinity ? 0 : min
}
