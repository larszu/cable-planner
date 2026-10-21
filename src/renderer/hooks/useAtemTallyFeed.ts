import { useCallback, useEffect } from 'react'
import { useVisiblePolling } from './useVisiblePolling'
import { cablePlannerApi, hasDesktopBridge } from '../lib/bridge'
import { useCanvasProjectStoreInstance } from '../store/projectStoreContext'
import { useLiveStore } from '../store/liveStore'
import { LIVE_TICK_MS } from '../store/liveStore'
import { atemTally } from '../lib/atemTally'
import { buildTallyMap } from '../lib/tallyMap'

/**
 * Der Mischer-Zustand als Beobachtung — die Live-Hälfte des Canvas-Signalflusses.
 *
 * WARUM ABFRAGEN UND NICHT ZUHÖREN. `atem:*` kennt heute nur einen Log-Kanal
 * (`onEvent` liefert Textzeilen), keinen Zustands-Push. Ein solcher wäre der
 * bessere Weg und ist eine eigene Arbeit; bis dahin ist eine Abfrage im
 * Sekundentakt das ehrlichere Provisorium: sie kostet einen IPC-Aufruf pro
 * Sekunde und liefert einen Zeitstempel, an dem die Rückfall-Regel greifen
 * kann. Ein Push OHNE Zeitstempel wäre schlechter — dann sähe eine
 * eingefrorene Verbindung aus wie ein stabiler Zustand.
 *
 * WAS BEI EINEM FEHLSCHLAG PASSIERT: er meldet seine eigene Hälfte ab — und
 * nur die, denn ein toter Mischer ist kein toter Router. Nicht „letzten Stand
 * behalten": ein Mischer, den wir nicht mehr erreichen, ist kein Mischer, der
 * dasselbe zeigt wie eben. Der Canvas fällt dann aufs Schema zurück, und der
 * Streifen sagt es (Eigentümer-Entscheidung vom 2026-09-08).
 *
 * ER LÄUFT NUR IM DESKTOP-BETRIEB und nur, solange der Mischer verbunden ist.
 * Im Browser gibt es keine IPC-Brücke, und ein Takt, der jede Sekunde ins
 * Leere greift, kostet Bildrate für nichts.
 */
export const useAtemTallyFeed = (): void => {
  const storeApi = useCanvasProjectStoreInstance()
  const melde = useLiveStore((s) => s.melde)
  const verbindungWeg = useLiveStore((s) => s.verbindungWeg)

  // Der Plan wird je Runde frisch gelesen statt abonniert: vorher begann die
  // Schleife bei JEDER Planaenderung neu.
  const runde = useCallback(async () => {
    try {
      const status = await cablePlannerApi.atem.getStatus()
      if (!status.connected) {
        verbindungWeg('tally')
        // Ohne Verbindung streckt sich die Pause (bis 10 s); ein Verbinden
        // meldet sich ueber `atem:event` und fragt sofort.
        return false
      }
      const state = await cablePlannerApi.atem.getState()
      // Die Zuordnung Eingang → Geraet kommt aus dem PLAN und wird hier
      // nicht zweitgefuehrt (ADR-001).
      const rows = buildTallyMap(storeApi.getState().project).rows
      melde({ tally: atemTally(state, rows, Date.now()) }, Date.now())
      return true
    } catch {
      // Erreichbar heisst nicht antwortend. Kein Stand ist besser als ein
      // alter, der wie ein aktueller aussieht.
      verbindungWeg('tally')
      return false
    }
  }, [storeApi, melde, verbindungWeg])

  // Verborgenes Fenster: Pause. Die Meldungen veralten dann und der Canvas
  // faellt aufs Schema — beim Wiedersichtbarwerden fragt die Schleife sofort.
  useVisiblePolling(runde, LIVE_TICK_MS, { enabled: hasDesktopBridge, maxBackoffMs: 10_000 })
  useEffect(() => {
    if (!hasDesktopBridge) return
    return cablePlannerApi.atem.onEvent?.(() => void runde())
  }, [runde])
}
