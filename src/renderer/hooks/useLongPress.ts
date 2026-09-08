/**
 * Der lange Druck — der Rechtsklick fuer Geraete, die keinen haben (B-44).
 *
 * ═══════════════════════════════════════════════════════════════════════
 * DER BEFUND
 * ═══════════════════════════════════════════════════════════════════════
 *
 * Rueckmeldung des Eigentuemers, 2026-09-08: „Die ganze Anwendung ist auch
 * noch nicht touch optimiert."
 *
 * Nachgemessen im Renderer: DREI Funktionen haengen ausschliesslich am
 * Rechtsklick — der Wegpunkt eines Kabels (`CableWaypoints`), das
 * Ebenen-Chip-Menue (`LayerVisibilityChips`) und der Seitenverweis-Knoten
 * (`OffPageConnectorSymbol`). Und es gab NULL Ersatz dafuer: kein
 * `onTouchStart`, kein Zeiger-Ereignis, nichts. Auf einem Tablet sind diese
 * drei Funktionen also nicht schwer erreichbar, sondern NICHT VORHANDEN.
 *
 * ═══════════════════════════════════════════════════════════════════════
 * WARUM POINTER-EREIGNISSE UND NICHT TOUCH-EREIGNISSE
 * ═══════════════════════════════════════════════════════════════════════
 *
 * `onTouchStart` faengt den Finger, aber nicht den Stift — und ein Stift auf
 * einem Grafiktablett ist genau der Fall, in dem jemand einen Plan zeichnet
 * und kein Kontextmenue bekommt. `pointerdown` deckt Finger, Stift und Maus
 * ab; die Maus wird hier ausgenommen, weil sie ihren Rechtsklick schon hat
 * und ein zusaetzlicher langer Druck dort nur stoert.
 *
 * ═══════════════════════════════════════════════════════════════════════
 * WAS DEN LANGEN DRUCK VOM ZIEHEN UNTERSCHEIDET
 * ═══════════════════════════════════════════════════════════════════════
 *
 * Auf einem Canvas, auf dem man schiebt und zieht, ist „gedrueckt halten" der
 * Anfang von fast allem. Ein Kontextmenue, das bei jedem begonnenen Zug
 * aufgeht, ist schlimmer als keines. Deshalb zwei Bedingungen, und beide
 * muessen halten:
 *
 *   ZEIT   — mindestens `dauerMs` gedrueckt (Vorgabe 500 ms).
 *   RUHE   — der Zeiger ist dabei um weniger als `toleranzPx` gewandert.
 *
 * Wandert er weiter, wird abgebrochen: das war ein Zug und keine Abfrage.
 * Die Vorgabe von 10 px ist bewusst klein — ein Finger zittert, aber ein Zug
 * geht weiter.
 *
 * REIN: keine Uhr im Modul-Zustand, kein Store. Der Haken haelt nur seinen
 * eigenen Zeitgeber und raeumt ihn bei jedem Ende ab.
 */
import { useCallback, useEffect, useRef, type PointerEvent as ReactPointerEvent } from 'react'

export interface LongPressOptions {
  /** Wie lange gedrueckt werden muss. */
  dauerMs?: number
  /** Wieviel der Zeiger dabei wandern darf, bevor es ein Zug ist. */
  toleranzPx?: number
}

/**
 * Ob zwei Punkte noch als „derselbe Ort" gelten.
 *
 * Eigene Funktion, damit die Bedingung pruefbar ist: sie ist der ganze
 * Unterschied zwischen einer Abfrage und einem abgebrochenen Zug.
 */
export const istNochRuhig = (
  von: { x: number; y: number },
  nach: { x: number; y: number },
  toleranzPx: number,
): boolean => Math.hypot(nach.x - von.x, nach.y - von.y) <= toleranzPx

/**
 * Props fuer das Element, das auch per langem Druck bedienbar sein soll.
 *
 * `melde` bekommt die Bildschirm-Koordinaten — dieselben, die ein
 * `contextmenu`-Ereignis liefern wuerde, damit die aufrufende Stelle ihr
 * Menue an genau derselben Stelle oeffnet und nicht zwei Wege kennt.
 */
export type LongPressMelder = (punkt: { clientX: number; clientY: number }) => void

/**
 * Gibt einen BINDER zurueck, nicht fertige Props.
 *
 * Weil die Bedienelemente, um die es geht, teils in einer Liste stehen — ein
 * Chip je Ebene. Ein Haken je Listeneintrag verstiesse gegen die Hook-Regeln,
 * und ein Haken ausserhalb der Liste kann die Rueckmeldung des einzelnen
 * Eintrags nicht kennen. Der Binder loest beides: EIN Zeitgeber (es ist immer
 * nur ein Zeiger unten), beliebig viele Bindungen.
 */
export const useLongPress = ({ dauerMs = 500, toleranzPx = 10 }: LongPressOptions = {}) => {
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const start = useRef<{ x: number; y: number } | null>(null)

  const abbrechen = useCallback(() => {
    if (timer.current !== null) {
      clearTimeout(timer.current)
      timer.current = null
    }
    start.current = null
  }, [])

  // Ein Zeitgeber, der einen ausgehaengten Knoten ueberlebt, feuert ins Leere
  // — und im schlimmsten Fall auf einen Zustand, den es nicht mehr gibt.
  useEffect(() => abbrechen, [abbrechen])

  const onPointerMove = useCallback(
    (e: ReactPointerEvent) => {
      if (!start.current) return
      if (!istNochRuhig(start.current, { x: e.clientX, y: e.clientY }, toleranzPx)) abbrechen()
    },
    [abbrechen, toleranzPx],
  )

  return useCallback(
    (melde: LongPressMelder) => ({
      onPointerDown: (e: ReactPointerEvent) => {
        // Die Maus hat ihren Rechtsklick. Ein langer Druck zusaetzlich waere
        // dort nur ein Kontextmenue, das beim Auswaehlen aufgeht.
        if (e.pointerType === 'mouse') return
        start.current = { x: e.clientX, y: e.clientY }
        const punkt = { clientX: e.clientX, clientY: e.clientY }
        timer.current = setTimeout(() => {
          timer.current = null
          if (start.current) melde(punkt)
        }, dauerMs)
      },
      onPointerMove,
      onPointerUp: abbrechen,
      onPointerCancel: abbrechen,
      onPointerLeave: abbrechen,
    }),
    [abbrechen, dauerMs, onPointerMove],
  )
}
