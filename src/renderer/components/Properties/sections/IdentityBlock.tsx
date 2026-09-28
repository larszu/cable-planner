import { RotateCcw } from 'lucide-react'
import { Icon } from '../../shared/Icon'
import { useCanvasProjectStore as useProjectStore } from '../../../store/projectStoreContext'
import { generateShortName } from '../../../lib/shortName'
import { useTranslation } from '../../../lib/i18n'
import type { EquipmentItem } from '../../../types/equipment'

/**
 * #306 — IdentityBlock: Name + Short-Name + Untertitel. Drei Felder
 * die zusammen die "Identitaet" des Geraets beschreiben. Short-Name
 * (#v7.9.127) wird auto-generiert wenn leer — Placeholder zeigt den
 * Vorschlag, "↻ auto"-Button uebernimmt ihn ins Override-Feld.
 *
 * Der Katalog-Typ (ADR-002) stand bis 2026-09-28 hier ganz oben und sah ohne
 * Wert aus wie ein fehlendes Pflichtfeld. Er wird jetzt automatisch vergeben
 * (lib/deviceTypeMatch) und liegt in `CatalogueSection`.
 */
export const IdentityBlock = ({ equipment }: { equipment: EquipmentItem }) => {
  const t = useTranslation()
  const updateEquipment = useProjectStore((state) => state.updateEquipment)
  const autoSuggestion = generateShortName(equipment.name)

  return (
    <>
      <label className="block">
        <span className="mb-1 block text-cp-text-secondary">{t('eq.field.name', 'Name')}</span>
        <input
          value={equipment.name}
          onChange={(event) => updateEquipment(equipment.id, { name: event.target.value })}
          className="w-full border border-cp-border bg-cp-surface-1 p-2"
        />
      </label>

      {/* v7.9.127 — Short-Form-Name. Wird in platzknappen Kontexten
          benutzt (Cable-Endpoint-Labels, Patch-Sheets). Wenn leer:
          auto-generiert aus name (Placeholder zeigt den Vorschlag).
          Refresh-Button setzt den Override auf den Auto-Vorschlag. */}
      <label className="block">
        <span className="mb-1 block text-cp-text-secondary">
          {t('eq.field.shortName', 'Short name')}{' '}
          <span className="text-cp-text-faint">
            ({t('common.optional', 'optional')},{' '}
            {t(
              'eq.field.shortNameHint',
              'for port/endpoint labels — e.g. "ATEM8K" instead of "ATEM Constellation 8K"',
            )}
            )
          </span>
        </span>
        <div className="flex gap-1">
          <input
            value={equipment.shortName ?? ''}
            placeholder={autoSuggestion || t('eq.field.shortNamePlaceholder', 'Short form…')}
            onChange={(event) =>
              updateEquipment(equipment.id, {
                shortName: event.target.value || undefined,
              })
            }
            className="flex-1 border border-cp-border bg-cp-surface-1 p-2"
          />
          <button
            type="button"
            onClick={() =>
              updateEquipment(equipment.id, { shortName: autoSuggestion || undefined })
            }
            disabled={!autoSuggestion}
            title={
              autoSuggestion
                ? `${t('eq.field.shortNameAuto', 'Regenerate from name')} (${autoSuggestion})`
                : t('eq.field.shortNameAutoEmpty', 'No suggestion — please set a name.')
            }
            className="inline-flex shrink-0 items-center gap-1 border border-cp-border bg-cp-surface-2 px-2 text-cp-xs text-cp-text-bright hover:bg-cp-surface-4 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Icon icon={RotateCcw} size="xs" />
            {t('eq.field.shortNameAutoBtn', 'auto')}
          </button>
        </div>
        {!equipment.shortName?.trim() && autoSuggestion && (
          <p className="mt-1 text-cp-xs text-cp-text-muted">
            {t('eq.field.shortNameAutoUsed', 'Automatically using:')}{' '}
            <span className="font-mono text-cp-text-muted">{autoSuggestion}</span>
          </p>
        )}
      </label>

      <label className="block">
        <span className="mb-1 block text-cp-text-secondary">
          {t('eq.field.subtitle', 'Subtitle')}{' '}
          <span className="text-cp-text-faint">
            ({t('common.optional', 'optional')}, {t('eq.field.subtitleHint', 'optional, e.g. "PGM monitor"')})
          </span>
        </span>
        <input
          value={equipment.subtitle ?? ''}
          placeholder={t('eq.field.subtitlePlaceholder', 'Subtitle…')}
          onChange={(event) => updateEquipment(equipment.id, { subtitle: event.target.value || undefined })}
          className="w-full border border-cp-border bg-cp-surface-1 p-2"
        />
      </label>
    </>
  )
}
