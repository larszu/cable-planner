import { useEffect, useState } from 'react'
import { useSettingsStore } from '../store/settingsStore'
import { useLiveStore, LIVE_TICK_MS } from '../store/liveStore'
import { edgeFlow, liveFreshness, tallyOf, type EdgeFlow } from '../lib/signalAnimation'
import type { Cable } from '../types/cable'
import { useReducedMotion } from './useReducedMotion'

/**
 * Darf sich im Canvas etwas bewegen?
 *
 * BEIDE müssen zustimmen: die Einstellung des Nutzers (was er will) und die
 * Systemeinstellung (was er verträgt). Wer `prefers-reduced-motion` gesetzt
 * hat, hat das aus einem Grund getan, den diese App nicht kennt.
 */
export const useCanvasMotion = (): boolean => {
  const gewuenscht = useSettingsStore((s) => s.canvasMotion)
  const reduziert = useReducedMotion()
  return gewuenscht && !reduziert
}

/**
 * Ein Takt, der nur läuft, wenn es etwas zu takten gibt.
 *
 * WOZU. Ohne ihn bliebe ein abgerissener Live-Kontakt so lange als „live"
 * stehen, bis irgendetwas anderes ein Rendern auslöst — im Zweifel bis zur
 * nächsten Mausbewegung. Der Rückfall aufs Schema wäre gebaut und unsichtbar.
 *
 * Er läuft NICHT im reinen Schema-Betrieb: dort gibt es nichts, das
 * veralten könnte, und ein Intervall, das auf einem Plan mit 300 Kabeln
 * jede Sekunde alles neu rechnet, kostet Bildrate für nichts.
 */
export const useLiveTick = (): number => {
  const hatKontakt = useLiveStore((s) => s.snapshot.lastContactAt !== undefined)
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    if (!hatKontakt) return
    const id = window.setInterval(() => setNow(Date.now()), LIVE_TICK_MS)
    return () => window.clearInterval(id)
  }, [hatKontakt])
  return now
}

export interface CanvasFlowMode {
  /** Gilt Live gerade? */
  live: boolean
  /** Alter der letzten Meldung in ms. `null` = nie Kontakt. */
  ageMs: number | null
  /** Bewegt sich etwas? */
  motion: boolean
}

/**
 * Die Betriebsart, wie der Canvas sie ANZEIGT.
 *
 * Sie ist Pflicht und nicht Zierde: die Animation sieht in beiden Betriebsarten
 * gleich aus, und ohne diese Anzeige wäre der Unterschied zwischen „so ist es
 * geplant" und „so ist es gerade" für den Betrachter nicht vorhanden.
 */
export const useCanvasFlowMode = (): CanvasFlowMode => {
  const snapshot = useLiveStore((s) => s.snapshot)
  const now = useLiveTick()
  const motion = useCanvasMotion()
  const { live, ageMs } = liveFreshness(snapshot, now)
  return { live, ageMs, motion }
}

/** Wie diese eine Kante zu zeichnen ist. */
export const useEdgeFlow = (cable: Pick<Cable, 'id' | 'bidirectional'> | undefined): EdgeFlow | null => {
  const snapshot = useLiveStore((s) => s.snapshot)
  const now = useLiveTick()
  const motion = useCanvasMotion()
  if (!cable) return null
  return edgeFlow(cable, snapshot, now, { motion })
}

/** Tally eines Geräts — oder `null`, wenn nichts bekannt ist. */
export const useTally = (equipmentId: string | undefined) => {
  const snapshot = useLiveStore((s) => s.snapshot)
  const now = useLiveTick()
  if (!equipmentId) return null
  return tallyOf(equipmentId, snapshot, now)
}
