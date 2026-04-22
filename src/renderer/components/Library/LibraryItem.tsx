import type { EquipmentTemplate } from '../../types/equipment'

interface LibraryItemProps {
  item: EquipmentTemplate
  onAdd: () => void
  onRemove?: () => void
}

export const LibraryItem = ({ item, onAdd, onRemove }: LibraryItemProps) => {
  const onDragStart = (event: React.DragEvent<HTMLDivElement>) => {
    const payload = JSON.stringify(item)
    event.dataTransfer.setData('application/cable-planner-equipment', payload)
    event.dataTransfer.effectAllowed = 'copy'
  }

  return (
    <div
      draggable
      onDragStart={onDragStart}
      onClick={onAdd}
      role="button"
      tabIndex={0}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault()
          onAdd()
        }
      }}
      className="group flex w-full cursor-grab items-start justify-between gap-2 rounded border border-slate-700 bg-slate-900 px-2 py-2 text-left text-sm hover:bg-slate-800 active:cursor-grabbing"
      title="Drag onto canvas or click to add"
    >
      <div className="min-w-0 flex-1">
        <div className="truncate font-medium">{item.name}</div>
        <div className="truncate text-xs text-slate-400">
          {item.category} · {item.inputs.length} in / {item.outputs.length} out
        </div>
      </div>
      {onRemove && (
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation()
            onRemove()
          }}
          className="opacity-0 group-hover:opacity-100 rounded bg-red-700 px-1 text-[10px] hover:bg-red-600"
          title="Remove from library"
        >
          ×
        </button>
      )}
    </div>
  )
}
