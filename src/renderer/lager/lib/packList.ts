// ───────────────────────────────────────────────────────────────────────────
// Digitale Packliste — rekursiver Inhalt eines Containers/Lagerorts.
//
// Rentmans meistgelobter Warehouse-Nutzen: einen Transport-Case „aufmachen" und
// den kompletten (verschachtelten) Inhalt sehen — Sub-Cases, Bulk-Artikel und
// serialisierte Einheiten über alle Ebenen. Rein abgeleitet aus dem Lager-Baum
// (nichts erfinden).
// ───────────────────────────────────────────────────────────────────────────
import type { InventoryItem, StorageNode, InventoryUnit } from '../types/inventory'
import { unitLabel } from './unitIdentity'
import { isContainerKind } from './storageTree'
import { ownershipNote } from './ownership'

export interface PackListItemLine {
  model: string
  qty: number
  /**
   * Fremdes Material, im Klartext (Bedarf 67): „Sub-Hire · Videohaus Meier ·
   * zurueck 2026-09-12". Leer bei eigenem.
   *
   * Es ist ein FELD und kein Nachschlagen beim Anzeigen, weil die Gruppierung
   * daran haengt — siehe unten.
   */
  ownership?: string
}
export interface PackListUnitLine {
  label: string
  condition: InventoryUnit['condition']
  /** Wie bei `PackListItemLine`. Die Einheit erbt es von ihrem Artikel. */
  ownership?: string
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
  /**
   * Stichtag fuer „zurueck seit" (ISO-Datum). Von aussen, damit diese
   * Ableitung rein bleibt — dieselbe Regel wie bei `overdueCheckouts`.
   * Ohne ihn steht das Datum ohne Faelligkeits-Urteil da.
   */
  heute = '',
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
    // Direkte Bulk-Artikel gruppieren — nach Modell UND HERKUNFT.
    //
    // BEDARF 67. Bis hierher lief die Gruppierung ueber den Modellnamen
    // allein. Vier eigene und zwei sub-gemietete Kameras desselben Typs fielen
    // damit in EINE Zeile „6x Sony PMW-F55", und die Herkunft war nicht
    // verloren, sondern strukturell nicht darstellbar. Wer die Liste im Lager
    // abarbeitet, kann fremdes Material dann gar nicht erkennen — und der
    // Bedarf sagt, was das kostet: nicht der Verlust, sondern „keeping it
    // three weeks too long".
    const counts = new Map<string, { model: string; qty: number; ownership: string }>()
    for (const it of items) {
      if (it.locationId !== id) continue
      const ownership = ownershipNote(it, heute)
      const key = `${it.model}\u0000${ownership}`
      const vorhanden = counts.get(key)
      if (vorhanden) vorhanden.qty += it.quantity
      else counts.set(key, { model: it.model, qty: it.quantity, ownership })
    }
    const itemLines: PackListItemLine[] = [...counts.values()]
      .map((c) => ({ model: c.model, qty: c.qty, ...(c.ownership ? { ownership: c.ownership } : {}) }))
      // Eigenes vor fremdem bei gleichem Modell: die Liste liest sich von
      // „das haben wir" nach „das muss zurueck".
      .sort((a, b) => a.model.localeCompare(b.model) || (a.ownership ?? '').localeCompare(b.ownership ?? ''))
    // Direkte Einheiten.
    const unitLines: PackListUnitLine[] = units
      .filter((u) => u.locationId === id)
      .map((u) => {
        const item = itemById.get(u.itemId)
        const model = item?.model ?? '?'
        // Bedarf 107 — die Packliste ist ein HAUS-Blatt: der Lagerist ruft
        // die Hausreferenz, nicht die Herstellernummer.
        const serial = unitLabel(u, 'house')
        // Die Einheit erbt die Herkunft ihres Artikels: sie hat keine eigene,
        // und eine erfundene waere schlimmer als keine.
        const ownership = item ? ownershipNote(item, heute) : ''
        return {
          label: `${model} · ${serial}`,
          condition: u.condition,
          ...(ownership ? { ownership } : {}),
        }
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
    for (const it of n.items) {
      lines.push(`${pad}  ${it.qty}x ${it.model}${it.ownership ? `  [${it.ownership}]` : ''}`)
    }
    for (const u of n.units) {
      const zustand = u.condition !== 'ok' ? ` [${u.condition}]` : ''
      lines.push(`${pad}  - ${u.label}${zustand}${u.ownership ? `  [${u.ownership}]` : ''}`)
    }
  }
  return lines.join('\n')
}
