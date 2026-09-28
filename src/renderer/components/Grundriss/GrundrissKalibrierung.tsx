import { useEffect, useRef, useState } from 'react'
import { useReactFlow, useViewport } from 'reactflow'
import { useCanvasProjectStore as useProjectStore } from '../../store/projectStoreContext'
import { useGrundrissUi } from '../../store/grundrissUiStore'
import { eckenGueltig } from '../../lib/grundriss/massstab'
import { useTranslation, format } from '../../lib/i18n'
import type { PlanPunkt } from '../../types/grundriss'

/**
 * Punkte fuer die Kalibrierung auf dem Canvas abgreifen.
 *
 * Kein Fang-Overlay ueber dem Canvas: das nahm Zoom und Verschieben weg, und
 * gerade fuer das Treffen einer Ecke will man hineinzoomen. Stattdessen
 * werden Klicks in der Capture-Phase abgefangen — aber nur solche ohne
 * Mausbewegung. Ein Ziehen bleibt ein Verschieben der Ansicht.
 */
export const GrundrissKalibrierung = () => {
  const t = useTranslation()
  const laufend = useGrundrissUi((s) => s.kalibrierung)
  const starte = useGrundrissUi((s) => s.starteKalibrierung)
  const kalibriere = useProjectStore((s) => s.kalibriereGrundriss)
  const { screenToFlowPosition, flowToScreenPosition } = useReactFlow()
  useViewport()
  const [punkte, setPunkte] = useState<PlanPunkt[]>([])
  const [fehler, setFehler] = useState<'ecken' | null>(null)
  const unten = useRef<{ x: number; y: number } | null>(null)
  const punkteRef = useRef<PlanPunkt[]>([])
  const noetig = laufend?.art === 'rechteck' ? 4 : 2

  // Beim Wechsel der Kalibrierung beginnt die Punktliste von vorn.
  const [vorher, setVorher] = useState(laufend)
  if (vorher !== laufend) {
    setVorher(laufend)
    setPunkte([])
    setFehler(null)
  }

  // Nur beim Wechsel der Kalibrierung von vorn. NICHT im Abhoer-Effekt
  // unten: der meldet sich bei jedem Render neu an, und ein Leeren dort
  // verloer jeden Punkt, sobald der naechste Klick neu rendert.
  useEffect(() => {
    punkteRef.current = []
  }, [laufend])

  useEffect(() => {
    if (!laufend) return
    const imCanvas = (e: Event) => (e.target as HTMLElement | null)?.closest?.('.react-flow__pane, .react-flow__node')
    const onDown = (e: PointerEvent) => {
      unten.current = imCanvas(e) ? { x: e.clientX, y: e.clientY } : null
    }
    const onClick = (e: MouseEvent) => {
      const u = unten.current
      if (!u || Math.hypot(e.clientX - u.x, e.clientY - u.y) > 4) return
      e.stopPropagation()
      e.preventDefault()
      const neu = [...punkteRef.current, screenToFlowPosition({ x: e.clientX, y: e.clientY })]
      punkteRef.current = neu
      setPunkte(neu)
      if (neu.length < noetig) return
      punkteRef.current = []
      setPunkte([])
      if (laufend.art === 'zweiPunkt') {
        kalibriere({ art: 'zweiPunkt', a: neu[0], b: neu[1], meter: laufend.meter })
      } else {
        const ecken = neu.slice(0, 4) as [PlanPunkt, PlanPunkt, PlanPunkt, PlanPunkt]
        if (!eckenGueltig(ecken)) {
          setFehler('ecken')
          return
        }
        kalibriere({ art: 'rechteck', ecken, breiteM: laufend.breiteM, tiefeM: laufend.tiefeM })
      }
      starte(null)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') starte(null)
    }
    window.addEventListener('pointerdown', onDown, true)
    window.addEventListener('click', onClick, true)
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('pointerdown', onDown, true)
      window.removeEventListener('click', onClick, true)
      window.removeEventListener('keydown', onKey)
    }
  }, [laufend, noetig, kalibriere, starte, screenToFlowPosition])

  if (!laufend) return null
  const bildschirm = punkte.map((p) => flowToScreenPosition(p))
  const hinweis =
    laufend.art === 'zweiPunkt'
      ? format(t('floorplan.calibrate.twoPointHint', 'Click both ends of a distance of {m} m.'), { m: laufend.meter })
      : format(
          t('floorplan.calibrate.rectHint', 'Click the four corners of the {w} × {d} m area: top left, top right, bottom right, bottom left.'),
          { w: laufend.breiteM, d: laufend.tiefeM },
        )
  return (
    <>
      <svg style={{ position: 'fixed', inset: 0, width: '100vw', height: '100vh', pointerEvents: 'none', zIndex: 2 }}>
        {bildschirm.length > 1 && (
          <polyline
            points={bildschirm.map((p) => `${p.x},${p.y}`).join(' ')}
            stroke="var(--cp-signal)"
            strokeWidth={2}
            fill="none"
          />
        )}
        {bildschirm.map((p, i) => (
          <g key={i}>
            <line x1={p.x - 8} y1={p.y} x2={p.x + 8} y2={p.y} stroke="var(--cp-signal)" strokeWidth={2} />
            <line x1={p.x} y1={p.y - 8} x2={p.x} y2={p.y + 8} stroke="var(--cp-signal)" strokeWidth={2} />
          </g>
        ))}
      </svg>
      <div className="fixed left-1/2 top-16 -translate-x-1/2 z-30 bg-cp-surface-2 border border-cp-border px-3 py-2 text-sm text-cp-text flex items-center gap-3">
        <span>
          {hinweis} {format(t('floorplan.calibrate.progress', '{n} of {total}'), { n: punkte.length, total: noetig })}
        </span>
        {fehler === 'ecken' && (
          <span className="text-cp-danger">
            {t('floorplan.calibrate.badCorners', 'The four corners do not form a rectangle outline. Click them in order around the area, starting top left.')}
          </span>
        )}
        <button className="px-2 py-0.5 border border-cp-border hover:bg-cp-surface-3" onClick={() => starte(null)}>
          {t('common.cancel', 'Cancel')}
        </button>
      </div>
    </>
  )
}
