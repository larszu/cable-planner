import type { EquipmentTemplate } from '../../types/equipment'

interface LibraryItemProps {
  item: EquipmentTemplate
  onAdd: () => void
  onRemove?: () => void
  onToggleFavorite?: () => void
  onToggleHidden?: () => void
}

export const LibraryItem = ({
  item,
  onAdd,
  onRemove,
  onToggleFavorite,
  onToggleHidden,
}: LibraryItemProps) => {
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
      className={`group flex w-full cursor-grab items-start justify-between gap-2 rounded border px-2 py-2 text-left text-sm active:cursor-grabbing ${
        item.hidden
          ? 'border-slate-800 bg-slate-950 opacity-60 hover:opacity-100'
          : 'border-slate-700 bg-slate-900 hover:bg-slate-800'
      }`}
      title="Drag onto canvas or click to add"
    >
      <div className="min-w-0 flex-1">
        <div className="truncate font-medium">
          {item.favorite && <span className="mr-1 text-amber-300">★</span>}
          {item.rentmanSource && (
            <span className="mr-1 rounded bg-orange-700 px-1 text-[9px] font-bold text-white" title="Aus Rentman importiert">R</span>
          )}
          {item.name}
        </div>
        <div className="truncate text-xs text-slate-400">
          {item.category} · {item.inputs.length} in / {item.outputs.length} out
        </div>
      </div>
      <div className="flex gap-0.5 opacity-0 transition group-hover:opacity-100">
        {onToggleFavorite && (
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation()
              onToggleFavorite()
            }}
            className={`rounded px-1 text-[11px] ${
              item.favorite
                ? 'bg-amber-700 text-amber-100 hover:bg-amber-600'
                : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
            }`}
            title={item.favorite ? 'Favorit entfernen' : 'Als Favorit markieren'}
          >
            ★
          </button>
        )}
        {onToggleHidden && (
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation()
              onToggleHidden()
            }}
            className={`rounded px-1 text-[11px] ${
              item.hidden
                ? 'bg-slate-600 text-slate-200 hover:bg-slate-500'
                : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
            }`}
            title={item.hidden ? 'Wieder anzeigen' : 'Ausblenden'}
          >
            {item.hidden ? '◎' : '⦸'}
          </button>
        )}
        {onRemove && (
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation()
              onRemove()
            }}
            className="rounded bg-red-700 px-1 text-[10px] hover:bg-red-600"
            title="Remove from library"
          >
            ×
          </button>
        )}
      </div>
    </div>
  )
}
