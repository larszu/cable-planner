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
//
// ─── SCHLIESSEN UND WIEDER ÖFFNEN (Nutzer-Meldung 2026-09-11) ─────────────
//
// „Man muss ‚Gerät suchen' … auch schliessen können und über das ‚Ansicht'
// Menü in der oberen Leiste auch wieder öffnen können."
//
// Bis dahin gab es nur das Einklappen: aus dem Panel wurde eine Pille, und
// die stand weiter da. Auf einem vollen Plan ist auch eine Pille Fläche, die
// jemand braucht. Es gibt jetzt DREI Zustände statt zwei, und sie sind
// bewusst unterscheidbar:
//
//   ausgeklappt  — Feld und Trefferliste. `−` klappt ein, `×` schliesst.
//   eingeklappt  — die Pille. Klick klappt aus, `×` schliesst.
//   geschlossen  — nichts. Zurück über Ansicht → „Gerät suchen" oder Strg+F.
//
// WARUM DIESE KOMPONENTE GEMOUNTET BLEIBT, WENN SIE NICHTS ZEICHNET: an ihr
// hängt der Strg+F-Hörer. Würde sie am Aufrufort ausgehängt, gäbe es den
// Weg zurück über die Tastatur nicht mehr — und eine geschlossene Leiste,
// deren Tastenkürzel auch weg ist, ist für den Nutzer verschwunden. Sie
// gibt deshalb `null` zurück, statt nicht zu existieren.
import { useEffect, useMemo, useRef, useState } from 'react'
import { Search, X, Minus, GripVertical } from 'lucide-react'
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
  const visible = useUiStore((s) => s.canvasSearchVisible)
  const setVisible = useUiStore((s) => s.setCanvasSearchVisible)
  const toolbarVisible = useUiStore((s) => s.canvasToolbarVisible)
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  // Strg/Cmd+F öffnet + fokussiert die Suche (nicht beim Tippen in Feldern,
  // damit man weiterhin in Eingaben suchen/markieren kann); Esc schließt.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && (e.key === 'f' || e.key === 'F')) {
        // ─── `e.target` UND NICHT `document.activeElement` ────────────────
        //
        // GEMESSEN am 2026-09-11: Strg+F oeffnete die geschlossene Suche
        // NICHT. Der Grund lag nicht hier, sondern eine Datei weiter:
        // `LocalEquipmentTab` haengt einen ZWEITEN Strg+F-Hoerer an dasselbe
        // `window` und fokussiert damit sein eigenes Suchfeld. Er ist frueher
        // dran — und danach steht in `document.activeElement` ein INPUT, das
        // vor dem Tastendruck noch nicht dort war. Diese Zeile las das als
        // „der Nutzer tippt gerade" und gab auf.
        //
        // `e.target` ist, wo die Taste WIRKLICH passiert ist. Es aendert sich
        // nicht dadurch, dass ein anderer Hoerer den Fokus verschiebt.
        // Dieselbe Form benutzt der Hoerer in `LocalEquipmentTab` schon.
        //
        // Die Absicht bleibt unveraendert: wer in einem Feld tippt, behaelt
        // sein Strg+F zum Suchen im Text.
        const el = e.target
        const typing =
          el instanceof HTMLElement &&
          (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable)
        if (typing) return
        e.preventDefault()
        // Strg+F ist der Weg zurueck aus dem geschlossenen Zustand — deshalb
        // setzt es BEIDES. Nur `setOpen(true)` liesse eine geschlossene
        // Leiste geschlossen, und das Kuerzel taete scheinbar nichts.
        setVisible(true)
        setOpen(true)
        requestAnimationFrame(() => inputRef.current?.focus())
      } else if (e.key === 'Escape' && open) {
        // Esc klappt ein und schliesst NICHT. Wer die Leiste versehentlich
        // wegdrueckt, soll sie nicht im Menue suchen muessen.
        setOpen(false)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, setVisible])

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
      shortName: t('canvas.search.f.shortName', 'Short name'),
      ip: t('canvas.search.f.ip', 'IP'),
      mac: t('canvas.search.f.mac', 'MAC'),
      vlan: t('canvas.search.f.vlan', 'VLAN'),
      assetTag: t('canvas.search.f.assetTag', 'Asset no.'),
      serial: t('canvas.search.f.serial', 'Serial number'),
      qrId: t('canvas.search.f.qrId', 'Label code'),
      switchPort: t('canvas.search.f.switchPort', 'Switch port'),
      category: t('canvas.search.f.category', 'Category'),
      subtitle: t('canvas.search.f.subtitle', 'Subtitle'),
      notes: t('canvas.search.f.notes', 'Note'),
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
  // ─────────────────────────────────────────────────────────────────────
  // WO DIE LEISTE LANDET, WENN SIE NIEMAND VERSCHOBEN HAT.
  //
  // Bis 2026-09-07 war das `top-3 left-1/2` — oben MITTIG. Genau dort liegt
  // die Canvas-Werkzeugleiste: sie beginnt bei `left: 8` und ist bis zu
  // 880 px breit, die Mitte einer 1070 px breiten Flaeche liegt also
  // mitten in ihr. Gemessen im laufenden Fenster: die Suchleiste verdeckte
  // die Ebenen-Schalter „Audio", „Control" und „Network" — drei Schalter,
  // die man nicht sieht und nicht trifft.
  //
  // Die Leiste UMBRICHT (`flexWrap: 'wrap'`), ihre Hoehe haengt also von
  // Fensterbreite, Sprache und Auswahl ab. Eine feste Zahl waere hier nur
  // eine andere Kollision, deshalb wird gemessen: die Suche setzt sich
  // unter die tatsaechliche Unterkante der Werkzeugleiste.
  const [toolbarBottom, setToolbarBottom] = useState(0)
  useEffect(() => {
    const eigen = containerRef.current
    const wurzel = eigen?.offsetParent ?? document.body
    const leiste = wurzel.querySelector<HTMLElement>('[data-cp-canvas-toolbar]')
    if (!leiste) {
      // Keine Leiste da — also auch keine Unterkante, unter die man muesste.
      // Das Zuruecksetzen ist der Punkt: ohne es behielte die Suche den
      // zuletzt gemessenen Abstand und staende nach dem Schliessen der
      // Werkzeugleiste allein in der Luft.
      setToolbarBottom(0)
      return
    }
    const messen = () => {
      const r = leiste.getBoundingClientRect()
      const w = wurzel.getBoundingClientRect()
      setToolbarBottom(Math.round(r.bottom - w.top))
    }
    messen()
    const ro = new ResizeObserver(messen)
    ro.observe(leiste)
    ro.observe(wurzel)
    return () => ro.disconnect()
    // `open` haengt drin, weil die Leiste im geschlossenen Zustand ein
    // anderes Element ist und `containerRef` dann neu zeigt.
    // `toolbarVisible` haengt drin, weil die Werkzeugleiste dann gar nicht
    // mehr im Dokument steht — der ResizeObserver auf einem entfernten
    // Element meldet nichts mehr, und ohne diese Abhaengigkeit bliebe die
    // alte Zahl stehen.
  }, [open, visible, toolbarVisible])

  const posClass = pos ? '' : 'left-1/2 -translate-x-1/2'
  const posStyle = pos
    ? { left: pos.x, top: pos.y }
    : { top: toolbarBottom > 0 ? toolbarBottom + 8 : 12 }

  /**
   * Trefferflaeche der drei Kopfzeilen-Knoepfe: 24 x 24 (WCAG 2.2 AA), bei
   * unveraendertem 14-px-Symbol. Vorher trugen sie die Groesse des Symbols
   * selbst, also 14 x 14 — gemessen von `ui:targets` am 2026-09-11 als die
   * kleinsten Flaechen ausserhalb der Seitenleiste.
   *
   * Die 44 px der Apple-Marke erreichen sie bewusst NICHT: diese Leiste
   * schwebt ueber dem Plan, und 44 px je Knopf machten aus der schmalen
   * Zeile einen Block, der genau die Flaeche verdeckt, um derentwillen es
   * den Schliessen-Knopf ueberhaupt gibt. `ui-targets.mjs` fuehrt sie
   * deshalb weiter unter „unter 44 px" — mit Begruendung an seinem Deckel.
   */
  const kopfKnopf = 'inline-flex h-6 w-6 items-center justify-center'

  // Ein Knopf, zwei Fundstellen (Pille und Panel) — und genau deshalb steht
  // er hier einmal: zwei Fassungen desselben Knopfes waeren die Defektform
  // `zwei-rechnungen`, hier mit einem Beschriftungs-Unterschied als Ausgang.
  const Schliessen = (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation()
        setVisible(false)
      }}
      className={`${kopfKnopf} text-cp-text-faint hover:text-cp-text`}
      title={t(
        'canvas.search.close',
        'Close search (View menu or Ctrl+F brings it back)',
      )}
      aria-label={t(
        'canvas.search.close',
        'Close search (View menu or Ctrl+F brings it back)',
      )}
    >
      <Icon icon={X} size="sm" />
    </button>
  )

  const Grip = (
    <button
      type="button"
      onPointerDown={startDrag}
      onClick={(e) => e.stopPropagation()}
      className={`${kopfKnopf} cursor-grab text-cp-text-faint hover:text-cp-text active:cursor-grabbing`}
      title={t('canvas.search.move', 'Move search bar')}
      aria-label={t('canvas.search.move', 'Move search bar')}
      // Zieh-Griff, kein Knopf — siehe `ui:labels`.
      data-cp-drag-handle=""
    >
      <Icon icon={GripVertical} size="sm" />
    </button>
  )

  // Geschlossen. Die Komponente bleibt gemountet (siehe Kopfkommentar) —
  // ohne sie gaebe es Strg+F nicht mehr.
  if (!visible) return null

  if (!open) {
    return (
      <div
        ref={containerRef}
        className={`pointer-events-auto absolute z-20 flex items-center gap-1 rounded-cp-control border border-cp-border bg-cp-surface-1 px-cp-2 py-cp-2 ${posClass}`}
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
          title={t('canvas.search.open', 'Find device (Ctrl+F)')}
        >
          <Icon icon={Search} size="sm" />
          {t('canvas.search.placeholder', 'Find device…')}
        </button>
        {Schliessen}
      </div>
    )
  }

  return (
    <div
      ref={containerRef}
      className={`pointer-events-auto absolute z-20 w-80 rounded-cp-modal border border-cp-border bg-cp-surface-1 ${posClass}`}
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
          placeholder={t('canvas.search.placeholder', 'Find device…')}
          className="flex-1 bg-transparent text-cp-sm text-cp-text outline-none placeholder:text-cp-text-faint"
        />
        {/* Zwei Knoepfe, zwei verschiedene Dinge — und das ist der ganze
            Punkt der Aenderung: `−` klappt zur Pille ein (wie bisher `×`),
            `×` schliesst ganz. Ein Knopf, der beides koennte, muesste sich
            fuer eine Bedeutung entscheiden, und die andere waere weg. */}
        <button
          type="button"
          onClick={() => setOpen(false)}
          className={`${kopfKnopf} text-cp-text-muted hover:text-cp-text`}
          title={t('canvas.search.collapse', 'Collapse to a pill')}
          aria-label={t('canvas.search.collapse', 'Collapse to a pill')}
        >
          <Icon icon={Minus} size="sm" />
        </button>
        {Schliessen}
      </div>
      {query.trim() && (
        <ul className="max-h-64 overflow-y-auto py-1">
          {results.length === 0 ? (
            <li className="px-cp-3 py-cp-2 text-cp-xs text-cp-text-faint">
              {t('canvas.search.none', 'No matches')}
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
                        {t('canvas.search.depends', '{n} attached: {liste}')
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
