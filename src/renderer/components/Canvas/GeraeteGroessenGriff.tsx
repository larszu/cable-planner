// ─── DIE GROESSE EINES GERAETS WIRD GEZOGEN, NICHT GETIPPT ─────────────────
//
// NUTZER-WUNSCH 2026-10-27: „mache in cable planner die groesse der geraete
// responsive anpassbar vom user im canvas".
//
// Der Griff sitzt in der unteren rechten Ecke der Geraetekachel und zieht
// `eq.sizeScale` — einen FAKTOR, keine Breite. Warum kein `NodeResizer` wie
// beim Raum-Rahmen:
//
//   * Der Resizer meldet eine freie Breite und Hoehe. Beide sind an einem
//     Geraet nicht frei: die Hoehe folgt der Zahl der Port-Reihen, und jede
//     Buchse muss auf einem Gitterpunkt des Wegfinders sitzen
//     (`lib/raster.ts`). Eine frei gezogene Hoehe waere entweder gelogen —
//     sie wird beim naechsten Rendern ueberschrieben — oder sie setzt die
//     Buchsen neben das Gitter.
//   * Seine `dimensions`-Meldungen laufen in `CanvasArea` in denselben
//     Rueckschreiber wie die GEMESSENE Groesse (`eq.width`/`eq.height`). Genau
//     diese Vermischung von Absicht und Messung war der Fehler vom
//     2026-09-11, dokumentiert in `lib/equipmentLayout.ts`. Der Griff schreibt
//     deshalb ausschliesslich in das eigene Feld.
//
// WAEHREND des Ziehens bleibt der Faktor lokal: der Griff meldet ihn dem
// Knoten (`onVorschau`), der Knoten rechnet sein Layout damit und folgt dem
// Finger sofort. Erst das Loslassen schreibt EINEN Wert in den Store
// (`onFestlegen`). Haetten wir je Mausbewegung geschrieben, haengte an jedem
// Frame die ganze Kette: Projektzustand, Undo-Eintrag, Autosave, Dirty-Flag —
// 60 Mal je Sekunde, fuer einen Zwischenstand, den niemand behalten will.
//
// Die Auswahl zieht mit: sind mehrere Geraete markiert und man zieht an einem
// davon, bekommen alle denselben Faktor. Das ist der Weg, einen ganzen Plan
// einheitlich groesser zu stellen — ohne eine zweite, globale Einstellung, die
// dann neben den einzelnen Faktoren stuende und ihnen widerspraeche.

import { useRef, useState } from 'react'
import { useReactFlow } from 'reactflow'
import { SKALA_MAX, SKALA_MIN, SKALA_VORGABE, skalaGrenzen } from '../../lib/raster'
import { useTranslation, format } from '../../lib/i18n'

interface Props {
  /** Der aktuelle Faktor des Geraets (fehlt an einem nie angefassten). */
  skala: number | undefined
  /** Die gerenderte Groesse — Bezug fuer das Verhaeltnis beim Ziehen. */
  breite: number
  hoehe: number
  /** Sichtbar nur an der Auswahl oder beim Ueberfahren der Kachel: ein Griff
   *  an jedem Geraet waere bei 40 Geraeten 40 Punkte Rauschen. */
  sichtbar: boolean
  /** Farbe des Griffs — dieselbe Akzentfarbe wie der Auswahlrahmen. */
  farbe: string
  /** Zwischenstand waehrend des Ziehens; `null` beendet die Vorschau. */
  onVorschau: (wert: number | null) => void
  /** Der endgueltige Wert — hier wird geschrieben. */
  onFestlegen: (wert: number) => void
  /**
   * Eine Stufe weiter (Tastatur). BEWUSST keine fertige Zahl, anders als
   * `onFestlegen`: der Aufrufer rechnet sie aus dem STORE-Stand aus, nicht aus
   * dem, was dieser Griff zuletzt gerendert hat. Gemessen am 2026-10-27: auf
   * gedrueckter Pfeiltaste laufen die Tastendruecke schneller ein, als React
   * neu rendert — alle landen dann auf demselben alten Ausgangswert, und die
   * Kachel bleibt nach 24 Druecken eine Stufe weiter stehen. Mit dem
   * Store-Stand je Druck zaehlt jeder einzelne.
   */
  onStufe: (richtung: number, grob: boolean) => void
}

/**
 * Griffmass in Flow-Pixeln. Bewusst NICHT rasterabhaengig und auch nicht
 * mitskaliert: wie `HANDLE_SIZE` ist es eine Fingerkuppe und kein Layoutmass —
 * an einem auf 60 % gestellten Geraet muss er genauso zu treffen sein.
 */
const FLAECHE = 14

