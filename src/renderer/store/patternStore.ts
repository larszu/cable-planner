import { create } from 'zustand'

/**
 * Welche Quelle gerade das Prüfbild trägt — und sonst nichts.
 *
 * NICHT PERSISTIERT, aus demselben Grund wie `circuitStore` und `liveStore`:
 * „ich speise gerade Kamera 1 ein und gehe die Monitore ab" ist ein Vorgang,
 * keine Plan-Angabe. Im `projectStore` liefe jede Umschaltung durch
 * Undo/Redo, durch die Autospeicherung und in die Projektdatei — und die
 * Datei trüge hinterher eine Prüf-Quelle, die niemand als Plan gemeint hat.
 *
 * Beim Neustart ist er leer, und das ist die richtige Aussage: welcher
 * Rundgang gestern lief, gehört nicht in den Plan. Was vom Rundgang BLEIBT,
 * ist etwas anderes — eine Sichtprüfung mit Zeitpunkt, und die gehört ins
 * Projekt (wie `TallyCheck`). Sie kommt mit dem nächsten Inkrement.
 */
interface PatternState {
  /** Geräte-Id der Quelle, die das Prüfbild trägt. `null` = keine. */
  quelleId: string | null
  waehle: (id: string | null) => void
}

export const usePatternStore = create<PatternState>((set) => ({
  quelleId: null,
  waehle: (id) => set({ quelleId: id }),
}))
