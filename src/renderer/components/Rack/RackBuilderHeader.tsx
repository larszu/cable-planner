import type { HTMLAttributes, ReactNode } from 'react'
import { useTranslation } from '../../lib/i18n'

/** v7.9.11 — Cleaner Header: deutlicher Titel, State-Pill
 *  (Neu/Bearbeiten/Dirty), Esc-Hint, Export-Menu, X-Close.
 *
 *  Issue #310 — aus RackBuilderDialog ausgelagert. Das ExportMenu
 *  bleibt extern (es haengt am 2D/3D-Canvas-Ref + Draft des
 *  Dialogs) und wird als `exportMenuSlot`-Children durchgereicht.
 *  Die Drag-Handle-Props vom useDraggablePosition werden auf das
 *  Wrapper-<div> gespreitzt, damit der User den Dialog am Header
 *  greifen kann. */

export interface RackBuilderHeaderProps {
  editingId?: string
  rackName: string
  dirty: boolean
  headerProps: HTMLAttributes<HTMLDivElement>
  exportMenuSlot: ReactNode
  onClose: () => void
}

export const RackBuilderHeader = ({
  editingId,
  rackName,
  dirty,
  headerProps,
  exportMenuSlot,
  onClose,
}: RackBuilderHeaderProps) => {
  const t = useTranslation()
  return (
    <div
      {...headerProps}
      className="mb-3 flex items-start justify-between gap-3 select-none"
    >
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <h3 className="truncate text-cp-xl font-semibold text-cp-text">
            {editingId ? rackName || t('rack.unnamedRack', '(unbenanntes Rack)') : t('rack.newRack', 'Neues Rack')}
          </h3>
          <span
            className={`shrink-0 rounded px-1.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide ${
              editingId
                ? 'bg-sky-900/60 text-sky-200'
                : 'bg-emerald-900/60 text-emerald-200'
            }`}
          >
            {editingId ? t('rack.badge.edit', 'Bearbeiten') : t('rack.badge.new', 'Neu')}
          </span>
          {dirty && (
            <span
              className="flex shrink-0 items-center gap-1 rounded bg-amber-900/40 px-1.5 py-0.5 text-[11px] font-semibold text-amber-200"
              title={t('rack.unsavedTitle', 'Ungespeicherte Änderungen')}
            >
              <span className="inline-block h-1.5 w-1.5 rounded-full bg-amber-400" />
              {t('rack.unsavedLabel', 'Ungespeichert')}
            </span>
          )}
        </div>
        <p className="mt-0.5 text-[11px] text-cp-text-muted">
          {t(
            'rack.subtitle',
            '2D Rack Builder · Geräte aus Library hinzufügen, HE-Position per Drag, Verkabelung intern',
          )}
          <span className="ml-2 hidden sm:inline">
            <kbd className="rounded border border-cp-border bg-cp-surface-2 px-1 text-[10px]">Esc</kbd>{' '}
            {t('rack.closeShortcut', 'schließen')}
          </span>
        </p>
      </div>
      {exportMenuSlot}
      <button
        type="button"
        onClick={onClose}
        aria-label={t('common.close', 'Schließen')}
        title={t('rack.closeTitle', 'Schließen (Esc)')}
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-cp-border bg-cp-surface-2 text-cp-text-secondary transition-colors hover:border-red-500/50 hover:bg-red-900/30 hover:text-red-300"
      >
        <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M4 4 L12 12 M12 4 L4 12" />
        </svg>
      </button>
    </div>
  )
}
