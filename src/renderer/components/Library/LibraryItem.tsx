import type { EquipmentTemplate } from '../../types/equipment'
import { Star, Link, Eye, EyeOff, Download } from 'lucide-react'
import { Icon } from '../shared/Icon'
import { Tooltip } from '../shared/Tooltip'
import { useProjectStore } from '../../store/projectStore'
import { clearCanvasSelection } from '../../lib/canvasViewport'
import { stampDeviceLibraryRef } from '../../lib/librarySync'
import { MIME_EQUIPMENT } from '../../lib/dragDropMimes'
import { format, useTranslation } from '../../lib/i18n'

interface LibraryItemProps {
  item: EquipmentTemplate
  onAdd: () => void
  onRemove?: () => void
  onToggleFavorite?: () => void
  onToggleHidden?: () => void
  onExport?: () => void
  /** v7.9.106 / Issue #227 — Rentman-Item ohne Ports + gleichnamiges
   *  lokales Item mit Ports → Aktion zum Verknuepfen/Sync. Wenn gesetzt
   *  erscheint ein 🔗-Button rechts. */
  onLinkPorts?: () => void
  /** Display-Name des Match-Targets fuer den Verknuepfen-Tooltip. */
  linkTargetName?: string
}

export const LibraryItem = ({
  item,
  onAdd,
  onRemove,
  onToggleFavorite,
  onToggleHidden,
  onExport,
  onLinkPorts,
  linkTargetName,
}: LibraryItemProps) => {
  const t = useTranslation()
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
      className={`group flex w-full cursor-grab items-start justify-between gap-2 rounded border ${accentClass} px-2 py-2 text-left text-cp-base active:cursor-grabbing ${
        item.hidden
          ? 'border-slate-800 bg-slate-950 opacity-60 hover:opacity-100'
          : 'border-slate-700 bg-slate-900 hover:bg-slate-800'
      }`}
      title={
        isFromActiveRentman
          ? format(
              t(
                'library.item.titleActiveRentman',
                'Aus aktivem Rentman-Projekt{suffix} — Klick oder Drag & Drop auf den Canvas',
              ),
              { suffix: item.rentmanProjectName ? ` "${item.rentmanProjectName}"` : '' },
            )
          : isFromOtherRentman
            ? format(
                t(
                  'library.item.titleOtherRentman',
                  'Aus Rentman-Projekt{suffix} — Klick oder Drag & Drop auf den Canvas',
                ),
                { suffix: item.rentmanProjectName ? ` "${item.rentmanProjectName}"` : '' },
              )
            : t('library.item.titleLocal', 'Lokales Gerät — Klick oder Drag & Drop auf den Canvas')
      }
    >
      <div className="min-w-0 flex-1">
        <div className="truncate font-medium">
          {item.favorite && (
            <span className="mr-1 inline-flex text-amber-300">
              <Icon icon={Star} size="xs" className="fill-current" />
            </span>
          )}
          {isFromActiveRentman && (
            <span
              className="mr-1 rounded bg-orange-600 px-1 text-[11px] font-bold text-white"
              title={format(
                t('library.item.badgeActiveRentman', 'Aus aktivem Rentman-Projekt{suffix}'),
                { suffix: item.rentmanProjectName ? `: ${item.rentmanProjectName}` : '' },
              )}
            >
              R
            </span>
          )}
          {isFromOtherRentman && (
            <span
              className="mr-1 rounded bg-slate-600 px-1 text-[11px] font-bold text-slate-200"
              title={format(
                t('library.item.badgeOtherRentman', 'Aus Rentman-Projekt{suffix}'),
                { suffix: item.rentmanProjectName ? `: ${item.rentmanProjectName}` : '' },
              )}
            >
              R
            </span>
          )}
          {!item.rentmanSource && (
            <span
              className="mr-1 rounded bg-sky-800/80 px-1 text-[11px] font-bold text-sky-100"
              title={t('library.item.badgeLocal', 'Lokales Gerät (nicht aus Rentman)')}
            >
              L
            </span>
          )}
          {item.name}
        </div>
        <div className="truncate text-cp-xs text-slate-400">
          {item.category} · {item.inputs.length} in / {item.outputs.length} out
          {isFromOtherRentman && item.rentmanProjectName && (
            <span className="ml-1 text-slate-500">· {item.rentmanProjectName}</span>
          )}
        </div>
      </div>
      <div className="flex gap-0.5 opacity-0 transition group-hover:opacity-100 group-focus-within:opacity-100">
        {onToggleFavorite && (
          <Tooltip
            label={
              item.favorite
                ? t('library.item.unfavorite', 'Favorit entfernen')
                : t('library.item.favorite', 'Als Favorit markieren')
            }
          >
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
              aria-label={
                item.favorite
                  ? t('library.item.unfavorite', 'Favorit entfernen')
                  : t('library.item.favorite', 'Als Favorit markieren')
              }
            >
              <Icon icon={Star} size="xs" className={item.favorite ? 'fill-current' : ''} />
            </button>
          </Tooltip>
        )}
        {onToggleHidden && (
          <Tooltip
            label={
              item.hidden
                ? t('library.item.show', 'Wieder anzeigen')
                : t('library.item.hide', 'Ausblenden')
            }
          >
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
              aria-label={
                item.hidden
                  ? t('library.item.show', 'Wieder anzeigen')
                  : t('library.item.hide', 'Ausblenden')
              }
            >
              <Icon icon={item.hidden ? Eye : EyeOff} size="xs" />
            </button>
          </Tooltip>
        )}
        {onExport && (
          <Tooltip
            label={t(
              'library.item.exportTitle',
              'Als Datei exportieren (Kopie in den Downloads-Ordner)',
            )}
          >
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation()
                onExport()
              }}
              className="rounded bg-slate-700 px-1 text-[11px] text-slate-300 hover:bg-slate-600"
              aria-label={t('library.item.exportAria', 'Exportieren')}
            >
              <Icon icon={Download} size="xs" />
            </button>
          </Tooltip>
        )}
        {onLinkPorts && (
          <Tooltip
            label={
              linkTargetName
                ? format(
                    t(
                      'library.item.linkNamed',
                      'Mit lokalem Geraet "{name}" verknuepfen (Ports uebernehmen)',
                    ),
                    { name: linkTargetName },
                  )
                : t(
                    'library.item.linkSameName',
                    'Mit gleichnamigem lokalem Geraet verknuepfen (Ports uebernehmen)',
                  )
            }
          >
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation()
                onLinkPorts()
              }}
              className="rounded bg-emerald-700 px-1 text-[11px] text-emerald-100 hover:bg-emerald-600"
              aria-label={t('library.item.linkAria', 'Verknuepfen')}
            >
              <Icon icon={Link} size="xs" />
            </button>
          </Tooltip>
        )}
        {onRemove && (
          <Tooltip label={t('library.item.removeTitle', 'Remove from library')}>
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation()
                onRemove()
              }}
              className="rounded bg-red-700 px-1 text-[10px] hover:bg-red-600"
              aria-label={t('library.item.removeTitle', 'Remove from library')}
            >
              ×
            </button>
          </Tooltip>
        )}
      </div>
    </div>
  )
}
