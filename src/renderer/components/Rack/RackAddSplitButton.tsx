/**
 * v7.9.80 / #170 — Split-Button für den Rack-Builder Library-Add.
 *
 * UI-Design-Rationale: Statt drei gleichberechtigter Buttons (F / Beide / R)
 * ein primärer "+ Ins Rack" Button (= Full-Depth, Default-Verhalten in 95%
 * der Fälle) mit anliegendem Chevron, das ein Mini-Menü mit den Alternativen
 * "Vorne" und "Hinten" öffnet. Klare visuelle Hierarchie: häufigster Klick
 * ist groß und beschriftet, seltenere Optionen sind im Dropdown.
 *
 * Klick auf den Haupt-Button → Full-Depth Add.
 * Klick auf den Chevron → öffnet das Dropdown mit "Vorne (Front-Mount)" und
 * "Hinten (Rear-Mount, z.B. Patchblende)".
 * Außenklick / Escape schließt das Dropdown.
 */
import { useEffect, useRef, useState } from 'react'
import { useTranslation } from '../../lib/i18n'

interface Props {
  onAddFull: () => void
  onAddFront: () => void
  onAddRear: () => void
  primaryLabel?: string
}

export const RackAddSplitButton = ({
  onAddFull,
  onAddFront,
  onAddRear,
  primaryLabel,
}: Props) => {
  const t = useTranslation()
  const resolvedLabel = primaryLabel ?? t('rackAdd.primaryLabel', '+ Ins Rack')
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onDoc = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDoc)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  return (
    <div ref={rootRef} className="relative shrink-0">
      <div className="flex overflow-hidden rounded-cp-control shadow-sm">
        <button
          type="button"
          onClick={onAddFull}
          className="bg-emerald-600 px-2.5 py-1.5 text-[11px] font-semibold text-white transition hover:bg-emerald-500"
          title={t('rackAdd.fullDepthTitle', 'Gerät full-depth (vorne + hinten) ins Rack hinzufügen')}
        >
          {resolvedLabel}
        </button>
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className={`border-l border-emerald-700/60 px-1.5 py-1.5 text-[10px] font-bold text-white transition ${
            open ? 'bg-emerald-700' : 'bg-emerald-600 hover:bg-emerald-500'
          }`}
          aria-expanded={open}
          aria-haspopup="menu"
          title={t('rackAdd.mountOptionsTitle', 'Mount-Optionen (Vorne / Hinten)')}
        >
          ▾
        </button>
      </div>
      {open && (
        <div
          role="menu"
          className="absolute right-0 z-30 mt-1 w-44 overflow-hidden rounded-cp-control border border-cp-border bg-cp-surface-1 text-[11px] shadow-2xl"
        >
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              setOpen(false)
              onAddFront()
            }}
            className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-cp-text-bright hover:bg-cp-surface-2"
          >
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
              <rect x="2" y="3" width="12" height="10" rx="1" stroke="#475569" strokeWidth="1" />
              <rect x="2" y="3" width="12" height="3" fill="#22c55e" />
            </svg>
            <div className="flex flex-col">
              <span className="font-semibold text-emerald-300">{t('rackAdd.frontOnly', 'Nur vorne')}</span>
              <span className="text-[11px] text-cp-text-muted">{t('rackAdd.frontMount', 'Front-Mount')}</span>
            </div>
          </button>
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              setOpen(false)
              onAddFull()
            }}
            className="flex w-full items-center gap-2 border-t border-cp-border-muted bg-cp-surface-2/50 px-3 py-1.5 text-left text-cp-text-bright hover:bg-cp-surface-2"
          >
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
              <rect x="2" y="3" width="12" height="10" rx="1" fill="#64748b" />
            </svg>
            <div className="flex flex-col">
              <span className="font-semibold text-cp-text">{t('rackAdd.fullDepth', 'Full-Depth')}</span>
              <span className="text-[11px] text-cp-text-muted">{t('rackAdd.fullDepthSub', 'vorne + hinten (Default)')}</span>
            </div>
          </button>
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              setOpen(false)
              onAddRear()
            }}
            className="flex w-full items-center gap-2 border-t border-cp-border-muted px-3 py-1.5 text-left text-cp-text-bright hover:bg-cp-surface-2"
          >
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
              <rect x="2" y="3" width="12" height="10" rx="1" stroke="#475569" strokeWidth="1" />
              <rect x="2" y="10" width="12" height="3" fill="#a855f7" />
            </svg>
            <div className="flex flex-col">
              <span className="font-semibold text-purple-300">{t('rackAdd.rearOnly', 'Nur hinten')}</span>
              <span className="text-[11px] text-cp-text-muted">{t('rackAdd.rearMount', 'Rear-Mount (z.B. Patchblende)')}</span>
            </div>
          </button>
        </div>
      )}
    </div>
  )
}
