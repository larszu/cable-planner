import { useCanvasProjectStore as useProjectStore } from '../../../store/projectStoreContext'
import { generateShortName } from '../../../lib/shortName'
import { useTranslation } from '../../../lib/i18n'
import type { EquipmentItem } from '../../../types/equipment'

/**
 * #306 — IdentityBlock: Name + Short-Name + Untertitel. Drei Felder
 * die zusammen die "Identitaet" des Geraets beschreiben. Short-Name
 * (#v7.9.127) wird auto-generiert wenn leer — Placeholder zeigt den
 * Vorschlag, "↻ auto"-Button uebernimmt ihn ins Override-Feld.
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
          className="w-full rounded border border-cp-border bg-cp-surface-1 p-2"
        />
      </label>

      {/* v7.9.127 — Short-Form-Name. Wird in platzknappen Kontexten
          benutzt (Cable-Endpoint-Labels, Patch-Sheets). Wenn leer:
          auto-generiert aus name (Placeholder zeigt den Vorschlag).
          Refresh-Button setzt den Override auf den Auto-Vorschlag. */}
      <label className="block">
        <span className="mb-1 block text-cp-text-secondary">
          {t('eq.field.shortName', 'Short-Name')}{' '}
          <span className="text-cp-text-faint">
            ({t('common.optional', 'optional')},{' '}
            {t(
              'eq.field.shortNameHint',
              'fuer Port-/Endpoint-Labels — z.B. "ATEM8K" statt "ATEM Constellation 8K"',
            )}
            )
          </span>
        </span>
        <div className="flex gap-1">
          <input
            value={equipment.shortName ?? ''}
            placeholder={autoSuggestion || t('eq.field.shortNamePlaceholder', 'Kurzform…')}
            onChange={(event) =>
              updateEquipment(equipment.id, {
                shortName: event.target.value || undefined,
              })
            }
            className="flex-1 rounded border border-cp-border bg-cp-surface-1 p-2"
          />
          <button
            type="button"
            onClick={() =>
              updateEquipment(equipment.id, { shortName: autoSuggestion || undefined })
            }
            disabled={!autoSuggestion}
            title={
              autoSuggestion
                ? `${t('eq.field.shortNameAuto', 'Aus Namen neu generieren')} (${autoSuggestion})`
                : t('eq.field.shortNameAutoEmpty', 'Kein Vorschlag — Name pflegen.')
            }
            className="shrink-0 rounded border border-cp-border bg-cp-surface-2 px-2 text-cp-xs text-cp-text-bright hover:bg-cp-surface-4 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {t('eq.field.shortNameAutoBtn', '↻ auto')}
          </button>
        </div>
        {!equipment.shortName?.trim() && autoSuggestion && (
          <p className="mt-1 text-[10px] text-cp-text-muted">
            {t('eq.field.shortNameAutoUsed', 'Verwendet automatisch:')}{' '}
            <span className="font-mono text-cp-text-muted">{autoSuggestion}</span>
          </p>
        )}
      </label>

      <label className="block">
        <span className="mb-1 block text-cp-text-secondary">
          {t('eq.field.subtitle', 'Untertitel')}{' '}
          <span className="text-cp-text-faint">
            ({t('common.optional', 'optional')}, {t('eq.field.subtitleHint', 'z.B. "PGM Monitor"')})
          </span>
        </span>
        <input
          value={equipment.subtitle ?? ''}
          placeholder={t('eq.field.subtitlePlaceholder', 'Untertitel…')}
          onChange={(event) => updateEquipment(equipment.id, { subtitle: event.target.value || undefined })}
          className="w-full rounded border border-cp-border bg-cp-surface-1 p-2"
        />
      </label>
    </>
  )
}
