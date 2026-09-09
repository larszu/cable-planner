import { useProjectStore } from '../../../store/projectStore'
import { confirmDialog } from '../../../lib/confirmDialog'
import { exportPresetToFile } from '../../../lib/itemExport'
import { MIME_GROUP_PRESET } from '../../../lib/dragDropMimes'
import { PresetDndWrapper } from '../LibraryDndWrappers'
import { SortablePresetCard } from '../LibrarySortables'
import { format, useTranslation } from '../../../lib/i18n'
import { promptDialog } from '../../../lib/promptDialog'
import { Download, Pencil } from 'lucide-react'
import { Icon } from '../../shared/Icon'

/**
 * #305 — GroupsTab aus LibraryPanel ausgelagert. Zeigt nicht-Rack-
 * Gruppen-Presets (Items + Cables-Bündel) mit Drag&Drop-Sortierung,
 * Klick-zum-Platzieren und Export/Loeschen-Aktionen.
 */
export const GroupsTab = () => {
  const t = useTranslation()
  const groupPresets = useProjectStore((s) => s.groupPresets)
  const reorderGroupPresets = useProjectStore((s) => s.reorderGroupPresets)
  const placeGroupPreset = useProjectStore((s) => s.placeGroupPreset)
  const deleteGroupPreset = useProjectStore((s) => s.deleteGroupPreset)
  const renameGroupPreset = useProjectStore((s) => s.renameGroupPreset)
  const canvasState = useProjectStore((s) => s.project.canvasState)

  return (
    <div className="flex flex-1 min-h-0 flex-col">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-y-1 gap-x-2">
        <h2 className="text-cp-base font-semibold">{t('library.tabs.groups.title', 'Device groups')}</h2>
        <span className="text-[10px] text-cp-text-muted">
          {t('library.tabs.groups.subtitle', 'Multiple devices + cables as a template')}
        </span>
      </div>
      {groupPresets.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center gap-2 text-cp-xs text-cp-text-faint text-center p-4">
          <span className="text-2xl">⧉</span>
          <span>{t('library.tabs.groups.empty', 'No groups saved yet.')}</span>
          <span>
            {t('library.tabs.groups.hint1', 'Select ≥ 2 devices on the canvas and click')}{' '}
            <b>{t('library.tabs.groups.hintBtn', 'As group')}</b>{' '}
            {t('library.tabs.groups.hint2', 'in the canvas toolbar.')}
          </span>
        </div>
      ) : (
        (() => {
          const nonRackPresets = groupPresets.filter((p) => !p.rack)
          const nonRackIds = nonRackPresets.map((p) => p.id)
          return (
            <div className="flex-1 min-h-0 space-y-2 overflow-auto">
              <PresetDndWrapper
                ids={nonRackIds}
                onReorder={(newIds) => {
                  const rackIds = groupPresets.filter((p) => !!p.rack).map((p) => p.id)
                  reorderGroupPresets([...newIds, ...rackIds])
                }}
              >
                {nonRackPresets.map((preset) => {
                  const zoom = canvasState.zoom || 1
                  const cx = (-canvasState.x + 400) / zoom
                  const cy = (-canvasState.y + 250) / zoom
                  const totalRackUnits = preset.items.reduce(
                    (sum, item) => sum + (item.rackUnits ?? 0),
                    0,
                  )
                  return (
                    <SortablePresetCard
                      key={preset.id}
                      id={preset.id}
                      nativeDragData={{
                        mime: MIME_GROUP_PRESET,
                        data: preset.id,
                      }}
                      onCardClick={() => placeGroupPreset(preset.id, cx, cy)}
                      clickTitle={t(
                        'library.tabs.groups.clickTitle',
                        'Click = place on canvas · Drag&Drop = place at drop position',
                      )}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <div className="truncate font-medium text-cp-text">{preset.name}</div>
                          <div className="mt-0.5 text-[10px] text-cp-text-muted">
                            {format(t('library.tabs.groups.counts', '{items} devices · {cables} cables'), {
                              items: preset.items.length,
                              cables: preset.cables.length,
                            })}
                            {totalRackUnits > 0
                              ? format(t('library.tabs.groups.rackUnits', ' · {n} RU'), {
                                  n: totalRackUnits,
                                })
                              : ''}
                          </div>
                          <div className="mt-0.5 truncate text-[10px] text-cp-text-muted">
                            {preset.items.map((i) => i.name).join(', ')}
                          </div>
                        </div>
                        <div className="flex shrink-0 gap-0.5 cp-hover-actions">
                          {/* #425 — Inline-Rename. Duplikat-Check verhindert
                              dass zwei Vorlagen denselben Namen tragen. */}
                          <button
                            type="button"
                            onClick={async (event) => {
                              event.stopPropagation()
                              const newName = await promptDialog(
                                t('library.tabs.groups.renamePrompt', 'New template name:'),
                                preset.name,
                              )
                              if (!newName) return
                              const trimmed = newName.trim()
                              if (!trimmed || trimmed === preset.name) return
                              const lower = trimmed.toLowerCase()
                              const conflict = groupPresets.some(
                                (p) =>
                                  p.id !== preset.id &&
                                  p.name.trim().toLowerCase() === lower,
                              )
                              if (conflict) {
                                await confirmDialog(
                                  format(
                                    t(
                                      'library.tabs.groups.renameConflict',
                                      'A template named "{name}" already exists. Please choose a different name.',
                                    ),
                                    { name: trimmed },
                                  ),
                                  { okLabel: t('common.ok', 'OK') },
                                )
                                return
                              }
                              renameGroupPreset(preset.id, trimmed)
                            }}
                            className="rounded bg-cp-surface-4 px-1 text-[11px] text-cp-text-secondary hover:bg-cp-surface-5"
                            title={t('library.tabs.groups.renameTitle', 'Rename template')}
                            aria-label={t('library.tabs.groups.renameAria', 'Rename')}
                          >
                            <Icon icon={Pencil} size="xs" />
                          </button>
                          <button
                            type="button"
                            onClick={(event) => {
                              event.stopPropagation()
                              void exportPresetToFile(preset)
                            }}
                            className="rounded bg-cp-surface-4 px-1 text-[11px] text-cp-text-secondary hover:bg-cp-surface-5"
                            title={t(
                              'library.tabs.groups.exportTitle',
                              'Export as file (copy to Downloads folder)',
                            )}
                            aria-label={t('library.tabs.groups.exportAria', 'Export')}
                          >
                            <Icon icon={Download} size="xs" />
                          </button>
                          <button
                            type="button"
                            onClick={async (event) => {
                              event.stopPropagation()
                              if (
                                await confirmDialog(
                                  format(t('library.tabs.groups.confirmDelete', 'Delete group "{name}"?'), {
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
                            className="rounded bg-red-700 px-1 text-[10px] hover:bg-red-600"
                            title={t('library.tabs.groups.deleteTitle', 'Remove group from library')}
                            aria-label={t('common.delete', 'Delete')}
                          >
                            ×
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
