import { useCanvasProjectStore as useProjectStore } from '../../../store/projectStoreContext'
import { format, useTranslation } from '../../../lib/i18n'
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
    <SortableSection id="optional" title={t('opt.title', 'Optionale Felder')} subtitle={t('opt.subtitle', 'Hersteller-Link, Referenzbild, Icon, Mietpreis')}>
      <div className="space-y-3">
        {/* #420 — Mietpreis pro Tag. Beim Rentman-Import automatisch
            befuellt; manuell ueberschreibbar. */}
        <div className="grid grid-cols-[1fr_70px] gap-2">
          <label className="block">
            <span className="mb-1 block text-cp-text-secondary">
              {t('eq.field.rentPrice', 'Mietpreis / Tag')}
              {equipment.rentmanId && (
                <span className="ml-1 rounded bg-emerald-900/60 px-1 text-[10px] text-emerald-200">
                  {t('eq.field.rentPriceRentman', 'aus Rentman')}
                </span>
              )}
            </span>
            <input
              type="number"
              min={0}
              step="0.01"
              value={equipment.rentPricePerDay ?? ''}
              placeholder={t('eq.field.rentPricePlaceholder', 'z. B. 45.00')}
              onChange={(event) => {
                const v = event.target.value
                updateEquipment(equipment.id, {
                  rentPricePerDay: v === '' ? undefined : Math.max(0, Number(v) || 0),
                })
              }}
              className="w-full rounded border border-cp-border bg-cp-surface-1 p-2 font-mono"
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-cp-text-secondary">{t('eq.field.rentCurrency', 'Wäh.')}</span>
            <input
              type="text"
              maxLength={6}
              value={equipment.rentCurrency ?? ''}
              placeholder="EUR"
              onChange={(event) => {
                const v = event.target.value.trim().toUpperCase().slice(0, 6)
                updateEquipment(equipment.id, { rentCurrency: v || undefined })
              }}
              className="w-full rounded border border-cp-border bg-cp-surface-1 p-2 text-center font-mono uppercase"
            />
          </label>
        </div>

        <label className="block">
          <span className="mb-1 block text-cp-text-secondary">
            {t('eq.field.manufacturerUrl', 'Hersteller-Link')}{' '}
            <span className="text-cp-text-faint">
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
              className="flex-1 rounded border border-cp-border bg-cp-surface-1 p-2"
            />
            {equipment.manufacturerUrl && (
              <a
                href={equipment.manufacturerUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="rounded bg-sky-700 px-2 py-1 text-cp-xs hover:bg-sky-600"
                title={t('eq.field.manufacturerUrlOpenTitle', 'In externem Browser öffnen')}
              >
                {t('eq.field.manufacturerUrlOpen', 'Öffnen ↗')}
              </a>
            )}
          </div>
        </label>

        <label className="block">
          <span className="mb-1 block text-cp-text-secondary">
            {t('eq.field.priceEUR', 'Preis / Miete (€)')}{' '}
            <span className="text-cp-text-faint">
              ({t('common.optional', 'optional')}, {t('eq.field.priceEURHint', 'für Angebots-Export')})
            </span>
          </span>
          <input
            type="number"
            min={0}
            step={0.01}
            value={equipment.priceEUR ?? ''}
            placeholder={t('eq.field.priceEURPlaceholder', 'z. B. 1200')}
            onChange={(event) =>
              updateEquipment(equipment.id, {
                priceEUR: event.target.value ? Math.max(0, Number(event.target.value)) : undefined,
              })
            }
            className="w-full rounded border border-cp-border bg-cp-surface-1 p-2 font-mono"
          />
        </label>

        <label className="block">
          <span className="mb-1 block text-cp-text-secondary">
            {t('eq.field.refImage', 'Referenzbild')}{' '}
            <span className="text-cp-text-faint">({t('eq.field.refImageHint', 'z. B. Port-Belegung')})</span>
          </span>
          <div className="flex items-start gap-2">
            {equipment.imageUrl ? (
              <a
                href={equipment.imageUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="block max-h-24 max-w-[120px] overflow-hidden rounded border border-cp-border"
                title={t('eq.field.refImageFullsize', 'In voller Größe öffnen')}
              >
                <img src={equipment.imageUrl} alt="" className="max-h-24 max-w-[120px] object-contain" />
              </a>
            ) : (
              <div className="flex h-24 w-[120px] items-center justify-center rounded border border-dashed border-cp-border text-[10px] text-cp-text-muted">
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
                className="rounded bg-cp-surface-4 px-2 py-1 text-cp-xs hover:bg-cp-surface-5"
              >
                {equipment.imageUrl
                  ? t('eq.field.refImageReplace', 'Ersetzen…')
                  : t('common.choose', 'Auswählen…')}
              </button>
              {equipment.imageUrl && (
                <button
                  type="button"
                  onClick={() => updateEquipment(equipment.id, { imageUrl: undefined })}
                  className="rounded bg-cp-surface-2 px-2 py-1 text-cp-xs text-cp-text-muted hover:bg-red-700 hover:text-white"
                >
                  {t('common.remove', 'Entfernen')}
                </button>
              )}
            </div>
          </div>
        </label>

        <label className="block">
          <span className="mb-1 block text-cp-text-secondary">
            {t('opt.iconLabel', 'Icon')}{' '}
            <span className="text-cp-text-faint">
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
              className="w-20 rounded border border-cp-border bg-cp-surface-1 p-2 text-center text-cp-lg"
              maxLength={2}
            />
            {ICON_GLYPHS.map((g) => (
              <button
                key={g}
                type="button"
                onClick={() => updateEquipment(equipment.id, { icon: g })}
                className={`rounded border px-1.5 py-1 text-cp-lg ${
                  equipment.icon === g
                    ? 'border-sky-500 bg-sky-700/30'
                    : 'border-cp-border bg-cp-surface-1 hover:bg-cp-surface-2'
                }`}
                title={format(t('opt.iconGlyphTitle', 'Icon {glyph}'), { glyph: g })}
              >
                {g}
              </button>
            ))}
            {equipment.icon && (
              <button
                type="button"
                onClick={() => updateEquipment(equipment.id, { icon: undefined })}
                className="rounded bg-cp-surface-4 px-1.5 py-1 text-[10px] hover:bg-cp-surface-5"
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
