import type { EquipmentItem } from '../../types/equipment'

interface LibraryItemProps {
  item: Omit<EquipmentItem, 'id' | 'x' | 'y'>
  onAdd: () => void
}

export const LibraryItem = ({ item, onAdd }: LibraryItemProps) => {
  return (
    <button
      type="button"
      onClick={onAdd}
      className="w-full rounded border border-slate-700 bg-slate-900 px-2 py-2 text-left text-sm hover:bg-slate-800"
    >
      <div className="font-medium">{item.name}</div>
      <div className="text-xs text-slate-400">{item.category}</div>
    </button>
  )
}
