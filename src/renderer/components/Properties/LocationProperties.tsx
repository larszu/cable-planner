import { ClipboardList } from 'lucide-react'
import { useCanvasProjectStore as useProjectStore } from '../../store/projectStoreContext'
import { useUiStore } from '../../store/uiStore'
import { confirmDialog } from '../../lib/confirmDialog'
import { format, useTranslation } from '../../lib/i18n'
import { ColorField } from '../shared/ColorField'
import { Icon } from '../shared/Icon'
import { PanelHint } from '../shared/PanelHint'

export const LocationProperties = () => {
  const t = useTranslation()
  const selectedId = useProjectStore((state) => state.selectedLocationId)
  const location = useProjectStore((state) =>
    (state.project.locations ?? []).find((l) => l.id === selectedId),
  )
  const updateLocation = useProjectStore((state) => state.updateLocation)
  const deleteLocation = useProjectStore((state) => state.deleteLocation)
  const deleteLocationWithContents = useProjectStore(
    (state) => state.deleteLocationWithContents,
  )
  const openLocationBom = useUiStore((state) => state.openLocationBom)

  if (!location) return null

  return (
    <div className="space-y-3 text-cp-xs">
      <div>
        <div className="mb-1 text-cp-xs uppercase tracking-wide text-cp-text-muted">
          {t('location.title', 'Location')}
        </div>
        <label className="block">
          {t('location.field.name', 'Name')}
          <input
            value={location.name}
            onChange={(e) => updateLocation(location.id, { name: e.target.value })}
            className="mt-1 w-full border border-cp-border bg-cp-surface-3 p-1.5"
          />
        </label>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <label className="block">
          {t('location.field.width', 'Width')}
          <input
            type="number"
            value={Math.round(location.width)}
            onChange={(e) =>
              updateLocation(location.id, { width: Math.max(40, Number(e.target.value) || 0) })
            }
            className="mt-1 w-full border border-cp-border bg-cp-surface-3 p-1.5"
          />
        </label>
        <label className="block">
          {t('location.field.height', 'Height')}
          <input
            type="number"
            value={Math.round(location.height)}
            onChange={(e) =>
              updateLocation(location.id, { height: Math.max(40, Number(e.target.value) || 0) })
            }
            className="mt-1 w-full border border-cp-border bg-cp-surface-3 p-1.5"
          />
        </label>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <label className="block">
          {t('location.field.floor', 'Floor')}
          <input
            value={location.floor ?? ''}
            placeholder={t('location.field.floorPlaceholder', 'e.g. ground floor, 1st')}
            onChange={(e) => updateLocation(location.id, { floor: e.target.value })}
            className="mt-1 w-full border border-cp-border bg-cp-surface-3 p-1.5"
          />
        </label>
        <ColorField
          label={t('location.field.color', 'Colour')}
          value={location.color}
          onChange={(color) => updateLocation(location.id, { color })}
        />
      </div>

      <div>
        <label className="block">
          {t('location.field.notes', 'Notes')}
          <textarea
            value={location.notes ?? ''}
            onChange={(e) => updateLocation(location.id, { notes: e.target.value })}
            rows={2}
            className="mt-1 w-full resize-y border border-cp-border bg-cp-surface-3 p-1.5"
          />
        </label>
      </div>

      {/* "Geräte beim Verschieben mitnehmen" is temporarily hidden while the
          group-drag selection logic is being reworked. The store field and the
          CanvasArea.onNodeDragStart implementation remain intact. */}

      <div className="space-y-2 pt-2">
        <button
          type="button"
          onClick={() => openLocationBom(location.id)}
          className="w-full bg-amber-700 px-2 py-1 text-cp-xs hover:bg-amber-600"
          title={t(
            'location.action.bomTitle',
            'List of devices and cables in the frame — exportable as PDF',
          )}
        >
          <Icon icon={ClipboardList} size="xs" className="mr-1 inline-block align-text-bottom" />
          {t('location.action.bom', 'Export BOM')}
        </button>
        <button
          type="button"
          onClick={async () => {
            if (
              await confirmDialog(
                format(t('location.confirm.deleteFrame', 'Delete frame "{name}"?'), {
                  name: location.name,
                }),
                {
                  body: t(
                    'location.confirm.deleteFrameBody',
                    'Devices inside stay on the canvas.',
                  ),
                  destructive: true,
                  okLabel: t('confirm.delete', 'Delete'),
                },
              )
            ) {
              deleteLocation(location.id)
            }
          }}
          className="w-full bg-cp-surface-4 px-2 py-1 text-cp-xs hover:bg-cp-surface-5"
          title={t(
            'location.action.deleteFrameTitle',
            'Removes only the frame — devices inside stay on the canvas.',
          )}
        >
          {t('location.action.deleteFrame', 'Delete frame only')}
        </button>
        <button
          type="button"
          onClick={async () => {
            if (
              await confirmDialog(
                format(
                  t('location.confirm.deleteAll', 'Delete frame "{name}" AND its contents?'),
                  { name: location.name },
                ),
                {
                  body: t(
                    'location.confirm.deleteAllBody',
                    'All devices in the frame and their cables are deleted as well.',
                  ),
                  destructive: true,
                  okLabel: t('confirm.deleteAll', 'Delete all'),
                },
              )
            ) {
              deleteLocationWithContents(location.id)
            }
          }}
          className="w-full bg-red-700 px-2 py-1 text-cp-xs hover:bg-red-600"
        >
          {t('location.action.deleteAll', 'Delete frame + contents')}
        </button>
      </div>

      <PanelHint
        className="text-cp-xs italic text-cp-text-muted"
        text={t(
          'location.tip',
          'Tip: the frame moves independently by default. Enable "Take devices along" to move all contained devices with the frame.',
        )}
      />
    </div>
  )
}
