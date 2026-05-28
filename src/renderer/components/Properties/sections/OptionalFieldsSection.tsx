import { useCanvasProjectStore as useProjectStore } from '../../../store/projectStoreContext'
import { useTranslation } from '../../../lib/i18n'
import { pickImageAsDataUri } from '../../../lib/readImageAsDataUri'
import { SortableSection } from '../SortableSection'
import type { EquipmentItem } from '../../../types/equipment'

const ICON_GLYPHS = ['📷', '🖥', '💻', '📺', '🎙', '💡', '🌐', '⚡', '🔌', '🔧', '⇄'] as const

/**
 * #306 — "Optionale Felder"-SortableSection aus EquipmentProperties
 * ausgelagert: Hersteller-URL, Referenzbild (mit Datei-Pick), Icon-
 * Picker (Custom-Text oder ein Glyph aus der Quick-Liste).
 */
export const OptionalFieldsSection = ({ equipment }: { equipment: EquipmentItem }) => {
  const t = useTranslation()
  const updateEquipment = useProjectStore((state) => state.updateEquipment)

  return (
    <SortableSection id="optional" title={t('opt.title', 'Optionale Felder')} subtitle={t('opt.subtitle', 'Hersteller-Link, Referenzbild, Icon')}>
      <div className="space-y-3">
        <label className="block">
          <span className="mb-1 block text-slate-300">
            {t('eq.field.manufacturerUrl', 'Hersteller-Link')}{' '}
            <span className="text-slate-500">
              ({t('common.optional', 'optional')}, {t('eq.field.manufacturerUrlHint', 'für Datenblatt-Aufruf')})
            </span>
          </span>
          <div className="flex gap-1">
            <input
              type="url"
              value={equipment.manufacturerUrl ?? ''}
              placeholder="https://…"
              onChange={(event) =>
                updateEquipment(equipment.id, { manufacturerUrl: event.target.value || undefined })
              }
              className="flex-1 rounded border border-slate-700 bg-slate-900 p-2"
            />
            {equipment.manufacturerUrl && (
              <a
                href={equipment.manufacturerUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="rounded bg-sky-700 px-2 py-1 text-xs hover:bg-sky-600"
                title={t('eq.field.manufacturerUrlOpenTitle', 'In externem Browser öffnen')}
              >
                {t('eq.field.manufacturerUrlOpen', 'Öffnen ↗')}
              </a>
            )}
          </div>
        </label>

        <label className="block">
          <span className="mb-1 block text-slate-300">
            {t('eq.field.refImage', 'Referenzbild')}{' '}
            <span className="text-slate-500">({t('eq.field.refImageHint', 'z. B. Port-Belegung')})</span>
          </span>
          <div className="flex items-start gap-2">
            {equipment.imageUrl ? (
              <a
                href={equipment.imageUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="block max-h-24 max-w-[120px] overflow-hidden rounded border border-slate-700"
                title={t('eq.field.refImageFullsize', 'In voller Größe öffnen')}
              >
                <img src={equipment.imageUrl} alt="" className="max-h-24 max-w-[120px] object-contain" />
              </a>
            ) : (
              <div className="flex h-24 w-[120px] items-center justify-center rounded border border-dashed border-slate-700 text-[10px] text-slate-500">
                {t('eq.field.refImageNone', 'Kein Bild')}
              </div>
            )}
            <div className="flex flex-col gap-1">
              <button
                type="button"
                onClick={async () => {
                  const dataUri = await pickImageAsDataUri()
                  if (dataUri) updateEquipment(equipment.id, { imageUrl: dataUri })
                }}
                className="rounded bg-slate-700 px-2 py-1 text-xs hover:bg-slate-600"
              >
                {equipment.imageUrl
                  ? t('eq.field.refImageReplace', 'Ersetzen…')
                  : t('common.choose', 'Auswählen…')}
              </button>
              {equipment.imageUrl && (
                <button
                  type="button"
                  onClick={() => updateEquipment(equipment.id, { imageUrl: undefined })}
                  className="rounded bg-slate-800 px-2 py-1 text-xs text-slate-400 hover:bg-red-700 hover:text-white"
                >
                  {t('common.remove', 'Entfernen')}
                </button>
              )}
            </div>
          </div>
        </label>

        <label className="block">
          <span className="mb-1 block text-slate-300">
            {t('opt.iconLabel', 'Icon')}{' '}
            <span className="text-slate-500">
              ({t('opt.iconHint', 'Glyph oder Emoji, max 2 Zeichen — leer = automatisch')})
            </span>
          </span>
          <div className="flex flex-wrap items-center gap-1">
            <input
              value={equipment.icon ?? ''}
              placeholder={t('opt.iconPlaceholder', 'auto')}
              onChange={(event) => {
                const v = event.target.value
                updateEquipment(equipment.id, { icon: v.length === 0 ? undefined : v.slice(0, 2) })
              }}
              className="w-20 rounded border border-slate-700 bg-slate-900 p-2 text-center text-base"
              maxLength={2}
            />
            {ICON_GLYPHS.map((g) => (
              <button
                key={g}
                type="button"
                onClick={() => updateEquipment(equipment.id, { icon: g })}
                className={`rounded border px-1.5 py-1 text-base ${
                  equipment.icon === g
                    ? 'border-sky-500 bg-sky-700/30'
                    : 'border-slate-700 bg-slate-900 hover:bg-slate-800'
                }`}
                title={`Icon ${g}`}
              >
                {g}
              </button>
            ))}
            {equipment.icon && (
              <button
                type="button"
                onClick={() => updateEquipment(equipment.id, { icon: undefined })}
                className="rounded bg-slate-700 px-1.5 py-1 text-[10px] hover:bg-slate-600"
                title={t('opt.iconAutoTitle', 'Auf automatisch zurücksetzen')}
              >
                auto
              </button>
            )}
          </div>
        </label>
      </div>
    </SortableSection>
  )
}
