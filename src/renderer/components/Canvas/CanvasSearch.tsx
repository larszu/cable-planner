// #ux — Geräte-Suche auf der Canvas.
//
// Bei großen Plänen war ein bestimmtes Gerät kaum zu finden. Diese
// schwebende Suchleiste (oben mittig) filtert die Geräte nach Name /
// Kurzname / Kategorie / Notiz, springt per Klick zum Treffer (Auswahl +
// Zentrieren) und öffnet sich mit Strg/Cmd+F.
import { useEffect, useMemo, useRef, useState } from 'react'
import { Search, X } from 'lucide-react'
import { useCanvasProjectStore } from '../../store/projectStoreContext'
import { triggerCanvasCenterOn } from '../../lib/canvasViewport'
import { useTranslation } from '../../lib/i18n'
import { Icon } from '../shared/Icon'

export const CanvasSearch = () => {
  const t = useTranslation()
  const equipment = useCanvasProjectStore((s) => s.project.equipment)
  const setSelection = useCanvasProjectStore((s) => s.setSelection)
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  // Strg/Cmd+F öffnet + fokussiert die Suche (nicht beim Tippen in Feldern,
  // damit man weiterhin in Eingaben suchen/markieren kann); Esc schließt.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && (e.key === 'f' || e.key === 'F')) {
        const el = document.activeElement
        const typing =
          el instanceof HTMLElement &&
          (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable)
        if (typing) return
        e.preventDefault()
        setOpen(true)
        requestAnimationFrame(() => inputRef.current?.focus())
      } else if (e.key === 'Escape' && open) {
        setOpen(false)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open])

  const results = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return []
    return equipment
      .filter((e) =>
        [e.name, e.shortName, e.category, e.subtitle, e.notes]
          .filter(Boolean)
          .some((v) => String(v).toLowerCase().includes(q)),
      )
      .slice(0, 8)
  }, [query, equipment])

  const goTo = (id: string) => {
    const eq = equipment.find((e) => e.id === id)
    if (!eq) return
    setSelection(id, undefined, undefined)
    triggerCanvasCenterOn(eq.x + eq.width / 2, eq.y + eq.height / 2, 1.2)
    setOpen(false)
    setQuery('')
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => {
          setOpen(true)
          requestAnimationFrame(() => inputRef.current?.focus())
        }}
        className="pointer-events-auto absolute top-3 left-1/2 z-20 flex -translate-x-1/2 items-center gap-2 rounded-cp-control border border-cp-border bg-cp-surface-1 px-cp-3 py-cp-2 text-cp-xs text-cp-text-muted shadow-lg hover:text-cp-text"
        title={t('canvas.search.open', 'Gerät suchen (Strg+F)')}
      >
        <Icon icon={Search} size="sm" />
        {t('canvas.search.placeholder', 'Gerät suchen…')}
      </button>
    )
  }

  return (
    <div className="pointer-events-auto absolute top-3 left-1/2 z-20 w-80 -translate-x-1/2 rounded-cp-modal border border-cp-border bg-cp-surface-1 shadow-2xl">
      <div className="flex items-center gap-2 border-b border-cp-border px-cp-3 py-cp-2">
        <Icon icon={Search} size="sm" />
        <input
          ref={inputRef}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && results[0]) goTo(results[0].id)
          }}
          placeholder={t('canvas.search.placeholder', 'Gerät suchen…')}
          className="flex-1 bg-transparent text-cp-sm text-cp-text outline-none placeholder:text-cp-text-faint"
        />
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="text-cp-text-muted hover:text-cp-text"
          aria-label={t('common.close', 'Schließen')}
        >
          <Icon icon={X} size="sm" />
        </button>
      </div>
      {query.trim() && (
        <ul className="max-h-64 overflow-y-auto py-1">
          {results.length === 0 ? (
            <li className="px-cp-3 py-cp-2 text-cp-xs text-cp-text-faint">
              {t('canvas.search.none', 'Keine Treffer')}
            </li>
          ) : (
            results.map((e) => (
              <li key={e.id}>
                <button
                  type="button"
                  onClick={() => goTo(e.id)}
                  className="flex w-full items-center justify-between gap-2 px-cp-3 py-cp-2 text-left text-cp-sm text-cp-text hover:bg-cp-surface-2"
                >
                  <span className="truncate">{e.name}</span>
                  <span className="shrink-0 text-cp-xs text-cp-text-faint">{e.category}</span>
                </button>
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  )
}
