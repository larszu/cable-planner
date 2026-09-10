/**
 * Festinstallation — Geräte-Lebenszyklus-Section.
 *
 * Betriebs-Status, Asset-Tag, Garantie, Wartungsintervall und die
 * zeitgestempelte Service-Historie eines Geräts. Bewusst ein einfaches
 * <details> (nicht draggable), damit kein Eintrag in der sortierbaren
 * Section-Order nötig ist.
 */
import { useState } from 'react'
import { Wrench, Trash2, Plus } from 'lucide-react'
import { useCanvasProjectStore as useProjectStore } from '../../../store/projectStoreContext'
import { useSettingsStore, useModule } from '../../../store/settingsStore'
import { useTranslation } from '../../../lib/i18n'
import { Icon } from '../../shared/Icon'
import {
  INSTALL_STATUSES,
  INSTALL_STATUS_LABEL,
  type InstallStatus,
  type ServiceRecord,
} from '../../../types/lifecycle'
import {
  EQUIPMENT_OWNERSHIPS,
  EQUIPMENT_OWNERSHIP_LABEL,
  type EquipmentItem,
  type EquipmentOwnership,
} from '../../../types/equipment'

const SERVICE_KINDS: ServiceRecord['kind'][] = [
  'install',
  'inspection',
  'repair',
  'replacement',
  'note',
]
export const LifecycleSection = ({ equipment }: { equipment: EquipmentItem }) => {
  const t = useTranslation()
  const SERVICE_KIND_LABEL: Record<ServiceRecord['kind'], string> = {
    install: t('lifecycle.kind.install', 'Installation'),
    inspection: t('lifecycle.kind.inspection', 'Inspection'),
    repair: t('lifecycle.kind.repair', 'Repair'),
    replacement: t('lifecycle.kind.replacement', 'Replacement'),
    note: t('lifecycle.kind.note', 'Note'),
  }
  const updateEquipment = useProjectStore((s) => s.updateEquipment)
  const setStatus = useProjectStore((s) => s.setEquipmentInstallStatus)
  const addServiceRecord = useProjectStore((s) => s.addServiceRecord)
  const removeServiceRecord = useProjectStore((s) => s.removeServiceRecord)
  const editorName = useSettingsStore((s) => s.editorName)
  // Modulares UI — Festinstallations-Felder bzw. Lager-Felder je nach Modul.
  const festinstallationModule = useModule('festinstallation')
  const rentalModule = useModule('rental')

  const [kind, setKind] = useState<ServiceRecord['kind']>('inspection')
  const [summary, setSummary] = useState('')

  const history = equipment.serviceHistory ?? []

  // Ist kein relevantes Modul aktiv, die ganze Section ausblenden.
  if (!festinstallationModule && !rentalModule) return null

  const onAdd = () => {
    const text = summary.trim()
    if (!text) return
    addServiceRecord(equipment.id, {
      date: new Date().toISOString(),
      author: editorName.trim() || t('lifecycle.unknownAuthor', 'Unknown'),
      kind,
      summary: text,
    })
    setSummary('')
  }

  return (
    <details className="rounded border border-cp-border bg-cp-surface-3/40">
      <summary className="flex cursor-pointer select-none items-center gap-1.5 px-2 py-1.5 text-cp-xs font-semibold uppercase tracking-wide text-cp-text-muted hover:bg-cp-surface-2/40">
        <Icon icon={Wrench} size="xs" />
        {t('lifecycle.section', 'Lifecycle / maintenance')}
      </summary>
      <div className="space-y-2 border-t border-cp-border p-2">
        {festinstallationModule && (
        <>
        <label className="block">
          <span className="mb-1 block text-cp-text-secondary">{t('lifecycle.status', 'Status')}</span>
          <select
            value={equipment.installStatus ?? ''}
            onChange={(e) =>
              setStatus(equipment.id, (e.target.value || undefined) as InstallStatus | undefined)
            }
            className="w-full rounded border border-cp-border bg-cp-surface-1 p-2"
          >
            <option value="">{t('lifecycle.statusNone', '— no status —')}</option>
            {INSTALL_STATUSES.map((s) => (
              <option key={s} value={s}>
                {t(`lifecycle.status.${s}`, INSTALL_STATUS_LABEL[s])}
              </option>
            ))}
          </select>
        </label>

        <div className="grid grid-cols-2 gap-2">
          <label className="block">
            <span className="mb-1 block text-cp-text-secondary">{t('lifecycle.assetTag', 'Asset tag')}</span>
            <input
              value={equipment.assetTag ?? ''}
              onChange={(e) => updateEquipment(equipment.id, { assetTag: e.target.value || undefined })}
              className="w-full rounded border border-cp-border bg-cp-surface-1 p-1.5"
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-cp-text-secondary">{t('lifecycle.warranty', 'Warranty until')}</span>
            <input
              type="date"
              value={(equipment.warrantyUntil ?? '').slice(0, 10)}
              onChange={(e) => updateEquipment(equipment.id, { warrantyUntil: e.target.value || undefined })}
              className="w-full rounded border border-cp-border bg-cp-surface-1 p-1.5"
            />
          </label>
        </div>

        <label className="block">
          <span className="mb-1 block text-cp-text-secondary">
            {t('lifecycle.maintInterval', 'Maintenance interval (days)')}
          </span>
          <input
            type="number"
            min={0}
            value={equipment.maintenanceIntervalDays ?? ''}
            onChange={(e) =>
              updateEquipment(equipment.id, {
                maintenanceIntervalDays: e.target.value === '' ? undefined : Number(e.target.value),
              })
            }
            className="w-full rounded border border-cp-border bg-cp-surface-1 p-1.5"
          />
        </label>
        </>
        )}

        {/* Lager (Phase 0) — Eigentum, Lagerort, Lieferant, Anschaffung. Nur
            bei aktivem Rental-/Lager-Modul. */}
        {rentalModule && (
        <div className="grid grid-cols-2 gap-2">
          <label className="block">
            <span className="mb-1 block text-cp-text-secondary">
              {t('lifecycle.ownership', 'Ownership')}
            </span>
            <select
              value={equipment.ownership ?? ''}
              onChange={(e) =>
                updateEquipment(equipment.id, {
                  ownership: (e.target.value || undefined) as EquipmentOwnership | undefined,
                })
              }
              className="w-full rounded border border-cp-border bg-cp-surface-1 p-1.5"
            >
              <option value="">{t('lifecycle.ownershipNone', '— n/a —')}</option>
              {EQUIPMENT_OWNERSHIPS.map((o) => (
                <option key={o} value={o}>
                  {t(`lifecycle.ownership.${o}`, EQUIPMENT_OWNERSHIP_LABEL[o])}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="mb-1 block text-cp-text-secondary">
              {t('lifecycle.purchaseDate', 'Purchase date')}
            </span>
            <input
              type="date"
              value={(equipment.purchaseDate ?? '').slice(0, 10)}
              onChange={(e) =>
                updateEquipment(equipment.id, { purchaseDate: e.target.value || undefined })
              }
              className="w-full rounded border border-cp-border bg-cp-surface-1 p-1.5"
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-cp-text-secondary">
              {t('lifecycle.stockLocation', 'Storage location')}
            </span>
            <input
              value={equipment.stockLocation ?? ''}
              onChange={(e) =>
                updateEquipment(equipment.id, { stockLocation: e.target.value || undefined })
              }
              placeholder={t('lifecycle.stockLocationPh', 'e.g. Warehouse A · Shelf 3.2')}
              className="w-full rounded border border-cp-border bg-cp-surface-1 p-1.5"
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-cp-text-secondary">
              {t('lifecycle.supplier', 'Supplier')}
            </span>
            <input
              value={equipment.supplier ?? ''}
              onChange={(e) =>
                updateEquipment(equipment.id, { supplier: e.target.value || undefined })
              }
              className="w-full rounded border border-cp-border bg-cp-surface-1 p-1.5"
            />
          </label>
        </div>
        )}

        {/* Service-Historie — nur bei aktivem Festinstallations-Modul. */}
        {festinstallationModule && (
        <div>
          <div className="mb-1 text-cp-xs font-semibold uppercase tracking-wide text-cp-text-muted">
            {t('lifecycle.history', 'Service history')} ({history.length})
          </div>
          {history.length > 0 && (
            <ul className="mb-2 space-y-1">
              {[...history]
                .sort((a, b) => b.date.localeCompare(a.date))
                .map((r) => (
                  <li key={r.id} className="flex items-start gap-1.5 rounded bg-cp-surface-1 px-2 py-1 text-cp-xs">
                    <span className="shrink-0 font-mono text-cp-text-faint">
                      {new Date(r.date).toLocaleDateString('de-DE')}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="text-cp-text-muted">[{SERVICE_KIND_LABEL[r.kind]}]</span> {r.summary}
                      {r.author ? <span className="text-cp-text-faint"> — {r.author}</span> : null}
                    </span>
                    <button
                      type="button"
                      onClick={() => removeServiceRecord(equipment.id, r.id)}
                      className="shrink-0 rounded p-0.5 text-cp-danger hover:bg-cp-surface-3"
                      aria-label={t('lifecycle.history.delete', 'Delete entry')}
                    >
                      <Icon icon={Trash2} size="xs" />
                    </button>
                  </li>
                ))}
            </ul>
          )}
          <div className="flex gap-1">
            <select
              value={kind}
              onChange={(e) => setKind(e.target.value as ServiceRecord['kind'])}
              className="rounded border border-cp-border bg-cp-surface-1 p-1.5 text-cp-xs"
            >
              {SERVICE_KINDS.map((k) => (
                <option key={k} value={k}>
                  {SERVICE_KIND_LABEL[k]}
                </option>
              ))}
            </select>
            <input
              value={summary}
              onChange={(e) => setSummary(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') onAdd()
              }}
              placeholder={t('lifecycle.history.placeholder', 'What was done?')}
              className="min-w-0 flex-1 rounded border border-cp-border bg-cp-surface-1 p-1.5 text-cp-xs"
            />
            <button
              type="button"
              onClick={onAdd}
              className="inline-flex shrink-0 items-center gap-1 rounded bg-cp-surface-4 px-2 py-1.5 text-cp-xs hover:bg-cp-surface-5"
            >
              <Icon icon={Plus} size="xs" /> {t('common.add', 'Add')}
            </button>
          </div>
        </div>
        )}
      </div>
    </details>
  )
}