export const GeraeteGroessenGriff = ({
  skala,
  breite,
  hoehe,
  sichtbar,
  farbe,
  onVorschau,
  onFestlegen,
  onStufe,
}: Props) => {
  const t = useTranslation()
  const { getZoom } = useReactFlow()
  const [ziehend, setZiehend] = useState(false)
  const zug = useRef<{
    x: number
    y: number
    breite: number
    hoehe: number
    skala: number
    zoom: number
    letzter: number
  } | null>(null)

  const aktuell = skalaGrenzen(skala)

  const beiBewegung = (e: PointerEvent) => {
    const start = zug.current
    if (!start) return
    // Mausweg in FLOW-Pixeln: der Zeiger bewegt sich auf dem Bildschirm, die
    // Kachel liegt im skalierten Viewport. Ohne die Division zoege man bei
    // 50 % Zoom doppelt so schnell wie bei 100 %.
    const dx = (e.clientX - start.x) / start.zoom
    const dy = (e.clientY - start.y) / start.zoom
    // Das groessere der beiden Verhaeltnisse gewinnt. Dadurch laesst sich die
    // Kachel seitlich wie nach unten aufziehen, und das schraege Ziehen nach
    // aussen — was man an einer Ecke intuitiv tut — wirkt in beide Richtungen.
    const verhaeltnis = Math.max(
      (start.breite + dx) / start.breite,
      (start.hoehe + dy) / start.hoehe,
    )
    const wert = skalaGrenzen(start.skala * verhaeltnis)
    if (wert === start.letzter) return
    start.letzter = wert
    onVorschau(wert)
  }

  const beiEnde = () => {
    window.removeEventListener('pointermove', beiBewegung)
    window.removeEventListener('pointerup', beiEnde)
    window.removeEventListener('pointercancel', beiEnde)
    const ziel = zug.current?.letzter
    zug.current = null
    setZiehend(false)
    onVorschau(null)
    if (ziel != null && ziel !== aktuell) onFestlegen(ziel)
  }

  const beiStart = (e: React.PointerEvent) => {
    // Ohne beides zieht ReactFlow die KACHEL statt den Griff.
    e.stopPropagation()
    e.preventDefault()
    zug.current = {
      x: e.clientX,
      y: e.clientY,
      breite,
      hoehe,
      skala: aktuell,
      zoom: getZoom() || 1,
      letzter: aktuell,
    }
    setZiehend(true)
    window.addEventListener('pointermove', beiBewegung)
    window.addEventListener('pointerup', beiEnde)
    window.addEventListener('pointercancel', beiEnde)
  }

  const tasten = (e: React.KeyboardEvent) => {
    // Tastaturweg (WCAG 2.1, 2.1.1). Mit Shift in groesseren Stufen, damit man
    // von 100 % auf 200 % nicht zwanzig Mal tippen muss.
    if (e.key === 'ArrowRight' || e.key === 'ArrowUp') {
      onStufe(1, e.shiftKey)
    } else if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') {
      onStufe(-1, e.shiftKey)
    } else if (e.key === 'Home') {
      onFestlegen(SKALA_VORGABE)
    } else {
      return
    }
    e.preventDefault()
    e.stopPropagation()
  }

  return (
    <div
      role="slider"
      tabIndex={sichtbar ? 0 : -1}
      aria-label={t('canvas.deviceSize.grip', 'Device size')}
      aria-valuemin={SKALA_MIN}
      aria-valuemax={SKALA_MAX}
      aria-valuenow={aktuell}
      aria-valuetext={`${Math.round(aktuell * 100)} %`}
      title={format(
        t(
          'canvas.deviceSize.gripTitle',
          'Drag to resize this device ({percent} %). Double-click resets it, arrow keys step.',
        ),
        { percent: Math.round(aktuell * 100) },
      )}
      onPointerDown={beiStart}
      onDoubleClick={(e) => {
        e.stopPropagation()
        onFestlegen(SKALA_VORGABE)
      }}
      onKeyDown={tasten}
      // `nodrag`/`nopan`: ReactFlow laesst diese Flaeche in Ruhe.
      className="nodrag nopan"
      style={{
        position: 'absolute',
        right: 0,
        bottom: 0,
        width: FLAECHE,
        height: FLAECHE,
        cursor: 'nwse-resize',
        // Zwei schmale Striche als Ecke — ruhig genug, um neben den
        // Port-Punkten nicht als weiterer Anschluss gelesen zu werden.
        background: `linear-gradient(135deg, transparent 0 52%, ${farbe} 52% 66%, transparent 66% 78%, ${farbe} 78% 92%, transparent 92%)`,
        borderBottomRightRadius: 'var(--cp-r-s)',
        opacity: sichtbar || ziehend ? 1 : 0,
        transition: 'opacity 120ms ease',
        pointerEvents: sichtbar || ziehend ? 'auto' : 'none',
        touchAction: 'none',
      }}
    />
  )
}
