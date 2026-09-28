import { useMemo, useState } from 'react'
import { useCanvasProjectStore as useProjectStore } from '../../../store/projectStoreContext'
import { useTranslation, format } from '../../../lib/i18n'
import { listDeviceTypes, resolveDeviceType } from '../../../lib/deviceTypeRegistry'
import { katalogTypVorschlaege } from '../../../lib/deviceTypeMatch'
import { SortableSection } from '../SortableSection'
import { PanelHint } from '../../shared/PanelHint'
import type { EquipmentItem } from '../../../types/equipment'

/**
 * Katalog & Herkunft — die Zuordnung zum eingebauten Katalog (ADR-002).
 *
 * Nutzer-Meldung 2026-09-28: „was soll 'katalog typ' bedeuten? ist das nicht
 * automatisch? und warum ist das ganz oben?" Der Picker stand vor dem Namen
 * und sagte ohne Wert „No catalogue type — inventory coverage and the BOM can
 * only guess". Das las sich wie ein Pflichtfeld, das fehlt — fuer ein Feld,
 * das die App selbst fuellen kann und das zum Planen nicht noetig ist.
 *
 * Jetzt: automatisch vergeben, wo der Name eindeutig ist
 * (`lib/deviceTypeMatch`). Hier nur noch zum Nachsehen und fuer die Faelle,
 * in denen die App nicht raten darf — mehrere Kandidaten, abweichender Name.
 * Zugeklappt, weiter unten, ohne Warnfarbe.
 *
 * BEWUSST NUR DIE IDENTITAET: Ports, Masse und Leistung bleiben. Wer das
 * Geraet gegen das Katalog-Modell austauschen will, nimmt „Gerät ersetzen".
 */
export const CatalogueSection = ({ equipment }: { equipment: EquipmentItem }) => {
  const t = useTranslation()
  const updateEquipment = useProjectStore((state) => state.updateEquipment)
  const [filter, setFilter] = useState('')

  const current = resolveDeviceType(equipment.deviceTypeId)
  const all = useMemo(() => listDeviceTypes(), [])
  const vorschlaege = useMemo(
    () => (current ? [] : katalogTypVorschlaege({ name: equipment.name })),
    [current, equipment.name],
  )
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
    <SortableSection
      id="catalogue"
      title={t('eq.catalogue.title', 'Catalogue & source')}
      subtitle={current ? current.template.name : t('eq.catalogue.none', 'not linked')}
    >
      <div className="space-y-2">
        <PanelHint
          text={t(
            'eq.catalogue.explain',
            'Links this device to a built-in catalogue model: datasheet link, inventory match and parts list use it. Set automatically when the name is unambiguous; not needed for planning.',
          )}
        />

        {current ? (
          <div className="flex items-baseline justify-between gap-2">
            <span className="text-cp-text">{current.template.name}</span>
            <button
              type="button"
              onClick={() => updateEquipment(equipment.id, { deviceTypeId: undefined })}
              className="text-cp-xs text-cp-text-muted hover:text-cp-text"
            >
              {t('eq.field.deviceTypeClear', 'clear')}
            </button>
          </div>
        ) : (
          vorschlaege.map((v) => (
            <div key={v.id} className="flex items-baseline justify-between gap-2 text-cp-xs">
              <span className="text-cp-text-secondary">
                {format(t('eq.catalogue.suggest', 'Matching catalogue entry: {name}'), { name: v.name })}
              </span>
              <button
                type="button"
                onClick={() => updateEquipment(equipment.id, { deviceTypeId: v.id })}
                className="shrink-0 border border-cp-border bg-cp-surface-2 px-2 py-0.5 text-cp-xs hover:bg-cp-surface-4"
              >
                {t('eq.catalogue.use', 'use')}
              </button>
            </div>
          ))
        )}

        <details>
          <summary className="cursor-pointer select-none text-cp-xs text-cp-text-muted hover:text-cp-text">
            {t('eq.catalogue.choose', 'Choose manually')}
          </summary>
          <div className="mt-1 space-y-1">
            <input
              value={filter}
              onChange={(event) => setFilter(event.target.value)}
              placeholder={t('eq.field.deviceTypeFilter', 'Search the catalogue…')}
              className="w-full border border-cp-border bg-cp-surface-1 p-1.5 text-cp-xs"
            />
            <select
              aria-label={t('eq.field.deviceType', 'Catalogue type')}
              value={equipment.deviceTypeId ?? ''}
              onChange={(event) =>
                updateEquipment(equipment.id, { deviceTypeId: event.target.value || undefined })
              }
              className="w-full border border-cp-border bg-cp-surface-1 p-1.5 text-cp-xs"
            >
              <option value="">{t('eq.field.deviceTypeUnset', '— none —')}</option>
              {matches.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.category ? `${c.name} · ${c.category}` : c.name}
                </option>
              ))}
            </select>
            <p className="text-cp-xs text-cp-text-faint">
              {format(t('eq.field.deviceTypeCount', '{n} of {total} types'), {
                n: matches.length,
                total: all.length,
              })}
              {' — '}
              {t(
                'eq.field.deviceTypeScope',
                'sets the identity only; ports, dimensions and power stay unchanged.',
              )}
            </p>
          </div>
        </details>
      </div>
    </SortableSection>
  )
}
