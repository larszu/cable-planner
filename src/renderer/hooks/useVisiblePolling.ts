import { useEffect, useRef, useSyncExternalStore } from 'react'

/**
 * Gemeinsame Abfrage-Schleife fuer alles, was im Takt nachsieht.
 *
 * WARUM EIN HELFER. Vorher hatte jede Stelle ihr eigenes `setInterval`, und
 * jede hatte dieselben Luecken: es lief weiter, wenn das Fenster verborgen
 * war, es fragte ein unerreichbares Geraet stur alle n Sekunden, und ein
 * langsamer Aufruf ueberholte den naechsten. Bei einem grossen Plan im
 * Leerlauf summierte sich das zu einem spuerbaren Teil eines Kerns.
 *
 * Was er garantiert:
 * - laeuft nur, solange `enabled` gilt UND das Fenster sichtbar ist; beim
 *   Wiedersichtbarwerden sofort ein Durchgang
 * - nie zwei Durchgaenge gleichzeitig (Kette aus `setTimeout`, kein Intervall)
 * - wirft `arbeit` oder liefert sie `false`, verdoppelt sich die Pause bis
 *   `maxBackoffMs`; der naechste Erfolg setzt sie zurueck
 */
export interface VisiblePollingOptions {
  /** Abfragen ueberhaupt? (Panel offen, Geraet verbunden …) */
  enabled?: boolean
  /** Sofort beim Start einmal ausfuehren (Standard: ja). */
  immediate?: boolean
  /** Obergrenze der Pause nach Fehlschlaegen. Ohne Angabe: kein Backoff. */
  maxBackoffMs?: number
  /** Auch im verborgenen Fenster weiterlaufen (nur, wo ein Gegenueber darauf wartet). */
  runWhenHidden?: boolean
  /** Aendert sich dieser Wert (z. B. die Adresse), beginnt die Schleife neu — mit sofortigem Durchgang. */
  resetKey?: unknown
}

const abonniereSichtbarkeit = (cb: () => void) => {
  document.addEventListener('visibilitychange', cb)
  return () => document.removeEventListener('visibilitychange', cb)
}

/** `true`, solange das Dokument sichtbar ist — fuer Komponenten und den Helfer. */
export const useDocumentVisible = (): boolean =>
  useSyncExternalStore(
    abonniereSichtbarkeit,
    () => !document.hidden,
    () => true,
  )

export const useVisiblePolling = (
  arbeit: () => unknown,
  intervalMs: number,
  opts: VisiblePollingOptions = {},
): void => {
  const { enabled = true, immediate = true, maxBackoffMs, runWhenHidden = false, resetKey } = opts
  const sichtbar = useDocumentVisible()
  const arbeitRef = useRef(arbeit)
  useEffect(() => {
    arbeitRef.current = arbeit
  })
  const aktiv = enabled && (sichtbar || runWhenHidden)
  useEffect(() => {
    if (!aktiv) return
    let lebt = true
    let timer: ReturnType<typeof setTimeout> | undefined
    let pause = intervalMs
    const runde = async () => {
      let ok: boolean
      try {
        ok = (await arbeitRef.current()) !== false
      } catch {
        ok = false
      }
      if (!lebt) return
      pause = !ok && maxBackoffMs ? Math.min(maxBackoffMs, pause * 2) : intervalMs
      timer = setTimeout(() => void runde(), pause)
    }
    timer = setTimeout(() => void runde(), immediate ? 0 : intervalMs)
    return () => {
      lebt = false
      if (timer !== undefined) clearTimeout(timer)
    }
  }, [aktiv, intervalMs, immediate, maxBackoffMs, resetKey])
}
