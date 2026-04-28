import { useMemo, useState } from 'react'

interface ChecklistItem {
  id: string
  name: string
  category: string
  checked: boolean
  qty?: number
  parentId?: string | null
  /** When set, shown as a "Template erkannt" badge next to the item. */
  templateMatch?: string
}

interface EquipmentChecklistProps {
  items: ChecklistItem[]
  onToggle: (id: string) => void
  onSetAll?: (checked: boolean) => void
  onQtyChange?: (id: string, qty: number) => void
  onSetAllChildren?: (parentId: string, checked: boolean) => void
}

export const EquipmentChecklist = ({ items, onToggle, onSetAll, onQtyChange, onSetAllChildren }: EquipmentChecklistProps) => {
  // Build parent -> children map. Children whose parent is not in the visible list
  // are promoted to root level so they remain reachable.
  const { roots, childrenByParent } = useMemo(() => {
    const ids = new Set(items.map((i) => i.id))
    const map: Record<string, ChecklistItem[]> = {}
    const rootList: ChecklistItem[] = []
    for (const item of items) {
      if (item.parentId && ids.has(item.parentId)) {
        map[item.parentId] = map[item.parentId] ?? []
        map[item.parentId].push(item)
      } else {
        rootList.push(item)
      }
    }
    return { roots: rootList, childrenByParent: map }
  }, [items])

  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const toggleExpand = (id: string) =>
    setExpanded((current) => {
      const next = new Set(current)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })

  const grouped = roots.reduce<Record<string, ChecklistItem[]>>((acc, item) => {
    const key = item.category || 'Uncategorized'
    acc[key] = acc[key] ?? []
    acc[key].push(item)
    return acc
  }, {})

  const hasAnySets = Object.keys(childrenByParent).length > 0

  const expandAll = () => setExpanded(new Set(Object.keys(childrenByParent)))
  const collapseAll = () => setExpanded(new Set())

  const QtyBadge = ({ item }: { item: ChecklistItem }) => {
    if (!item.qty || item.qty <= 1) return null
    if (onQtyChange && item.checked) {
      return (
        <input
          type="number"
          min={1}
          max={999}
          value={item.qty}
          onChange={(event) => onQtyChange(item.id, Number(event.target.value))}
          className="w-14 rounded border border-slate-700 bg-slate-900 px-1 py-0.5 text-right text-xs"
          aria-label="Quantity"
          title="How many to add"
        />
      )
    }
    return (
      <span className="rounded bg-slate-700/60 px-1.5 py-0.5 text-[10px] text-slate-400" title="Stückzahl im Rentman-Projekt">
        ×{item.qty}
      </span>
    )
  }

  return (
    <div className="max-h-72 space-y-3 overflow-auto rounded border border-slate-700 p-2 text-sm">
      {(onSetAll || hasAnySets) && (
        <div className="flex flex-wrap gap-2 border-b border-slate-700 pb-2 text-xs">
          {onSetAll && (
            <>
              <button
                type="button"
                onClick={() => onSetAll(true)}
                className="rounded bg-slate-700 px-2 py-1 hover:bg-slate-600"
              >
                Select All
              </button>
              <button
                type="button"
                onClick={() => onSetAll(false)}
                className="rounded bg-slate-700 px-2 py-1 hover:bg-slate-600"
              >
                Unselect All
              </button>
            </>
          )}
          {hasAnySets && (
            <>
              <button
                type="button"
                onClick={expandAll}
                className="rounded bg-slate-700 px-2 py-1 hover:bg-slate-600"
              >
                Expand sets
              </button>
              <button
                type="button"
                onClick={collapseAll}
                className="rounded bg-slate-700 px-2 py-1 hover:bg-slate-600"
              >
                Collapse sets
              </button>
            </>
          )}
        </div>
      )}
      {Object.entries(grouped).map(([category, categoryItems]) => (
        <div key={category}>
          <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-300">{category}</div>
          <div className="space-y-1">
            {categoryItems.map((item) => {
              const children = childrenByParent[item.id]
              const isSet = Boolean(children && children.length > 0)
              const isOpen = expanded.has(item.id)
              const allChildrenChecked = isSet && children!.every((c) => c.checked)
              return (
                <div key={item.id}>
                  <div className="flex items-center gap-2">
                    {isSet ? (
                      <button
                        type="button"
                        onClick={() => toggleExpand(item.id)}
                        className="w-5 rounded bg-slate-800 text-[10px] leading-none hover:bg-slate-700"
                        aria-label={isOpen ? 'Collapse set' : 'Expand set'}
                        title={isOpen ? 'Collapse set' : 'Expand set'}
                      >
                        {isOpen ? '▾' : '▸'}
                      </button>
                    ) : (
                      <span className="w-5" />
                    )}
                    <label className="flex flex-1 items-center gap-2">
                      <input
                        type="checkbox"
                        checked={item.checked}
                        onChange={() => onToggle(item.id)}
                      />
                      <span className="flex-1">
                        {item.name}
                        {isSet && (
                          <span className="ml-1 text-[10px] text-slate-400">[set · {children!.length}]</span>
                        )}
                        {item.templateMatch && (
                          <span
                            className="ml-2 rounded bg-emerald-800/60 px-1.5 py-0.5 text-[10px] font-medium text-emerald-200"
                            title={`Wird automatisch mit Vorlage "${item.templateMatch}" befüllt`}
                          >
                            ✓ {item.templateMatch}
                          </span>
                        )}
                      </span>
                    </label>
                    <QtyBadge item={item} />
                    {isSet && isOpen && onSetAllChildren && (
                      <button
                        type="button"
                        onClick={() => onSetAllChildren(item.id, !allChildrenChecked)}
                        className="rounded bg-slate-700 px-1.5 py-0.5 text-[10px] hover:bg-slate-600"
                        title={allChildrenChecked ? 'Alle Kinder abwählen' : 'Alle Kinder auswählen'}
                      >
                        {allChildrenChecked ? '☐ alle' : '☑ alle'}
                      </button>
                    )}
                  </div>
                  {isSet && isOpen && (
                    <div className="ml-6 mt-1 space-y-1 border-l border-slate-800 pl-2">
                      {children!.map((child) => (
                        <label key={child.id} className="flex items-center gap-2 text-slate-300">
                          <input
                            type="checkbox"
                            checked={child.checked}
                            onChange={() => onToggle(child.id)}
                          />
                          <span className="flex-1">{child.name}</span>
                          <QtyBadge item={child} />
                        </label>
                      ))}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      ))}
    </div>
  )
}
