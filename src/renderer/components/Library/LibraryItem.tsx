import type { EquipmentTemplate } from '../../types/equipment'
import { useProjectStore } from '../../store/projectStore'
import { clearCanvasSelection } from '../../lib/canvasViewport'
import { stampDeviceLibraryRef } from '../../lib/librarySync'
import { MIME_EQUIPMENT } from '../../lib/dragDropMimes'

interface LibraryItemProps {
  item: EquipmentTemplate
  onAdd: () => void
  onRemove?: () => void
  onToggleFavorite?: () => void
  onToggleHidden?: () => void
  onExport?: () => void
}

export const LibraryItem = ({
  item,
  onAdd,
  onRemove,
  onToggleFavorite,
  onToggleHidden,
  onExport,
}: LibraryItemProps) => {
  // Currently linked Rentman project — used to colour-code rentman badges
  // so users can distinguish "from active Rentman project" vs "from another
  // Rentman project" vs "purely local" at a glance.
  const linkedRentmanProjectId = useProjectStore(
    (state) => state.project.metadata.rentmanProjectId,
  )

  const onDragStart = (event: React.DragEvent<HTMLDivElement>) => {
    clearCanvasSelection()
    // v7.9.33 — Stempelt den aktuellen Library-File-Stand auf das
    // platzierte Gerät. Update-Prompt beim Projekt-Öffnen vergleicht
    // gegen den dann aktuellen Folder-Stand.
    const payload = JSON.stringify(stampDeviceLibraryRef(item))
    event.dataTransfer.setData(MIME_EQUIPMENT, payload)
    event.dataTransfer.effectAllowed = 'copy'
  }

  const addFromClick = () => {
    clearCanvasSelection()
    onAdd()
  }

  const isFromActiveRentman =
    !!item.rentmanSource &&
    !!linkedRentmanProjectId &&
    item.rentmanSource === linkedRentmanProjectId
  const isFromOtherRentman = !!item.rentmanSource && !isFromActiveRentman

  // Left-edge accent strip lets the user see the source at a glance even
  // when the item is in a deep accordion.
  const accentClass = isFromActiveRentman
    ? 'border-l-2 border-l-orange-500'
    : isFromOtherRentman
      ? 'border-l-2 border-l-slate-500'
      : 'border-l-2 border-l-sky-700/60'

  return (
    <div
      draggable
      onDragStart={onDragStart}
      onClick={(event) => {
        event.stopPropagation()
        addFromClick()
      }}
      role="button"
      tabIndex={0}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault()
          addFromClick()
        }
      }}
      className={`group flex w-full cursor-grab items-start justify-between gap-2 rounded border ${accentClass} px-2 py-2 text-left text-sm active:cursor-grabbing ${
        item.hidden
          ? 'border-slate-800 bg-slate-950 opacity-60 hover:opacity-100'
          : 'border-slate-700 bg-slate-900 hover:bg-slate-800'
      }`}
      title={
        isFromActiveRentman
          ? `Aus aktivem Rentman-Projekt${item.rentmanProjectName ? ` "${item.rentmanProjectName}"` : ''} — Klick oder Drag & Drop auf den Canvas`
          : isFromOtherRentman
            ? `Aus Rentman-Projekt${item.rentmanProjectName ? ` "${item.rentmanProjectName}"` : ''} — Klick oder Drag & Drop auf den Canvas`
            : 'Lokales Gerät — Klick oder Drag & Drop auf den Canvas'
      }
    >
      <div className="min-w-0 flex-1">
        <div className="truncate font-medium">
          {item.favorite && <span className="mr-1 text-amber-300">★</span>}
          {isFromActiveRentman && (
            <span
              className="mr-1 rounded bg-orange-600 px-1 text-[9px] font-bold text-white"
              title={`Aus aktivem Rentman-Projekt${item.rentmanProjectName ? `: ${item.rentmanProjectName}` : ''}`}
            >
              R
            </span>
          )}
          {isFromOtherRentman && (
            <span
              className="mr-1 rounded bg-slate-600 px-1 text-[9px] font-bold text-slate-200"
              title={`Aus Rentman-Projekt${item.rentmanProjectName ? `: ${item.rentmanProjectName}` : ''}`}
            >
              R
            </span>
          )}
          {!item.rentmanSource && (
            <span
              className="mr-1 rounded bg-sky-800/80 px-1 text-[9px] font-bold text-sky-100"
              title="Lokales Gerät (nicht aus Rentman)"
            >
              L
            </span>
          )}
          {item.name}
        </div>
        <div className="truncate text-xs text-slate-400">
          {item.category} · {item.inputs.length} in / {item.outputs.length} out
          {isFromOtherRentman && item.rentmanProjectName && (
            <span className="ml-1 text-slate-500">· {item.rentmanProjectName}</span>
          )}
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
        {onExport && (
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation()
              onExport()
            }}
            className="rounded bg-slate-700 px-1 text-[11px] text-slate-300 hover:bg-slate-600"
            title="Als Datei exportieren (Kopie in den Downloads-Ordner)"
            aria-label="Exportieren"
          >
            ⬇
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
