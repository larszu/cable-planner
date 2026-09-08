import { useEffect } from 'react'
import { cablePlannerApi, hasDesktopBridge } from '../lib/bridge'
import { useCanvasProjectStore as useProjectStore } from '../store/projectStoreContext'
import { useLiveStore } from '../store/liveStore'
import { videohubLinks } from '../lib/videohubLinks'
import { detectDeviceKind } from '../lib/deviceKind'

/**
 * Der Kreuzpunkt-Zustand des Videohubs als Beobachtung.
 *
 * WARUM LANGSAMER ALS DER MISCHER. `atem:*` hält eine offene Verbindung; ein
 * `getState` kostet einen IPC-Aufruf. `videohub:read-state` öffnet dagegen je
 * Aufruf eine TCP-Verbindung zum Hub. Im Sekundentakt wäre das eine Last, die
 * niemand bestellt hat — auf einem Gerät, das im Signalweg steht.
 *
 * Zwei Sekunden sind trotzdem innerhalb des Frische-Fensters (fünf Sekunden),
 * also fällt keine Kante zwischen zwei Runden aufs Schema zurück. Der Takt
 * ist damit eine Frage der Höflichkeit gegenüber dem Gerät und keine der
 * Korrektheit — genau so soll es sein.
 *
 * WELCHER HUB. Der erste im Plan, der als Videohub erkannt wird UND eine
 * Adresse trägt. Ohne Adresse gibt es nichts zu fragen; eine geratene wäre
 * ein Verbindungsversuch zu einem fremden Gerät im Kundennetz.
 *
 * ER MELDET NUR SEINE EIGENE HÄLFTE ab (`verbindungWeg('links')`). Ein toter
 * Router ist kein toter Mischer.
 */
const HUB_TICK_MS = 2000

export const useVideohubLinkFeed = (): void => {
  const equipment = useProjectStore((s) => s.project.equipment)
  const cables = useProjectStore((s) => s.project.cables)
  const melde = useLiveStore((s) => s.melde)
  const verbindungWeg = useLiveStore((s) => s.verbindungWeg)

  useEffect(() => {
    if (!hasDesktopBridge) return
    const hub = equipment.find(
      (e) => detectDeviceKind(e) === 'videohub' && (e.ipAddress ?? '').trim() !== '',
    )
    if (!hub) {
      // Kein Hub im Plan oder keiner mit Adresse: nichts zu melden, und
      // nichts stehen lassen, was von einem frueheren Plan stammt.
      verbindungWeg('links')
      return
    }

    let lebt = true
    const runde = async () => {
      if (!lebt) return
      try {
        const antwort = await cablePlannerApi.videohub.readState({
          host: (hub.ipAddress ?? '').trim(),
          port: 9990,
        })
        if (!lebt) return
        if (!antwort.ok || !antwort.state) {
          verbindungWeg('links')
          return
        }
        melde({ links: videohubLinks(hub, cables, antwort.state, Date.now()) }, Date.now())
      } catch {
        if (lebt) verbindungWeg('links')
      }
    }

    void runde()
    const timer = window.setInterval(() => void runde(), HUB_TICK_MS)
    return () => {
      lebt = false
      window.clearInterval(timer)
    }
  }, [equipment, cables, melde, verbindungWeg])
}
