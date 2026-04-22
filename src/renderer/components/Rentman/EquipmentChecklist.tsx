interface ChecklistItem {
  id: string
  name: string
  category: string
  checked: boolean
}

interface EquipmentChecklistProps {
  items: ChecklistItem[]
  onToggle: (id: string) => void
}

export const EquipmentChecklist = ({ items, onToggle }: EquipmentChecklistProps) => {
  const grouped = items.reduce<Record<string, ChecklistItem[]>>((acc, item) => {
    const key = item.category || 'Uncategorized'
    acc[key] = acc[key] ?? []
    acc[key].push(item)
    return acc
  }, {})

  return (
    <div className="max-h-72 space-y-3 overflow-auto rounded border border-slate-700 p-2 text-sm">
      {Object.entries(grouped).map(([category, categoryItems]) => (
        <div key={category}>
          <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-300">{category}</div>
          <div className="space-y-1">
            {categoryItems.map((item) => (
              <label key={item.id} className="flex items-center gap-2">
                <input type="checkbox" checked={item.checked} onChange={() => onToggle(item.id)} />
                <span>{item.name}</span>
              </label>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}
