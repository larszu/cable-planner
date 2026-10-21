import { create } from 'zustand'
import {
  EMPTY_LIVE,
  hatFrischeMeldung,
  LIVE_STALE_AFTER_MS,
  liveFreshness,
  type LiveLink,
  type LiveSnapshot,
  type LiveTally,
} from '../lib/signalAnimation'

/**
 * Die BEOBACHTUNGEN, die der Canvas zeigen darf — und sonst nichts.
 *
 * WARUM EIN EIGENER STORE. `projectStore` ist die Wahrheit ueber den PLAN;
 * was eine Anlage gerade tut, ist keine Plan-Aenderung. Waere es dort drin,
 * liefe es durch Undo/Redo, durch die Autospeicherung und in die
 * `.cableplan`-Datei — eine Ablesung, die als Absicht gespeichert wird, ist
 * genau der Fehler, den ADR-003 und E-4 (`asBuilt.ts`, „eigene Spur")
 * benennen.
 *
 * Deshalb: eigener Store, NICHT persistiert, ohne Historie. Beim Neustart
 * ist er leer, und das ist die richtige Aussage — was die Anlage vor einer
 * Stunde tat, weiss diese App nicht mehr.
 *
 * ER WIRD HEUTE VON NIEMANDEM GEFUELLT. Das ist kein Versehen: Inkrement 1
 * baut die Darstellung samt Rueckfall-Regel, das Einspeisen aus Mischer und
 * Router folgt. Bis dahin zeigt der Canvas ehrlich „Schema" — und die Regel,
 * die das entscheidet, ist bereits durch Tests gesichert statt spaeter
 * nachgereicht.
 */
interface LiveState {
  snapshot: LiveSnapshot
  /**
   * Gemeinsame Uhr fuer ALLE Kanten und Knoten. Ein Takt fuer den ganzen
   * Canvas statt eines Intervalls je Kante; er laeuft nur, solange etwas
   * noch veralten kann (`startLiveTicker`).
   */
  clock: number
  /**
   * Eine Runde Beobachtungen uebernehmen. `lastContactAt` wird HIER gesetzt
   * und nicht vom Einspeiser mitgegeben: „wann haben wir zuletzt etwas
   * gehoert" ist eine Aussage ueber die Verbindung, nicht ueber die Daten,
   * und ein Einspeiser, der sie mitliefert, koennte sie schoenen.
   */
  melde: (teil: { links?: readonly LiveLink[]; tally?: readonly LiveTally[] }, now: number) => void
  /**
   * Eine QUELLE ist weg. Sie raeumt ihre eigene Haelfte und ruehrt
   * `lastContactAt` NICHT an.
   *
   * WARUM NICHT ALLES. Es gibt zwei Einspeiser — der Mischer meldet Tally,
   * der Router meldet Kreuzpunkte. Faellt einer aus, faellt nicht der andere
   * aus; wer hier alles leerte, machte aus einem toten Router einen toten
   * Mischer. Und `lastContactAt` stehen zu lassen ist richtig, solange die
   * andere Quelle es weiter hochsetzt: „live" heisst, dass ueberhaupt jemand
   * meldet. Die Eintraege der toten Quelle altern von selbst aus dem
   * Frische-Fenster heraus, und ihre Kanten fallen einzeln aufs Schema —
   * genau die Regel, die `edgeFlow` je Eintrag prueft.
   *
   * Ohne Argument: beide Haelften, und dann faellt auch `lastContactAt` weg.
   */
  verbindungWeg: (teil?: 'links' | 'tally') => void
}

export const useLiveStore = create<LiveState>((set) => ({
  snapshot: EMPTY_LIVE,
  clock: Date.now(),
  melde: (teil, now) =>
    set((s) => ({
      clock: Math.max(now, Date.now()),
      snapshot: {
        links: teil.links ?? s.snapshot.links,
        tally: teil.tally ?? s.snapshot.tally,
        lastContactAt: now,
      },
    })),
  verbindungWeg: (teil) =>
    set((s) => {
      // Nichts zu raeumen: denselben Zustand zurueckgeben. Die Abfragen melden
      // ein fehlendes Geraet in jeder Runde, und ein neuer Snapshot je Runde
      // liesse jede Kante nachrechnen, ohne dass sich etwas aendert.
      if (!teil) return s.snapshot === EMPTY_LIVE ? s : { snapshot: EMPTY_LIVE }
      if (s.snapshot[teil].length === 0) return s
      return {
        snapshot: {
          ...s.snapshot,
          links: teil === 'links' ? [] : s.snapshot.links,
          tally: teil === 'tally' ? [] : s.snapshot.tally,
        },
      }
    }),
}))

/**
 * Wie oft der Canvas nachrechnen muss, damit ein Rueckfall aufs Schema
 * SICHTBAR wird, statt bis zur naechsten Maus-Bewegung zu warten.
 *
 * Eine Sekunde: fein genug, dass niemand mehrere Sekunden lang eine
 * Behauptung sieht, fuer die es keinen Beleg mehr gibt, und grob genug, dass
 * es keine Bildrate kostet.
 */
export const LIVE_TICK_MS = 1000

export { LIVE_STALE_AFTER_MS, liveFreshness }

let tickerId: number | undefined
const pruefeTicker = (): void => {
  if (typeof window === 'undefined') return
  const { snapshot } = useLiveStore.getState()
  const noetig = hatFrischeMeldung(snapshot, Date.now())
  if (noetig && tickerId === undefined) {
    tickerId = window.setInterval(() => {
      useLiveStore.setState({ clock: Date.now() })
      // Der letzte Takt setzt die Uhr noch, damit der Rueckfall aufs Schema
      // sichtbar wird — erst dann steht der Takt.
      if (!hatFrischeMeldung(useLiveStore.getState().snapshot, Date.now())) {
        window.clearInterval(tickerId)
        tickerId = undefined
      }
    }, LIVE_TICK_MS)
  } else if (!noetig && tickerId !== undefined) {
    window.clearInterval(tickerId)
    tickerId = undefined
    useLiveStore.setState({ clock: Date.now() })
  }
}
useLiveStore.subscribe((s, prev) => {
  if (s.snapshot !== prev.snapshot) pruefeTicker()
})

/** Nur fuer Tests: laeuft der gemeinsame Takt gerade? */
export const liveTickerLaeuft = (): boolean => tickerId !== undefined
