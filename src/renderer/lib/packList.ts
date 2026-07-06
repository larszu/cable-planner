// ───────────────────────────────────────────────────────────────────────────
// Digitale Packliste — rekursiver Inhalt eines Containers/Lagerorts.
//
// Rentmans meistgelobter Warehouse-Nutzen: einen Transport-Case „aufmachen" und
// den kompletten (verschachtelten) Inhalt sehen — Sub-Cases, Bulk-Artikel und
// serialisierte Einheiten über alle Ebenen. Rein abgeleitet aus dem Lager-Baum
// (nichts erfinden).
// ───────────────────────────────────────────────────────────────────────────
import type { InventoryItem, StorageNode, InventoryUnit } from '../types/inventory'
import { isContainerKind } from './storageTree'

export interface PackListItemLine {
  model: string
  qty: number
}
export interface PackListUnitLine {
  label: string
  condition: InventoryUnit['condition']
}
/** Ein Knoten der Packliste samt seiner direkten Inhalte. */
export interface PackListNode {
  node: StorageNode
  depth: number
  items: PackListItemLine[]
  units: PackListUnitLine[]
}

export interface PackListSources {
  items: InventoryItem[]
  nodes: StorageNode[]
  units: InventoryUnit[]
}

/**
 * Baut die Packliste eines Wurzel-Knotens: den Knoten selbst plus alle
 * Nachfahren (Tiefen-zuerst, stabil nach Name), je Knoten die direkt darin
 * liegenden Bulk-Artikel (nach Modell gruppiert) und Einheiten. Unbekannte
 * Wurzel → leere Liste.
 */
export const derivePackList = (
  rootId: string,
  { items, nodes, units }: PackListSources,
): PackListNode[] => {
  const byId = new Map(nodes.map((n) => [n.id, n]))
  if (!byId.has(rootId)) return []
  const itemById = new Map(items.map((it) => [it.id, it]))
  const childrenByParent = new Map<string, StorageNode[]>()
  for (const n of nodes) {
    if (!n.parentId) continue
    const arr = childrenByParent.get(n.parentId) ?? []
    arr.push(n)
    childrenByParent.set(n.parentId, arr)
  }
  for (const arr of childrenByParent.values()) arr.sort((a, b) => a.name.localeCompare(b.name))

  const out: PackListNode[] = []
  const visit = (id: string, depth: number) => {
    const node = byId.get(id)
    if (!node) return
    // Direkte Bulk-Artikel nach Modell gruppieren.
    const counts = new Map<string, number>()
    for (const it of items) {
      if (it.locationId === id) counts.set(it.model, (counts.get(it.model) ?? 0) + it.quantity)
    }
    const itemLines: PackListItemLine[] = [...counts.entries()]
      .map(([model, qty]) => ({ model, qty }))
      .sort((a, b) => a.model.localeCompare(b.model))
    // Direkte Einheiten.
    const unitLines: PackListUnitLine[] = units
      .filter((u) => u.locationId === id)
      .map((u) => {
        const model = itemById.get(u.itemId)?.model ?? '?'
        const serial = u.serial || u.code || u.id.slice(0, 6)
        return { label: `${model} · ${serial}`, condition: u.condition }
      })
      .sort((a, b) => a.label.localeCompare(b.label))
    out.push({ node, depth, items: itemLines, units: unitLines })
    for (const child of childrenByParent.get(id) ?? []) visit(child.id, depth + 1)
  }
  visit(rootId, 0)
  return out
}

/** Zählt Gesamt-Stückzahl (Bulk + Einheiten) einer Packliste. */
export const packListTotalCount = (list: PackListNode[]): number =>
  list.reduce((sum, n) => sum + n.items.reduce((s, i) => s + i.qty, 0) + n.units.length, 0)

/** Packliste als einrückter, kopierbarer Text. */
export const packListToText = (list: PackListNode[]): string => {
  const lines: string[] = []
  for (const n of list) {
    const pad = '  '.repeat(n.depth)
    const marker = isContainerKind(n.node.kind) ? '[]' : '#'
    lines.push(`${pad}${marker} ${n.node.name}${n.node.code ? ` (${n.node.code})` : ''}`)
    for (const it of n.items) lines.push(`${pad}  ${it.qty}x ${it.model}`)
    for (const u of n.units) lines.push(`${pad}  - ${u.label}${u.condition !== 'ok' ? ` [${u.condition}]` : ''}`)
  }
  return lines.join('\n')
}
