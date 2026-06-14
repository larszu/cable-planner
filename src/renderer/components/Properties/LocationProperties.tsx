import { ClipboardList } from 'lucide-react'
import { useCanvasProjectStore as useProjectStore } from '../../store/projectStoreContext'
import { useUiStore } from '../../store/uiStore'
import { confirmDialog } from '../../lib/confirmDialog'
import { format, useTranslation } from '../../lib/i18n'
import { ColorField } from '../shared/ColorField'
import { Icon } from '../shared/Icon'

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
        <div className="mb-1 text-[11px] uppercase tracking-wide text-cp-text-muted">
          {t('location.title', 'Location')}
        </div>
        <label className="block">
          {t('location.field.name', 'Name')}
          <input
            value={location.name}
            onChange={(e) => updateLocation(location.id, { name: e.target.value })}
            className="mt-1 w-full rounded border border-cp-border bg-cp-surface-3 p-1.5"
          />
        </label>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <label className="block">
          {t('location.field.width', 'Breite')}
          <input
            type="number"
            value={Math.round(location.width)}
            onChange={(e) =>
              updateLocation(location.id, { width: Math.max(40, Number(e.target.value) || 0) })
            }
            className="mt-1 w-full rounded border border-cp-border bg-cp-surface-3 p-1.5"
          />
        </label>
        <label className="block">
          {t('location.field.height', 'Höhe')}
          <input
            type="number"
            value={Math.round(location.height)}
            onChange={(e) =>
              updateLocation(location.id, { height: Math.max(40, Number(e.target.value) || 0) })
            }
            className="mt-1 w-full rounded border border-cp-border bg-cp-surface-3 p-1.5"
          />
        </label>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <label className="block">
          {t('location.field.floor', 'Stockwerk')}
          <input
            value={location.floor ?? ''}
            placeholder={t('location.field.floorPlaceholder', 'z.B. EG, 1.OG')}
            onChange={(e) => updateLocation(location.id, { floor: e.target.value })}
            className="mt-1 w-full rounded border border-cp-border bg-cp-surface-3 p-1.5"
          />
        </label>
        <ColorField
          label={t('location.field.color', 'Farbe')}
          value={location.color}
          onChange={(color) => updateLocation(location.id, { color })}
        />
      </div>

      <div>
        <label className="block">
          {t('location.field.notes', 'Notizen')}
          <textarea
            value={location.notes ?? ''}
            onChange={(e) => updateLocation(location.id, { notes: e.target.value })}
            rows={2}
            className="mt-1 w-full resize-y rounded border border-cp-border bg-cp-surface-3 p-1.5"
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
          className="w-full rounded bg-amber-700 px-2 py-1 text-cp-xs hover:bg-amber-600"
          title={t(
            'location.action.bomTitle',
            'Stückliste der Geräte und Kabel im Rahmen — als PDF exportierbar',
          )}
        >
          <Icon icon={ClipboardList} size="xs" className="mr-1 inline-block align-text-bottom" />
          {t('location.action.bom', 'Stückliste exportieren')}
        </button>
        <button
          type="button"
          onClick={async () => {
            if (
              await confirmDialog(
                format(t('location.confirm.deleteFrame', 'Rahmen "{name}" löschen?'), {
                  name: location.name,
                }),
                {
                  body: t(
                    'location.confirm.deleteFrameBody',
                    'Geräte darin bleiben auf dem Canvas.',
                  ),
                  destructive: true,
                  okLabel: t('confirm.delete', 'Löschen'),
                },
              )
            ) {
              deleteLocation(location.id)
            }
          }}
          className="w-full rounded bg-cp-surface-4 px-2 py-1 text-cp-xs hover:bg-cp-surface-5"
          title={t(
            'location.action.deleteFrameTitle',
            'Entfernt nur den Rahmen — Geräte darin bleiben auf dem Canvas.',
          )}
        >
          {t('location.action.deleteFrame', 'Nur Rahmen löschen')}
        </button>
        <button
          type="button"
          onClick={async () => {
            if (
              await confirmDialog(
                format(
                  t('location.confirm.deleteAll', 'Rahmen "{name}" UND Inhalt löschen?'),
                  { name: location.name },
                ),
                {
                  body: t(
                    'location.confirm.deleteAllBody',
                    'Alle Geräte im Rahmen samt deren Kabel werden mitgelöscht.',
                  ),
                  destructive: true,
                  okLabel: t('confirm.deleteAll', 'Alles löschen'),
                },
              )
            ) {
              deleteLocationWithContents(location.id)
            }
          }}
          className="w-full rounded bg-red-700 px-2 py-1 text-cp-xs hover:bg-red-600"
        >
          {t('location.action.deleteAll', 'Rahmen + Inhalt löschen')}
        </button>
      </div>

      <p className="text-[10px] italic text-cp-text-muted">
        {t(
          'location.tip',
          'Tipp: Der Rahmen bewegt sich standardmäßig unabhängig. Aktiviere „Geräte mitnehmen", wenn alle enthaltenen Geräte beim Verschieben des Rahmens mitwandern sollen.',
        )}
      </p>
    </div>
  )
}
