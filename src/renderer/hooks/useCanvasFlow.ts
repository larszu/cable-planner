import { useEffect, useMemo } from 'react'
import { useSettingsStore } from '../store/settingsStore'
import { useLiveStore } from '../store/liveStore'
import { edgeFlow, liveFreshness, tallyOf, type EdgeFlow, type TallyState } from '../lib/signalAnimation'
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
 * Die gemeinsame Live-Uhr (`liveStore.clock`).
 *
 * Frueher hatte jede Kante ein eigenes 1-s-Intervall, das ab dem ersten
 * Kontakt fuer immer lief — bei 500 Kabeln 500 Timer und 500 Neuzeichnungen
 * pro Sekunde. Jetzt tickt EIN Takt im Store, und nur so lange, wie noch eine
 * Meldung veralten kann. Kanten und Knoten waehlen nur ihren abgeleiteten
 * Wert und rendern nur, wenn der sich aendert.
 */
export const useLiveTick = (): number => useLiveStore((s) => s.clock)

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
 * Sie ist Pflicht und nicht Zierde: ohne diese Anzeige wäre der Unterschied
 * zwischen „so ist es geplant" und „so ist es gerade" für den Betrachter
 * nicht vorhanden.
 */
export const useCanvasFlowMode = (): CanvasFlowMode => {
  const snapshot = useLiveStore((s) => s.snapshot)
  const now = useLiveTick()
  const motion = useCanvasMotion()
  const { live, ageMs } = liveFreshness(snapshot, now)
  return { live, ageMs, motion }
}

/**
 * Wie diese eine Kante zu zeichnen ist.
 *
 * Der Selektor liefert einen String statt des Objekts: das Alter laeuft mit
 * jedem Takt weiter, die Darstellung aber nicht — und nur eine geaenderte
 * Darstellung soll die Kante neu rendern. `ageMs` liest an der Kante
 * niemand; wer es braucht, nimmt `edgeFlow` direkt.
 */
export const useEdgeFlow = (cable: Pick<Cable, 'id' | 'bidirectional'> | undefined): EdgeFlow | null => {
  const motion = useCanvasMotion()
  const id = cable?.id
  const bidirectional = cable?.bidirectional
  const key = useLiveStore((s) => {
    if (id === undefined) return ''
    const f = edgeFlow({ id, bidirectional }, s.snapshot, s.clock, { motion })
    return `${f.kind}|${f.animate ? 1 : 0}|${f.direction}|${f.dimmed ? 1 : 0}|${f.source ?? ''}`
  })
  return useMemo(() => {
    if (!key) return null
    const [kind, animate, direction, dimmed, quelle] = key.split('|')
    const flow: EdgeFlow = {
      kind: kind as EdgeFlow['kind'],
      animate: animate === '1',
      direction: Number(direction) as 1 | -1,
      dimmed: dimmed === '1',
      ageMs: null,
    }
    if (quelle) flow.source = quelle as NonNullable<EdgeFlow['source']>
    return flow
  }, [key])
}

/**
 * Tally eines Geräts — oder `null`, wenn nichts bekannt ist.
 *
 * Gibt bewusst nur den ZUSTAND zurück und nicht das Alter: der Wert ist ein
 * einfacher String, und ein Knoten, dessen Tally sich nicht geändert hat,
 * rendert beim Takt nicht neu. Das Alter steht am Canvas-Streifen.
 */
export const useTally = (equipmentId: string | undefined): TallyState | null =>
  useLiveStore((s) => (equipmentId ? (tallyOf(equipmentId, s.snapshot, s.clock)?.state ?? null) : null))

/** Unterhalb dieser Zoomstufe sind die 8-px-Striche nur noch Flimmern. */
export const FLOW_MIN_ZOOM = 0.4

/**
 * Haelt die Fluss-Animation an, wenn niemand sie sieht: Fenster verborgen
 * oder ohne Fokus, oder so weit herausgezoomt, dass die Striche nicht mehr
 * zu erkennen sind. Per Klasse an `<html>` (`animation-play-state: paused`),
 * damit dafuer keine Kante neu rendern muss.
 */
export const useFlowPause = (weit: boolean): void => {
  useEffect(() => {
    const root = document.documentElement
    const pruefe = () => {
      root.classList.toggle('cp-flow-pausiert', document.hidden || !document.hasFocus())
    }
    pruefe()
    document.addEventListener('visibilitychange', pruefe)
    window.addEventListener('blur', pruefe)
    window.addEventListener('focus', pruefe)
    return () => {
      document.removeEventListener('visibilitychange', pruefe)
      window.removeEventListener('blur', pruefe)
      window.removeEventListener('focus', pruefe)
      root.classList.remove('cp-flow-pausiert')
    }
  }, [])
  useEffect(() => {
    document.documentElement.classList.toggle('cp-flow-weit', weit)
    return () => document.documentElement.classList.remove('cp-flow-weit')
  }, [weit])
}
