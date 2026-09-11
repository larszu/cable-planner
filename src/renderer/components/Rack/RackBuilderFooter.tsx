import { AlertTriangle } from 'lucide-react'
import { Icon } from '../shared/Icon'
import { useTranslation } from '../../lib/i18n'

/** v7.9.11 — Status-Footer mit drei klaren Zonen:
 *  Links = Stats-Badges (Devices · HE · Cables),
 *  Mitte = Autosave-Indikator,
 *  Rechts = Actions (Intern verkabeln · Abbrechen · Speichern).
 *
 *  Issue #310 — aus RackBuilderDialog ausgelagert. Konsumiert ein
 *  Stats-Bundle (gerendert links) + 3 Callbacks (rechts). */

export interface RackBuilderFooterProps {
  devicesCount: number
  occupiedUnits: number
  totalUnits: number
  internalCablesCount: number
  conflictsCount: number
  dirty: boolean
  editingId?: string
  internWireDisabled: boolean
  onOpenInternalCanvas: () => void
  onCancel: () => void
  onSave: () => void
}

export const RackBuilderFooter = ({
  devicesCount,
  occupiedUnits,
  totalUnits,
  internalCablesCount,
  conflictsCount,
  dirty,
  editingId,
  internWireDisabled,
  onOpenInternalCanvas,
  onCancel,
  onSave,
}: RackBuilderFooterProps) => {
  const t = useTranslation()
  return (
    <div className="mt-3 flex flex-wrap items-center justify-between gap-3 border-t border-cp-border-muted pt-3">
      <div className="flex flex-wrap items-center gap-1.5 text-cp-xs">
        <span className="inline-flex items-center gap-1 bg-cp-surface-2 px-2 py-0.5 text-cp-text-secondary">
          <span className="text-cp-text-faint">{t('rack.devicesLabel', 'Devices:')}</span>
          <strong className="text-cp-text">{devicesCount}</strong>
        </span>
        <span className="inline-flex items-center gap-1 bg-cp-surface-2 px-2 py-0.5 text-cp-text-secondary">
          <span className="text-cp-text-faint">{t('rack.heOccupied', 'U occupied:')}</span>
          <strong className="text-cp-text">{occupiedUnits}</strong>
          <span className="text-cp-text-faint">/ {totalUnits}</span>
        </span>
        {internalCablesCount > 0 && (
          <span
            className="inline-flex items-center gap-1 bg-sky-900/60 px-2 py-0.5 text-sky-200"
            title={t('rack.internalCablingTitle', 'Internal cabling in the rack')}
          >
            <svg width="10" height="10" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M3 8 H13 M3 8 L6 5 M3 8 L6 11 M13 8 L10 5 M13 8 L10 11" />
            </svg>
            <strong>{internalCablesCount}</strong>
            <span>{t('rack.cables', 'cables')}</span>
          </span>
        )}
        {conflictsCount > 0 && (
          <span className="inline-flex items-center gap-1 bg-red-900/60 px-2 py-0.5 text-red-200">
            <Icon icon={AlertTriangle} size="xs" />
            <strong>{conflictsCount}</strong>
            <span>{t('rack.conflictsWord', 'Conflicts')}</span>
          </span>
        )}
      </div>

      <div
        className="flex items-center gap-1.5 text-cp-xs text-cp-text-muted"
        title={
          dirty
            ? t('rack.autosaveActive', 'Autosave runs every few seconds')
            : t('rack.noUnsaved', 'No unsaved changes')
        }
      >
        <span
          className={`inline-block h-1.5 w-1.5 ${
            dirty ? 'animate-pulse bg-amber-400' : 'bg-emerald-500'
          }`}
        />
        <span>{dirty ? t('rack.autosaveActiveLabel', 'Autosave active') : t('rack.savedLabel', 'Saved')}</span>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={onOpenInternalCanvas}
          disabled={internWireDisabled}
          className="inline-flex items-center gap-1.5 border border-sky-600/50 bg-sky-800/40 px-3 py-1.5 text-cp-xs font-medium text-sky-100 hover:bg-sky-700/60 disabled:opacity-50"
          title={t('rack.openInternalCanvas', 'Wire the rack devices internally — full canvas view')}
        >
          <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M3 8 H13 M3 8 L6 5 M3 8 L6 11 M13 8 L10 5 M13 8 L10 11" />
          </svg>
          {t('rack.internalWireBtn', 'Wire internally')}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="px-3 py-1.5 text-cp-xs text-cp-text-muted hover:bg-cp-surface-2 hover:text-cp-text-bright"
        >
          {t('common.cancel', 'Cancel')}
        </button>
        <button
          type="button"
          onClick={onSave}
          className="inline-flex items-center gap-1.5 bg-emerald-600 px-4 py-1.5 text-cp-base font-semibold text-white hover:bg-emerald-500 active:bg-emerald-700"
          title={
            editingId
              ? t('rack.saveEditTitle', 'Save changes to the rack')
              : t('rack.saveNewTitle', 'Save rack as a new library group')
          }
        >
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M3 4 a1 1 0 0 1 1-1 h7 l3 3 v6 a1 1 0 0 1-1 1 H4 a1 1 0 0 1-1-1 z M5 3 v3 h5 v-3 M5 13 v-4 h6 v4" />
          </svg>
          {editingId ? t('common.save', 'Save') : t('rack.saveNewBtn', 'Save rack')}
        </button>
      </div>
    </div>
  )
}
