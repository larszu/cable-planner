// #ux — Geräte-Suche auf der Canvas.
//
// Bei großen Plänen war ein bestimmtes Gerät kaum zu finden. Diese
// schwebende Suchleiste (Default oben mittig) springt per Klick zum Treffer
// (Auswahl + Zentrieren) und öffnet sich mit Strg/Cmd+F.
//
// BEDARF 76: sie filtert nicht mehr selbst. Bis 2026-09-06 stand hier eine
// eigene Feldliste — Name, Kurzname, Kategorie, Untertitel, Notiz — und wer
// mitten in der Show eine IP-Adresse eintippte, bekam nichts, obwohl der Plan
// sie kennt. Die Trefferliste kommt jetzt aus `lookupInPlan`, der einen
// Engstelle; sie sucht über jede Identität, die ein Gerät trägt, und liefert
// die Antwort gleich mit: Adressen, VLAN, Switch-Port, Ort, Rack. Die
// Zusammenfassung steht unter dem Namen, der Grund daneben, wenn der Treffer
// nicht auf dem Namen saß — sonst hält man das Gerät, dessen Notiz die
// Adresse nennt, für das, das sie trägt.
//
// Verschiebbar: am Grip-Griff (links) lässt sich die Leiste frei
// positionieren; die Lage wird im uiStore gemerkt (canvasSearchPos).
import { useEffect, useMemo, useRef, useState } from 'react'
import { Search, X, GripVertical } from 'lucide-react'
import { useCanvasProjectStore } from '../../store/projectStoreContext'
import { useUiStore } from '../../store/uiStore'
import { triggerCanvasCenterOn } from '../../lib/canvasViewport'
import { answerSummary, lookupInPlan, matchNote, type LookupField } from '../../lib/showLookup'
import { useTranslation } from '../../lib/i18n'
import { Icon } from '../shared/Icon'

