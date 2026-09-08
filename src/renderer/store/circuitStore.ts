import { create } from 'zustand'
import { LEERE_SIM, type CircuitSim } from '../lib/circuitFromProject'
import { CIRCUIT_KIND_INFO, type CircuitKind } from '../types/circuit'

/**
 * Die SCHALTERSTELLUNGEN am Schaltbild — und sonst nichts.
 *
 * WARUM EIN EIGENER STORE, UND WARUM NICHT PERSISTIERT. Wer am Schaltbild
 * einen Schalter umlegt, fragt „was passiert dann". Er ändert nicht den
 * Plan. Läge die Stellung im `projectStore`, wäre jedes Umlegen ein
 * Undo-Schritt, ein Autospeichern und eine Änderung an der Projektdatei:
 * zwei Minuten Ausprobieren fräsen die Undo-Historie leer, und die Datei
 * trüge hinterher eine Schalterstellung, die niemand entschieden hat.
 *
 * Dieselbe Trennung wie beim `liveStore` und aus derselben Wurzel
 * (`cable#647`): der `projectStore` ist die Wahrheit über die ABSICHT.
 * Beobachtungen gehören nicht hinein, Probierstellungen auch nicht.
 *
 * Was hier NICHT liegt: die Verdrahtung. Welches Gerät ein Wechselschalter
 * ist und welche Leitung an welcher Klemme hängt, ist Plan — das steht in
 * `EquipmentItem.circuitKind` und `Port.circuitTerminal` und wird
 * gespeichert.
 *
 * Beim Neustart ist er leer, und das ist die richtige Aussage: „wie die
 * Schalter beim letzten Ausprobieren standen" ist nichts, was jemand
 * wiederhaben will.
 */
interface CircuitState {
  sim: CircuitSim
  /**
   * Einen Schalter weiterschalten.
   *
   * Die Bauart sagt, welche Stellungen es gibt — durchgeschaltet wird
   * zyklisch durch genau die, statt „+1". Ein Wechselschalter hat die
   * Stellungen 1 und 2 und keine 0; wer ihn auf 0 stellen könnte, hätte
   * einen Schalter gebaut, den es an keiner Wand gibt, und die Leuchte
   * ginge aus, wo sie in Wirklichkeit umschaltet.
   */
  schalte: (id: string, kind: CircuitKind) => void
  /** Einen Dimmer setzen (0..100). */
  dimme: (id: string, pct: number) => void
  /** Alles zurück auf die Vorgaben der Bauart. */
  zuruecksetzen: () => void
}

/**
 * Die Stellungen, die eine Bauart annehmen kann, in Schaltreihenfolge.
 *
 * ANNOTIERT statt `satisfies`, und das ist hier der Unterschied: `Record`
 * verlangt jeden Schlüssel — eine neue Bauart ohne Eintrag ist ein
 * Typfehler und kein Schalter, der sich stumm nicht bedienen lässt.
 * (`satisfies` täte dasselbe, würde aber `dimmer: []` zu `never[]`
 * verengen, und dann liesse sich die Liste nicht mehr durchsuchen.)
 */
export const STELLUNGEN: Record<CircuitKind, number[]> = {
  feed: [1, 0],
  switch: [0, 1],
  changeover: [1, 2],
  crossover: [1, 2],
  dimmer: [],
  lamp: [],
  junction: [],
  distro: [],
  // B-52 Teil 2 — die Schaltreihenfolge beginnt bei der RUHESTELLUNG. Ein
  // Not-Aus, dessen erstes Antippen ihn schliesst, waere verkehrt herum
  // bedient: er ist zu, bis jemand ihn schlaegt.
  button: [0, 1],
  contactor: [0, 1],
  relay: [0, 1],
  emergencyStop: [1, 0],
  rcd: [1, 0],
  mcb: [1, 0],
}

/**
 * Vorgabe-Stellung, sobald noch keine gewählt wurde.
 *
 * Gelesen aus `CIRCUIT_KIND_INFO[kind].ruhe` und NICHT aus `STELLUNGEN[0]`,
 * obwohl beide heute dasselbe sagen: die Schaltreihenfolge ist eine Aussage
 * darüber, was das nächste Antippen tut, die Ruhestellung eine darüber, wie
 * das Gerät ohne Zutun dasteht. Sie hier aus der Reihenfolge abzuleiten
 * hiesse, sie ein zweites Mal auszurechnen — und der Rechner
 * (`circuitFromProject`) nähme dann womöglich die andere.
 */
const vorgabe = (kind: CircuitKind): number => CIRCUIT_KIND_INFO[kind].ruhe

export const useCircuitStore = create<CircuitState>((set) => ({
  sim: LEERE_SIM,
  schalte: (id, kind) =>
    set((s) => {
      const moeglich = STELLUNGEN[kind]
      if (moeglich.length === 0) return s
      const jetzt = s.sim.positions[id] ?? vorgabe(kind)
      const idx = moeglich.indexOf(jetzt)
      const naechste = moeglich[(idx + 1) % moeglich.length]
      return { sim: { ...s.sim, positions: { ...s.sim.positions, [id]: naechste } } }
    }),
  dimme: (id, pct) =>
    set((s) => ({
      sim: {
        ...s.sim,
        levels: { ...s.sim.levels, [id]: Math.max(0, Math.min(100, Math.round(pct))) },
      },
    })),
  zuruecksetzen: () => set({ sim: LEERE_SIM }),
}))

/** Ist diese Bauart überhaupt bedienbar? Für die Klick-Fläche im Canvas. */
export const istSchaltbar = (kind: CircuitKind): boolean => CIRCUIT_KIND_INFO[kind].schaltbar
