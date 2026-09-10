import { Pencil, Download, X, Server} from 'lucide-react'
import { useProjectStore } from '../../../store/projectStore'
import { Icon } from '../../shared/Icon'
import { confirmDialog } from '../../../lib/confirmDialog'
import { exportPresetToFile } from '../../../lib/itemExport'
import { MIME_RACK_PRESET } from '../../../lib/dragDropMimes'
import { PresetDndWrapper } from '../LibraryDndWrappers'
import { SortablePresetCard } from '../LibrarySortables'
import { format, useTranslation } from '../../../lib/i18n'

interface RacksTabProps {
  onCreateRack: () => void
  onEditRack: (presetId: string) => void
}

/**
 * #305 — RacksTab aus LibraryPanel ausgelagert. Zeigt Rack-Group-Presets
 * (Geraete in HE-Slots) mit Drag&Drop-Sortierung, Klick-zum-Platzieren
 * als Black-Box und Edit/Export/Delete-Aktionen. Der RackBuilderDialog-
 * Trigger lebt im Parent (UI-State).
 */
export const RacksTab = ({ onCreateRack, onEditRack }: RacksTabProps) => {
  const t = useTranslation()
  const groupPresets = useProjectStore((s) => s.groupPresets)
  const reorderGroupPresets = useProjectStore((s) => s.reorderGroupPresets)
  const insertBlackBoxRack = useProjectStore((s) => s.insertBlackBoxRack)
  const deleteGroupPreset = useProjectStore((s) => s.deleteGroupPreset)
  const canvasState = useProjectStore((s) => s.project.canvasState)

  return (
    <div className="flex flex-1 min-h-0 flex-col">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-y-1 gap-x-2">
        <div className="min-w-0">
          <h2 className="text-cp-base font-semibold">{t('library.tabs.racks.title', '2D Rack Builder')}</h2>
          <div className="text-cp-xs text-cp-text-muted">
            {t('library.tabs.racks.subtitle', 'Rack slots in RU, saved as a placeable group')}
          </div>
        </div>
        <button
          type="button"
          onClick={onCreateRack}
          className="rounded bg-emerald-700 px-2 py-1 text-cp-xs hover:bg-emerald-600"
        >
          {t('library.tabs.racks.new', '+ New rack')}
        </button>
      </div>

      {groupPresets.filter((preset) => !!preset.rack).length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center gap-2 text-cp-xs text-cp-text-faint text-center p-4">
          <Icon icon={Server} size="xl" />
          <span>{t('library.tabs.racks.empty', 'No rack layout saved yet.')}</span>
        </div>
      ) : (
        (() => {
          const rackPresets = groupPresets.filter((preset) => !!preset.rack)
          const rackIds = rackPresets.map((p) => p.id)
          return (
            <div className="flex-1 min-h-0 space-y-2 overflow-auto">
              <PresetDndWrapper
                ids={rackIds}
                onReorder={(newIds) => {
                  const nonRackIds = groupPresets.filter((p) => !p.rack).map((p) => p.id)
                  reorderGroupPresets([...nonRackIds, ...newIds])
                }}
              >
                {rackPresets.map((preset) => {
                  const zoom = canvasState.zoom || 1
                  const cx = (-canvasState.x + 400) / zoom
                  const cy = (-canvasState.y + 250) / zoom
                  const totalUnits =
                    preset.rack?.totalUnits ??
                    preset.items.reduce((sum, item) => sum + (item.rackUnits ?? 1), 0)
                  return (
                    <SortablePresetCard
                      key={preset.id}
                      id={preset.id}
                      nativeDragData={{
                        mime: MIME_RACK_PRESET,
                        data: preset.id,
                      }}
                      onCardClick={() => insertBlackBoxRack(preset.id, cx, cy)}
                      clickTitle={t(
                        'library.tabs.racks.clickTitle',
                        'Click = place as black box on canvas · Drag&Drop = place at drop position',
                      )}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <div className="truncate font-medium text-cp-text">{preset.name}</div>
                          <div className="mt-0.5 text-cp-xs text-cp-text-muted">
                            {format(t('library.tabs.racks.counts', '{items} devices · {units} RU · {cables} cables'), {
                              items: preset.items.length,
                              units: totalUnits,
                              cables: preset.cables.length,
                            })}
                          </div>
                          <div className="mt-0.5 truncate text-cp-xs text-cp-text-muted">
                            {preset.items.map((i) => i.name).join(', ')}
                          </div>
                        </div>
                        {/* v7.9.16 — Hover-Actions wie bei LibraryItem:
                            Edit (✎) und Delete (×) als kleine Icon-Buttons,
                            erscheinen erst beim Hover. Platzieren passiert
                            durch Click auf den Card-Body. */}
                        <div className="flex shrink-0 gap-0.5 cp-hover-actions">
                          <button
                            type="button"
                            onClick={(event) => {
                              event.stopPropagation()
                              onEditRack(preset.id)
                            }}
                            className="rounded bg-cp-surface-4 px-1 py-0.5 text-cp-xs hover:bg-cp-surface-5"
                            title={t('library.tabs.racks.editTitle', 'Edit in the 2D rack builder')}
                            aria-label={t('library.tabs.racks.editAria', 'Edit')}
                          >
                            <Icon icon={Pencil} size="xs" />
                          </button>
                          <button
                            type="button"
                            onClick={(event) => {
                              event.stopPropagation()
                              void exportPresetToFile(preset)
                            }}
                            className="rounded bg-cp-surface-4 px-1 py-0.5 text-cp-xs text-cp-text-secondary hover:bg-cp-surface-5"
                            title={t(
                              'library.tabs.racks.exportTitle',
                              'Export as file (copy to Downloads folder)',
                            )}
                            aria-label={t('library.tabs.racks.exportAria', 'Export')}
                          >
                            <Icon icon={Download} size="xs" />
                          </button>
                          <button
                            type="button"
                            onClick={async (event) => {
                              event.stopPropagation()
                              if (
                                await confirmDialog(
                                  format(t('library.tabs.racks.confirmDelete', 'Delete rack "{name}"?'), {
                                    name: preset.name,
                                  }),
                                  {
                                    destructive: true,
                                    okLabel: t('common.delete', 'Delete'),
                                  },
                                )
                              ) {
                                deleteGroupPreset(preset.id)
                              }
                            }}
                            className="rounded bg-red-700 px-1 text-cp-xs hover:bg-red-600"
                            title={t('library.tabs.racks.deleteTitle', 'Remove rack from library')}
                            aria-label={t('common.delete', 'Delete')}
                          >
                            <Icon icon={X} size="xs" />
                          </button>
                        </div>
                      </div>
                    </SortablePresetCard>
                  )
                })}
              </PresetDndWrapper>
            </div>
          )
        })()
      )}
    </div>
  )
}
