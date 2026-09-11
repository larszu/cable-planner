import { ExternalLink, Check} from 'lucide-react'
import { useCanvasProjectStore as useProjectStore } from '../../../store/projectStoreContext'
import { Icon } from '../../shared/Icon'
import { format, useTranslation } from '../../../lib/i18n'
import { pickImageAsDataUri } from '../../../lib/readImageAsDataUri'
import { promptDialog } from '../../../lib/promptDialog'
import { SortableSection } from '../SortableSection'
import { resolveDeviceType } from '../../../lib/deviceTypeRegistry'
import { evidenceForType } from '../../../lib/catalogueEvidence'
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
  const projectAuthor = useProjectStore((state) => state.project.metadata.author)

  // Initiative 11 — der Katalog-Typ als Quelle des Datenblatt-Links.
  const catalogType = resolveDeviceType(equipment.deviceTypeId)
  const inheritedUrl = catalogType?.template.manufacturerUrl
  const inheritedName = catalogType?.template.name
  // Initiative 11, Schritt 3 — und der Fall, den es bis hierher nicht gab:
  // der Katalog-Typ OHNE Datenblatt. `no-type` (von Hand angelegt, Import)
  // ist etwas anderes als `unsourced` (Katalog-Eintrag ohne Beleg); als
  // leeres Feld sahen beide gleich aus.
  const typBeleg = evidenceForType(equipment.deviceTypeId)

  // #580 — Verifizierung: eine Person bestätigt, dass die Ports/Daten des
  // Geräts korrekt sind. Name kommt aus dem Projekt-Autor (Einstellungen);
  // sonst wird einmalig gefragt. Wiederholtes Klicken toggelt die eigene
  // Bestätigung.
  const verifiedBy = equipment.verifiedBy ?? []
  const toggleVerify = async () => {
    const name =
      (projectAuthor ?? '').trim() ||
      (await promptDialog(t('verify.namePrompt', 'Your name (for device verification):')))?.trim()
    if (!name) return
    const next = verifiedBy.includes(name)
      ? verifiedBy.filter((n) => n !== name)
      : [...verifiedBy, name]
    updateEquipment(equipment.id, { verifiedBy: next.length > 0 ? next : undefined })
  }

  return (
    <SortableSection id="optional" title={t('opt.title', 'Optional fields')} subtitle={t('opt.subtitle', 'Manufacturer link, reference image, icon, rental price')}>
      <div className="space-y-3">
        {/* #580 — Geräte-Verifizierung: bestätigen, dass die eingetragenen
            Ports/Daten korrekt sind. Zeigt die Zahl der Bestätigungen. */}
        <div className="border border-cp-border-muted bg-cp-surface-1 p-2">
          <div className="mb-1 flex items-center justify-between">
            <span className="flex items-center gap-1.5 text-cp-text-secondary">
              {verifiedBy.length > 0 && (
                <span
                  className="inline-flex items-center gap-1 bg-emerald-900/60 px-1.5 py-0.5 text-cp-xs font-semibold text-emerald-200"
                  title={format(
                    t('verify.byTitle', 'Verified by: {names}'),
                    { names: verifiedBy.join(', ') },
                  )}
                >
                  <Icon icon={Check} size="xs" className="mr-1 inline" />
                  {format(t('verify.count', '{n}× verified'), { n: verifiedBy.length })}
                </span>
              )}
              {verifiedBy.length === 0 && (
                <span className="text-cp-xs text-cp-text-muted">
                  {t('verify.none', 'Not verified yet')}
                </span>
              )}
            </span>
            <button
              type="button"
              onClick={() => void toggleVerify()}
              className="bg-cp-surface-4 px-2 py-1 text-cp-xs hover:bg-cp-surface-5"
              title={t('verify.buttonTitle', 'Confirm that this device\'s ports/data are correct')}
            >
              {t('verify.button', 'Verify as correct')}
            </button>
          </div>
          <p className="text-cp-xs text-cp-text-faint">
            {t('verify.hint', 'Confirms the ports are correct. When sharing libraries, confirmations from multiple users add up.')}
          </p>
        </div>

        {/* #420 — Mietpreis pro Tag. Beim Rentman-Import automatisch
            befuellt; manuell ueberschreibbar. */}
        <div className="grid grid-cols-[1fr_70px] gap-2">
          <label className="block">
            <span className="mb-1 block text-cp-text-secondary">
              {t('eq.field.rentPrice', 'Rental price / day')}
              {equipment.rentmanId && (
                <span className="ml-1 bg-emerald-900/60 px-1 text-cp-xs text-emerald-200">
                  {t('eq.field.rentPriceRentman', 'from Rentman')}
                </span>
              )}
            </span>
            <input
              type="number"
              min={0}
              step="0.01"
              value={equipment.rentPricePerDay ?? ''}
              placeholder={t('eq.field.rentPricePlaceholder', 'e.g. 45.00')}
              onChange={(event) => {
                const v = event.target.value
                updateEquipment(equipment.id, {
                  rentPricePerDay: v === '' ? undefined : Math.max(0, Number(v) || 0),
                })
              }}
              className="w-full border border-cp-border bg-cp-surface-1 p-2 font-mono"
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-cp-text-secondary">{t('eq.field.rentCurrency', 'Cur.')}</span>
            <input
              type="text"
              maxLength={6}
              value={equipment.rentCurrency ?? ''}
              placeholder="EUR"
              onChange={(event) => {
                const v = event.target.value.trim().toUpperCase().slice(0, 6)
                updateEquipment(equipment.id, { rentCurrency: v || undefined })
              }}
              className="w-full border border-cp-border bg-cp-surface-1 p-2 text-center font-mono uppercase"
            />
          </label>
        </div>

        <label className="block">
          <span className="mb-1 block text-cp-text-secondary">
            {t('eq.field.manufacturerUrl', 'Manufacturer link')}{' '}
            <span className="text-cp-text-faint">
              ({t('common.optional', 'optional')}, {t('eq.field.manufacturerUrlHint', 'optional, for datasheet access')})
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
              className="flex-1 border border-cp-border bg-cp-surface-1 p-2"
            />
            {equipment.manufacturerUrl && (
              <a
                href={equipment.manufacturerUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 bg-sky-700 px-2 py-1 text-cp-xs hover:bg-sky-600"
                title={t('eq.field.manufacturerUrlOpenTitle', 'Open in external browser')}
              >
                {t('eq.field.manufacturerUrlOpen', 'Open')}
                <Icon icon={ExternalLink} size="xs" />
              </a>
            )}
          </div>
          {/* Initiative 11 — der geerbte Beleg, mit genannter Herkunft.
              `manufacturerUrl` ist eine MODELL-Eigenschaft (siehe
              `modelFields.ts`): ein Geraet, das einen Katalog-Typ
              referenziert, erbt sie. Ohne diese Zeile lagen die 253
              Datenblatt-Links zwar im Katalog, aber der Nutzer sah am Geraet
              weiterhin ein leeres Feld — der Beleg waere aus dem Kommentar in
              ein ebenso unerreichbares Feld gewandert. Das eigene Feld
              gewinnt, wenn es gesetzt ist: es ist die Ausnahme, die jemand
              bewusst eingetragen hat. */}
          {/* Initiative 11 — der FEHLENDE Beleg, ebenso benannt wie der
              vorhandene. 159 von 412 Katalog-Eintraegen fuehren keinen
              Datenblatt-Link (sechs Kataloge, siehe `catalogueEvidence.ts`);
              am Geraet war das bisher von „hier hat nur gerade niemand
              nachgesehen" nicht zu unterscheiden. Ein Strich auf dem Blatt
              statt einer leeren Zelle — dieselbe Regel wie ueberall sonst
              hier. */}
          {!equipment.manufacturerUrl && !inheritedUrl && typBeleg.kind === 'unsourced' && (
            <div className="mt-1 text-cp-xs text-cp-text-muted">
              {format(
                t(
                  'eq.field.manufacturerUrlNoSource',
                  'Catalog type {name} carries no datasheet — this entry is unsourced.',
                ),
                { name: inheritedName ?? '' },
              )}
            </div>
          )}
          {!equipment.manufacturerUrl && inheritedUrl && (
            <div className="mt-1 flex items-center gap-1 text-cp-xs">
              <span className="text-cp-text-muted">
                {format(
                  t('eq.field.manufacturerUrlInherited', 'From catalog type {name}:'),
                  { name: inheritedName ?? '' },
                )}
              </span>
              <a
                href={inheritedUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 truncate text-cp-accent hover:underline"
                title={t('eq.field.manufacturerUrlOpenTitle', 'Open in external browser')}
              >
                {t('eq.field.manufacturerUrlOpen', 'Open')}
                <Icon icon={ExternalLink} size="xs" />
              </a>
            </div>
          )}
        </label>

        <label className="block">
          <span className="mb-1 block text-cp-text-secondary">
            {t('eq.field.priceEUR', 'Price / rental (€)')}{' '}
            <span className="text-cp-text-faint">
              ({t('common.optional', 'optional')}, {t('eq.field.priceEURHint', 'for quote export')})
            </span>
          </span>
          <input
            type="number"
            min={0}
            step={0.01}
            value={equipment.priceEUR ?? ''}
            placeholder={t('eq.field.priceEURPlaceholder', 'e.g. 1200')}
            onChange={(event) =>
              updateEquipment(equipment.id, {
                priceEUR: event.target.value ? Math.max(0, Number(event.target.value)) : undefined,
              })
            }
            className="w-full border border-cp-border bg-cp-surface-1 p-2 font-mono"
          />
        </label>

        <label className="block">
          <span className="mb-1 block text-cp-text-secondary">
            {t('eq.field.refImage', 'Reference image')}{' '}
            <span className="text-cp-text-faint">({t('eq.field.refImageHint', 'e.g. port layout')})</span>
          </span>
          <div className="flex items-start gap-2">
            {equipment.imageUrl ? (
              <a
                href={equipment.imageUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="block max-h-24 max-w-[120px] overflow-hidden border border-cp-border"
                title={t('eq.field.refImageFullsize', 'Open at full size')}
              >
                <img src={equipment.imageUrl} alt="" className="max-h-24 max-w-[120px] object-contain" />
              </a>
            ) : (
              <div className="flex h-24 w-[120px] items-center justify-center border border-dashed border-cp-border text-cp-xs text-cp-text-muted">
                {t('eq.field.refImageNone', 'No image')}
              </div>
            )}
            <div className="flex flex-col gap-1">
              <button
                type="button"
                onClick={async () => {
                  const dataUri = await pickImageAsDataUri()
                  if (dataUri) updateEquipment(equipment.id, { imageUrl: dataUri })
                }}
                className="bg-cp-surface-4 px-2 py-1 text-cp-xs hover:bg-cp-surface-5"
              >
                {equipment.imageUrl
                  ? t('eq.field.refImageReplace', 'Replace…')
                  : t('common.choose', 'Choose…')}
              </button>
              {equipment.imageUrl && (
                <button
                  type="button"
                  onClick={() => updateEquipment(equipment.id, { imageUrl: undefined })}
                  className="bg-cp-surface-2 px-2 py-1 text-cp-xs text-cp-text-muted hover:bg-red-700 hover:text-white"
                >
                  {t('common.remove', 'Remove')}
                </button>
              )}
            </div>
          </div>
        </label>

        <label className="block">
          <span className="mb-1 block text-cp-text-secondary">
            {t('opt.iconLabel', 'Icon')}{' '}
            <span className="text-cp-text-faint">
              ({t('opt.iconHint', 'Glyph or emoji, max 2 characters — empty = automatic')})
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
              className="w-20 border border-cp-border bg-cp-surface-1 p-2 text-center text-cp-lg"
              maxLength={2}
            />
            {ICON_GLYPHS.map((g) => (
              <button
                key={g}
                type="button"
                onClick={() => updateEquipment(equipment.id, { icon: g })}
                className={` border px-1.5 py-1 text-cp-lg ${
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
                className="bg-cp-surface-4 px-1.5 py-1 text-cp-xs hover:bg-cp-surface-5"
                title={t('opt.iconAutoTitle', 'Reset to automatic')}
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
