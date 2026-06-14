import { Pencil, Download, X } from 'lucide-react'
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
          <div className="text-[10px] text-cp-text-muted">
            {t('library.tabs.racks.subtitle', 'Rack-Slots in HE, als platzierbare Gruppe gespeichert')}
          </div>
        </div>
        <button
          type="button"
          onClick={onCreateRack}
          className="rounded bg-emerald-700 px-2 py-1 text-cp-xs hover:bg-emerald-600"
        >
          {t('library.tabs.racks.new', '+ Neues Rack')}
        </button>
      </div>

      {groupPresets.filter((preset) => !!preset.rack).length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center gap-2 text-cp-xs text-cp-text-faint text-center p-4">
          <span className="text-2xl">▥</span>
          <span>{t('library.tabs.racks.empty', 'Noch kein Rack-Layout gespeichert.')}</span>
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
                        'Klick = als Black-Box auf Canvas platzieren · Drag&Drop = an Drop-Position platzieren',
                      )}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <div className="truncate font-medium text-cp-text">{preset.name}</div>
                          <div className="mt-0.5 text-[10px] text-cp-text-muted">
                            {format(t('library.tabs.racks.counts', '{items} Geräte · {units} HE · {cables} Kabel'), {
                              items: preset.items.length,
                              units: totalUnits,
                              cables: preset.cables.length,
                            })}
                          </div>
                          <div className="mt-0.5 truncate text-[10px] text-cp-text-muted">
                            {preset.items.map((i) => i.name).join(', ')}
                          </div>
                        </div>
                        {/* v7.9.16 — Hover-Actions wie bei LibraryItem:
                            Edit (✎) und Delete (×) als kleine Icon-Buttons,
                            erscheinen erst beim Hover. Platzieren passiert
                            durch Click auf den Card-Body. */}
                        <div className="flex shrink-0 gap-0.5 opacity-0 transition group-hover:opacity-100 group-focus-within:opacity-100">
                          <button
                            type="button"
                            onClick={(event) => {
                              event.stopPropagation()
                              onEditRack(preset.id)
                            }}
                            className="rounded bg-cp-surface-4 px-1 py-0.5 text-[11px] hover:bg-cp-surface-5"
                            title={t('library.tabs.racks.editTitle', 'Im 2D-Rack-Builder bearbeiten')}
                            aria-label={t('library.tabs.racks.editAria', 'Bearbeiten')}
                          >
                            <Icon icon={Pencil} size="xs" />
                          </button>
                          <button
                            type="button"
                            onClick={(event) => {
                              event.stopPropagation()
                              exportPresetToFile(preset)
                            }}
                            className="rounded bg-cp-surface-4 px-1 py-0.5 text-[11px] text-cp-text-secondary hover:bg-cp-surface-5"
                            title={t(
                              'library.tabs.racks.exportTitle',
                              'Als Datei exportieren (Kopie in den Downloads-Ordner)',
                            )}
                            aria-label={t('library.tabs.racks.exportAria', 'Exportieren')}
                          >
                            <Icon icon={Download} size="xs" />
                          </button>
                          <button
                            type="button"
                            onClick={async (event) => {
                              event.stopPropagation()
                              if (
                                await confirmDialog(
                                  format(t('library.tabs.racks.confirmDelete', 'Rack "{name}" löschen?'), {
                                    name: preset.name,
                                  }),
                                  {
                                    destructive: true,
                                    okLabel: t('common.delete', 'Löschen'),
                                  },
                                )
                              ) {
                                deleteGroupPreset(preset.id)
                              }
                            }}
                            className="rounded bg-red-700 px-1 text-[10px] hover:bg-red-600"
                            title={t('library.tabs.racks.deleteTitle', 'Rack aus Library entfernen')}
                            aria-label={t('common.delete', 'Löschen')}
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
