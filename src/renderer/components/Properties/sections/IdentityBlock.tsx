import { useMemo, useState } from 'react'
import { useCanvasProjectStore as useProjectStore } from '../../../store/projectStoreContext'
import { generateShortName } from '../../../lib/shortName'
import { useTranslation, format } from '../../../lib/i18n'
import { listDeviceTypes, resolveDeviceType } from '../../../lib/deviceTypeRegistry'
import type { EquipmentItem } from '../../../types/equipment'

/**
 * #306 — IdentityBlock: Name + Short-Name + Untertitel. Drei Felder
 * die zusammen die "Identitaet" des Geraets beschreiben. Short-Name
 * (#v7.9.127) wird auto-generiert wenn leer — Placeholder zeigt den
 * Vorschlag, "↻ auto"-Button uebernimmt ihn ins Override-Feld.
 *
 * ADR-002 — dazu der KATALOG-TYP. Er ist die vierte und einzige Angabe
 * hier, die nicht der Mensch formuliert, sondern das Datenblatt: die
 * stabile GUID, ueber die Plan und Lager sich ohne Namensvergleich finden.
 * Bis hierher konnte sie nur beim Anlegen aus dem Katalog entstehen; ein
 * von Hand angelegtes oder importiertes Geraet hatte nie eine.
 */
export const IdentityBlock = ({ equipment }: { equipment: EquipmentItem }) => {
  const t = useTranslation()
  const updateEquipment = useProjectStore((state) => state.updateEquipment)
  const autoSuggestion = generateShortName(equipment.name)

  return (
    <>
      <DeviceTypePicker equipment={equipment} />

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

/**
 * Zuweisung des Katalog-Typs.
 *
 * BEWUSST NUR DIE IDENTITAET: Ports, Masse und Leistung des Geraets bleiben
 * unangetastet. Der Nutzer sagt hier „das IST dieses Modell", er tauscht das
 * Geraet nicht aus — dafuer gibt es die Geraete-Ersetzung weiter unten. Ein
 * Klick, der stillschweigend die Verkabelungspunkte neu schreibt, waere eine
 * andere Aktion mit demselben Aussehen.
 */
const DeviceTypePicker = ({ equipment }: { equipment: EquipmentItem }) => {
  const t = useTranslation()
  const updateEquipment = useProjectStore((state) => state.updateEquipment)
  const [filter, setFilter] = useState('')

  const current = resolveDeviceType(equipment.deviceTypeId)
  const all = useMemo(() => listDeviceTypes(), [])
  const matches = useMemo(() => {
    const needle = filter.trim().toLowerCase()
    if (!needle) return all
    return all.filter(
      (c) =>
        c.name.toLowerCase().includes(needle) ||
        (c.category ?? '').toLowerCase().includes(needle),
    )
  }, [all, filter])

  return (
    <div className="rounded border border-cp-border-muted bg-cp-surface-1/40 p-2">
      <div className="mb-1 flex items-baseline justify-between gap-2">
        <span className="text-cp-text-secondary">
          {t('eq.field.deviceType', 'Katalog-Typ')}
        </span>
        {current ? (
          <button
            type="button"
            onClick={() => updateEquipment(equipment.id, { deviceTypeId: undefined })}
            className="text-cp-xs text-cp-text-muted hover:text-cp-text"
          >
            {t('eq.field.deviceTypeClear', 'lösen')}
          </button>
        ) : null}
      </div>

      {current ? (
        <p className="mb-1 text-cp-text">{current.template.name}</p>
      ) : (
        <p className="mb-1 text-cp-text-muted">
          {t(
            'eq.field.deviceTypeNone',
            'Kein Katalog-Typ — Lager-Deckung und Stückliste können dieses Gerät nur über den Namen erraten.',
          )}
        </p>
      )}

      <input
        value={filter}
        onChange={(event) => setFilter(event.target.value)}
        placeholder={t('eq.field.deviceTypeFilter', 'Katalog durchsuchen…')}
        className="mb-1 w-full rounded border border-cp-border bg-cp-surface-1 p-1.5 text-cp-xs"
      />
      <select
        value={equipment.deviceTypeId ?? ''}
        onChange={(event) =>
          updateEquipment(equipment.id, { deviceTypeId: event.target.value || undefined })
        }
        className="w-full rounded border border-cp-border bg-cp-surface-1 p-1.5 text-cp-xs"
      >
        <option value="">{t('eq.field.deviceTypeUnset', '— keiner —')}</option>
        {matches.map((c) => (
          <option key={c.id} value={c.id}>
            {c.category ? `${c.name} · ${c.category}` : c.name}
          </option>
        ))}
      </select>
      <p className="mt-1 text-cp-xs text-cp-text-faint">
        {format(t('eq.field.deviceTypeCount', '{n} von {total} Typen'), {
          n: matches.length,
          total: all.length,
        })}
        {' — '}
        {t(
          'eq.field.deviceTypeScope',
          'setzt nur die Identität; Ports, Maße und Leistung bleiben unverändert.',
        )}
      </p>
    </div>
  )
}
