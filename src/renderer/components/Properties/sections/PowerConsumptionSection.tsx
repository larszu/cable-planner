import { Zap } from 'lucide-react'
import { useProjectStore } from '../../../store/projectStore'
import { useTranslation } from '../../../lib/i18n'
import type { EquipmentItem } from '../../../types/equipment'
import { SortableSection } from '../SortableSection'
import { Icon } from '../../shared/Icon'

/**
 * v7.4.0 / #306 — Stromverbrauch accordion. Two entry paths:
 *   • Watts directly (datasheet)
 *   • Voltage × Ampere → auto-derive Watts
 * If V and A are both filled, the W field is computed live. The user
 * can still override W (which will then "win" over V×A until they
 * change V or A again). All three values persist on the equipment so
 * the field tech sees the original specification next time.
 */
export const PowerConsumptionSection = ({ equipment }: { equipment: EquipmentItem }) => {
  const t = useTranslation()
  const updateEquipment = useProjectStore((s) => s.updateEquipment)
  const v = equipment.voltage
  const a = equipment.currentAmps
  const w = equipment.powerConsumptionWatts
  const computedW = typeof v === 'number' && typeof a === 'number' ? v * a : undefined
  const summary =
    typeof w === 'number'
      ? `${w} W`
      : typeof computedW === 'number'
        ? `~${Math.round(computedW)} W`
        : '–'
  return (
    <SortableSection id="power" title={t('power.title', 'Stromverbrauch')} subtitle={summary}>
      <div className="grid grid-cols-3 gap-2 text-cp-xs">
        <label className="block">
          <span className="mb-1 block text-cp-text-muted">{t('power.voltage', 'Spannung (V)')}</span>
          <input
            type="number"
            min={0}
            step={1}
            value={v ?? ''}
            placeholder={t('power.voltagePlaceholder', 'z. B. 230')}
            onChange={(e) => {
              const nextV = e.target.value ? Math.max(0, Number(e.target.value)) : undefined
              // Recompute W only when both V and A are present AND
              // the user hadn't manually overridden a W value that
              // diverges from the previous V×A. If W matches the
              // OLD V×A (or W is blank), update it; otherwise leave
              // the explicit override intact.
              const oldProduct =
                typeof v === 'number' && typeof a === 'number' ? v * a : undefined
              const wAutoMatched =
                w === undefined || (oldProduct !== undefined && Math.abs(w - oldProduct) < 0.5)
              const newProduct =
                typeof nextV === 'number' && typeof a === 'number' ? nextV * a : undefined
              updateEquipment(equipment.id, {
                voltage: nextV,
                powerConsumptionWatts: wAutoMatched ? newProduct : w,
              })
            }}
            className="w-full rounded border border-cp-border bg-cp-surface-1 p-2 font-mono"
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-cp-text-muted">{t('power.current', 'Stromstärke (A)')}</span>
          <input
            type="number"
            min={0}
            step={0.01}
            value={a ?? ''}
            placeholder={t('power.currentPlaceholder', 'z. B. 1.5')}
            onChange={(e) => {
              const nextA = e.target.value ? Math.max(0, Number(e.target.value)) : undefined
              const oldProduct =
                typeof v === 'number' && typeof a === 'number' ? v * a : undefined
              const wAutoMatched =
                w === undefined || (oldProduct !== undefined && Math.abs(w - oldProduct) < 0.5)
              const newProduct =
                typeof v === 'number' && typeof nextA === 'number' ? v * nextA : undefined
              updateEquipment(equipment.id, {
                currentAmps: nextA,
                powerConsumptionWatts: wAutoMatched ? newProduct : w,
              })
            }}
            className="w-full rounded border border-cp-border bg-cp-surface-1 p-2 font-mono"
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-cp-text-muted">
            {t('power.watts', 'Leistung (W)')}
            {computedW !== undefined && (
              <span className="ml-1 inline-flex text-emerald-400/70" title={t('power.wattsComputed', 'Aus V × A berechnet')}>
                <Icon icon={Zap} size="xs" />
              </span>
            )}
          </span>
          <input
            type="number"
            min={0}
            step={1}
            value={w ?? ''}
            placeholder={
              computedW !== undefined
                ? `${t('power.auto', 'auto')}: ${Math.round(computedW)}`
                : t('common.optional', 'optional')
            }
            onChange={(e) =>
              updateEquipment(equipment.id, {
                powerConsumptionWatts: e.target.value
                  ? Math.max(0, Number(e.target.value))
                  : undefined,
              })
            }
            className="w-full rounded border border-cp-border bg-cp-surface-1 p-2 font-mono"
            title={t('power.wattsTitle', 'Datenblatt-Wert. V × A wird vorgeschlagen, kann hier überschrieben werden.')}
          />
        </label>
      </div>
      <p className="mt-2 text-[10px] text-cp-text-muted">
        {t(
          'power.formulaHint',
          'Wenn Spannung und Stromstärke gesetzt sind, wird die Leistung automatisch berechnet (P = U × I). Werkzeuge → Stromverbrauch summiert das Leistungs-Feld über alle Geräte.',
        )}
      </p>
    </SortableSection>
  )
}
