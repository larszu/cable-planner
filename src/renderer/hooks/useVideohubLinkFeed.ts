import { useCallback, useEffect } from 'react'
import { useVisiblePolling } from './useVisiblePolling'
import type { EquipmentItem } from '../types/equipment'
import { cablePlannerApi, hasDesktopBridge } from '../lib/bridge'
import { useCanvasProjectStore as useProjectStore, useCanvasProjectStoreInstance } from '../store/projectStoreContext'
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

const ersterHub = (equipment: readonly EquipmentItem[]) =>
  equipment.find((e) => detectDeviceKind(e) === 'videohub' && (e.ipAddress ?? '').trim() !== '')

export const useVideohubLinkFeed = (): void => {
  const storeApi = useCanvasProjectStoreInstance()
  // Nur die Adresse abonnieren: vorher begann die Schleife bei JEDER
  // Aenderung an Geraeten oder Kabeln neu.
  const host = useProjectStore((s) => (ersterHub(s.project.equipment)?.ipAddress ?? '').trim())
  const melde = useLiveStore((s) => s.melde)
  const verbindungWeg = useLiveStore((s) => s.verbindungWeg)

  useEffect(() => {
    // Kein Hub im Plan oder keiner mit Adresse: nichts zu melden, und
    // nichts stehen lassen, was von einem frueheren Plan stammt.
    if (hasDesktopBridge && !host) verbindungWeg('links')
  }, [host, verbindungWeg])

  const runde = useCallback(async () => {
    try {
      const antwort = await cablePlannerApi.videohub.readState({ host, port: 9990 })
      if (!antwort.ok || !antwort.state) {
        verbindungWeg('links')
        return false
      }
      const { equipment, cables } = storeApi.getState().project
      const hub = ersterHub(equipment)
      if (!hub) return true
      melde({ links: videohubLinks(hub, cables, antwort.state, Date.now()) }, Date.now())
      return true
    } catch {
      verbindungWeg('links')
      return false
    }
  }, [host, storeApi, melde, verbindungWeg])

  // Unerreichbarer Hub: Pause bis 30 s gestreckt — jeder Versuch ist ein
  // TCP-Verbindungsaufbau mit Zeitueberschreitung. Verborgenes Fenster: Pause.
  useVisiblePolling(runde, HUB_TICK_MS, { enabled: hasDesktopBridge && !!host, maxBackoffMs: 30_000, resetKey: host })
}
