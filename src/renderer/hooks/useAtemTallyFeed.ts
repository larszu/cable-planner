import { useEffect } from 'react'
import { cablePlannerApi, hasDesktopBridge } from '../lib/bridge'
import { useCanvasProjectStore as useProjectStore } from '../store/projectStoreContext'
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
 * WAS BEI EINEM FEHLSCHLAG PASSIERT: `verbindungWeg()`. Nicht „letzten Stand
 * behalten": ein Mischer, den wir nicht mehr erreichen, ist kein Mischer, der
 * dasselbe zeigt wie eben. Der Canvas fällt dann aufs Schema zurück, und der
 * Streifen sagt es (Eigentümer-Entscheidung vom 2026-09-08).
 *
 * ER LÄUFT NUR IM DESKTOP-BETRIEB und nur, solange der Mischer verbunden ist.
 * Im Browser gibt es keine IPC-Brücke, und ein Takt, der jede Sekunde ins
 * Leere greift, kostet Bildrate für nichts.
 */
export const useAtemTallyFeed = (): void => {
  const project = useProjectStore((s) => s.project)
  const melde = useLiveStore((s) => s.melde)
  const verbindungWeg = useLiveStore((s) => s.verbindungWeg)

  useEffect(() => {
    if (!hasDesktopBridge) return
    let lebt = true

    const runde = async () => {
      if (!lebt) return
      try {
        const status = await cablePlannerApi.atem.getStatus()
        if (!lebt) return
        if (!status.connected) {
          verbindungWeg()
          return
        }
        const state = await cablePlannerApi.atem.getState()
        if (!lebt) return
        // Die Zuordnung Eingang → Geraet kommt aus dem PLAN und wird hier
        // nicht zweitgefuehrt (ADR-001). Sie neu zu rechnen ist billig genug
        // und immer aktuell; eine gecachte Karte ginge beim naechsten
        // Umpatchen auseinander.
        const rows = buildTallyMap(project).rows
        melde({ tally: atemTally(state, rows, Date.now()) }, Date.now())
      } catch {
        // Erreichbar heisst nicht antwortend. Kein Stand ist besser als ein
        // alter, der wie ein aktueller aussieht.
        if (lebt) verbindungWeg()
      }
    }

    void runde()
    const timer = window.setInterval(() => void runde(), LIVE_TICK_MS)
    return () => {
      lebt = false
      window.clearInterval(timer)
    }
  }, [project, melde, verbindungWeg])
}