export const CanvasSearch = () => {
  const t = useTranslation()
  const equipment = useCanvasProjectStore((s) => s.project.equipment)
  const cables = useCanvasProjectStore((s) => s.project.cables)
  const locations = useCanvasProjectStore((s) => s.project.locations)
  const checkedCables = useCanvasProjectStore((s) => s.project.checkState?.cables)
  const setSelection = useCanvasProjectStore((s) => s.setSelection)
  const pos = useUiStore((s) => s.canvasSearchPos)
  const setPos = useUiStore((s) => s.setCanvasSearchPos)
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)

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

  const results = useMemo(
    () =>
      lookupInPlan(
        { equipment, cables, locations, ...(checkedCables ? { checkedCables } : {}) },
        query,
        { limit: 8 },
      ),
    [query, equipment, cables, locations, checkedCables],
  )

  // Das Trefferfeld im Klartext. Deutsch ist Quelle, wie überall.
  const feldName = (f: LookupField): string =>
    ({
      name: t('canvas.search.f.name', 'Name'),
      shortName: t('canvas.search.f.shortName', 'Kurzname'),
      ip: t('canvas.search.f.ip', 'IP'),
      mac: t('canvas.search.f.mac', 'MAC'),
      vlan: t('canvas.search.f.vlan', 'VLAN'),
      assetTag: t('canvas.search.f.assetTag', 'Inventar-Nr.'),
      serial: t('canvas.search.f.serial', 'Seriennummer'),
      qrId: t('canvas.search.f.qrId', 'Etiketten-Code'),
      switchPort: t('canvas.search.f.switchPort', 'Switch-Port'),
      category: t('canvas.search.f.category', 'Kategorie'),
      subtitle: t('canvas.search.f.subtitle', 'Untertitel'),
      notes: t('canvas.search.f.notes', 'Notiz'),
    })[f]

  const goTo = (id: string) => {
    const eq = equipment.find((e) => e.id === id)
    if (!eq) return
    setSelection(id, undefined, undefined)
    triggerCanvasCenterOn(eq.x + eq.width / 2, eq.y + eq.height / 2, 1.2)
    setOpen(false)
    setQuery('')
  }

  // Verschieben per Grip-Griff. Beim ersten Greifen wird die aktuell
  // gerenderte Lage (auch die Default-Zentrierung) in px übernommen, danach
  // dem Cursor gefolgt und auf die Canvas-Fläche geclampt.
  const startDrag = (e: React.PointerEvent) => {
    e.preventDefault()
    e.stopPropagation()
    const el = containerRef.current
    const parent = el?.offsetParent as HTMLElement | null
    if (!el || !parent) return
    const rect = el.getBoundingClientRect()
    const prect = parent.getBoundingClientRect()
    const startX = rect.left - prect.left
    const startY = rect.top - prect.top
    const w = rect.width
    const h = rect.height
    const startMouseX = e.clientX
    const startMouseY = e.clientY
    const onMove = (ev: PointerEvent) => {
      const maxX = Math.max(0, prect.width - w)
      const maxY = Math.max(0, prect.height - h)
      const nx = Math.min(Math.max(0, startX + (ev.clientX - startMouseX)), maxX)
      const ny = Math.min(Math.max(0, startY + (ev.clientY - startMouseY)), maxY)
      setPos({ x: nx, y: ny })
    }
    const onUp = () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
    }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
  }

  // Positionierung: Default oben mittig (pos === null), sonst freie px-Lage.
  const posClass = pos ? '' : 'top-3 left-1/2 -translate-x-1/2'
  const posStyle = pos ? { left: pos.x, top: pos.y } : undefined

  const Grip = (
    <button
      type="button"
      onPointerDown={startDrag}
      onClick={(e) => e.stopPropagation()}
      className="cursor-grab text-cp-text-faint hover:text-cp-text active:cursor-grabbing"
      title={t('canvas.search.move', 'Suchleiste verschieben')}
      aria-label={t('canvas.search.move', 'Suchleiste verschieben')}
    >
      <Icon icon={GripVertical} size="sm" />
    </button>
  )

  if (!open) {
    return (
      <div
        ref={containerRef}
        className={`pointer-events-auto absolute z-20 flex items-center gap-1 rounded-cp-control border border-cp-border bg-cp-surface-1 px-cp-2 py-cp-2 shadow-lg ${posClass}`}
        style={posStyle}
      >
        {Grip}
        <button
          type="button"
          onClick={() => {
            setOpen(true)
            requestAnimationFrame(() => inputRef.current?.focus())
          }}
          className="flex items-center gap-2 text-cp-xs text-cp-text-muted hover:text-cp-text"
          title={t('canvas.search.open', 'Gerät suchen (Strg+F)')}
        >
          <Icon icon={Search} size="sm" />
          {t('canvas.search.placeholder', 'Gerät suchen…')}
        </button>
      </div>
    )
  }

  return (
    <div
      ref={containerRef}
      className={`pointer-events-auto absolute z-20 w-80 rounded-cp-modal border border-cp-border bg-cp-surface-1 shadow-2xl ${posClass}`}
      style={posStyle}
    >
      <div className="flex items-center gap-2 border-b border-cp-border px-cp-3 py-cp-2">
        {Grip}
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
            results.map((a) => {
              const summe = answerSummary(a)
              const grund = matchNote(a, feldName)
              return (
                <li key={a.id}>
                  <button
                    type="button"
                    onClick={() => goTo(a.id)}
                    className="w-full px-cp-3 py-cp-2 text-left hover:bg-cp-surface-2"
                  >
                    <span className="flex items-center justify-between gap-2">
                      <span className="truncate text-cp-sm text-cp-text">{a.name}</span>
                      <span className="shrink-0 text-cp-xs text-cp-text-faint">{a.category}</span>
                    </span>
                    {summe && (
                      <span className="mt-0.5 block truncate text-cp-xs text-cp-text-secondary">
                        {summe}
                      </span>
                    )}
                    {grund && (
                      <span className="mt-0.5 block truncate text-cp-xs text-cp-text-faint">
                        {grund}
                      </span>
                    )}
                    {a.dependents.length > 0 && (
                      <span className="mt-0.5 block truncate text-cp-xs text-cp-text-faint">
                        {t('canvas.search.depends', '{n} daran: {liste}')
                          .replace('{n}', String(a.dependents.length))
                          .replace(
                            '{liste}',
                            a.dependents
                              .slice(0, 3)
                              .map((d) => `${d.name} (${d.viaPort})`)
                              .join(', '),
                          )}
                      </span>
                    )}
                  </button>
                </li>
              )
            })
          )}
        </ul>
      )}
    </div>
  )
}
