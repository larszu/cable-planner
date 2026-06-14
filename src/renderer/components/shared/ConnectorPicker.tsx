/**
 * #170 / Patchblende — Visueller Connector-Picker.
 *
 * Ersetzt das flache `<select>` im Patchblenden-Dialog durch ein
 * Feld-mit-Popover: der Trigger zeigt das aktuell gewählte Steckersymbol +
 * Label, das Popover eine durchsuchbare, nach Kategorie gruppierte Kachel-
 * Palette (Audio / MIDI / Video / Data / Fiber / Power / …). Legacy- und
 * Custom-Connector-Typen werden über `extraTypes` mit eingeblendet, damit
 * nichts aus der bisherigen Auswahl verloren geht.
 *
 * Das Popover rendert via Portal an document.body (fixed positioniert aus
 * dem Trigger-Rect), damit es nicht vom scrollenden Modal-Body geclippt wird.
 */
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { ChevronDown, Search } from 'lucide-react'
import {
  buildConnectorGroups,
  connectorColor,
  connectorColorById,
  connectorLabel,
  findConnectorEntry,
  type ConnectorCatalogEntry,
} from '../../lib/connectorCatalog'
import { useTranslation } from '../../lib/i18n'
import { ConnectorSymbol } from './ConnectorSymbol'

interface ConnectorPickerProps {
  value: string
  onChange: (id: string) => void
  /** Zusätzliche Legacy-/Custom-Typen, die nicht im Katalog stehen. */
  extraTypes?: string[]
  /** 'sm' für die dichte Per-Port-Tabelle, 'md' (Default) für die Basics-Seite. */
  size?: 'sm' | 'md'
  ariaLabel?: string
}

const tileSymbolFor = (entry: ConnectorCatalogEntry) => (
  <ConnectorSymbol
    symbol={entry.symbol}
    pins={entry.pins}
    poles={entry.poles}
    gender={entry.gender}
    flow={entry.flow}
    mini={entry.mini}
    size={34}
  />
)

export const ConnectorPicker = ({
  value,
  onChange,
  extraTypes = [],
  size = 'md',
  ariaLabel,
}: ConnectorPickerProps) => {
  const t = useTranslation()
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const triggerRef = useRef<HTMLButtonElement>(null)
  const popRef = useRef<HTMLDivElement>(null)
  const [pos, setPos] = useState<{ left: number; top: number; width: number } | null>(null)

  const groups = useMemo(() => buildConnectorGroups(extraTypes), [extraTypes])
  const selected = findConnectorEntry(value)

  const filteredGroups = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return groups
    return groups
      .map((g) => ({
        ...g,
        entries: g.entries.filter(
          (e) => e.label.toLowerCase().includes(q) || e.id.toLowerCase().includes(q),
        ),
      }))
      .filter((g) => g.entries.length > 0)
  }, [groups, query])

  const place = () => {
    const el = triggerRef.current
    if (!el) return
    const r = el.getBoundingClientRect()
    const width = Math.max(r.width, 320)
    const maxH = 360
    const below = window.innerHeight - r.bottom
    const top = below < maxH + 12 && r.top > below ? Math.max(8, r.top - maxH - 6) : r.bottom + 6
    const left = Math.min(Math.max(8, r.left), window.innerWidth - width - 8)
    setPos({ left, top, width })
  }

  useLayoutEffect(() => {
    if (!open) return
    place()
    const onScroll = () => place()
    window.addEventListener('scroll', onScroll, true)
    window.addEventListener('resize', onScroll)
    return () => {
      window.removeEventListener('scroll', onScroll, true)
      window.removeEventListener('resize', onScroll)
    }
  }, [open])

  useEffect(() => {
    if (!open) return
    const onDoc = (e: MouseEvent) => {
      const target = e.target as Node
      if (popRef.current?.contains(target) || triggerRef.current?.contains(target)) return
      setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation()
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', onDoc)
    document.addEventListener('keydown', onKey, true)
    return () => {
      document.removeEventListener('mousedown', onDoc)
      document.removeEventListener('keydown', onKey, true)
    }
  }, [open])

  const pick = (id: string) => {
    onChange(id)
    setOpen(false)
    setQuery('')
  }

  const triggerColor = connectorColorById(value)

  return (
    <>
      <button
        type="button"
        ref={triggerRef}
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={ariaLabel}
        className={`flex w-full items-center gap-2 rounded border border-cp-border bg-cp-surface-3 text-left text-cp-text-bright hover:border-slate-500 ${
          size === 'sm' ? 'px-1.5 py-1' : 'px-2 py-1.5'
        }`}
      >
        <span
          className="flex shrink-0 items-center justify-center rounded"
          style={{ color: triggerColor }}
        >
          {selected ? (
            tileSymbolFor(selected)
          ) : (
            <ConnectorSymbol symbol="generic" size={size === 'sm' ? 22 : 28} />
          )}
        </span>
        <span className={`flex-1 truncate ${size === 'sm' ? 'text-[11px]' : 'text-cp-base'}`}>
          {connectorLabel(value)}
        </span>
        <ChevronDown size={14} className="shrink-0 text-cp-text-faint" />
      </button>

      {open &&
        pos &&
        createPortal(
          <div
            ref={popRef}
            role="dialog"
            className="fixed z-[300] flex max-h-[360px] flex-col overflow-hidden rounded-cp-card border border-cp-border bg-cp-surface-1 shadow-2xl"
            style={{ left: pos.left, top: pos.top, width: pos.width }}
          >
            <div className="flex items-center gap-2 border-b border-cp-border-muted px-2 py-1.5">
              <Search size={14} className="shrink-0 text-cp-text-faint" />
              <input
                autoFocus
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={t('connector.picker.search', 'Stecker suchen…')}
                aria-label={t('connector.picker.search', 'Stecker suchen…')}
                className="w-full bg-transparent text-cp-base text-cp-text-bright outline-none placeholder:text-cp-text-dim"
              />
            </div>
            <div className="flex-1 overflow-y-auto p-2">
              {filteredGroups.length === 0 && (
                <div className="px-2 py-6 text-center text-cp-xs text-cp-text-faint">
                  {t('connector.picker.noResults', 'Kein Stecker gefunden')}
                </div>
              )}
              {filteredGroups.map((g) => (
                <div key={g.category.id} className="mb-2 last:mb-0">
                  <div
                    className="mb-1 flex items-center gap-1.5 px-1 text-[10px] font-semibold tracking-wide uppercase"
                    style={{ color: g.category.color }}
                  >
                    <span
                      className="inline-block h-2 w-2 rounded-full"
                      style={{ background: g.category.color }}
                    />
                    {t(`connector.cat.${g.category.id}`, g.category.de)}
                  </div>
                  <div className="grid grid-cols-3 gap-1">
                    {g.entries.map((e) => {
                      const active = e.id === value
                      return (
                        <button
                          key={e.id}
                          type="button"
                          onClick={() => pick(e.id)}
                          title={e.label}
                          className={`flex flex-col items-center gap-1 rounded border px-1 py-1.5 text-center transition ${
                            active
                              ? 'border-sky-500 bg-sky-500/10'
                              : 'border-cp-border-muted bg-cp-surface-3/40 hover:border-cp-surface-5 hover:bg-cp-surface-2/60'
                          }`}
                        >
                          <span style={{ color: connectorColor(e) }}>{tileSymbolFor(e)}</span>
                          <span className="w-full truncate text-[11px] leading-tight text-cp-text-secondary">
                            {e.label}
                          </span>
                        </button>
                      )
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>,
          document.body,
        )}
    </>
  )
}
