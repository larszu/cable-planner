// ───────────────────────────────────────────────────────────────────────────
// Fortschreibung der Rentman-Kabel-Zuordnung (`rentmanCableMap`).
//
// WARUM ALS EIGENE FUNKTION. Der Export-Dialog schrieb die Karte an drei
// Stellen selbst zusammen — und „Alle senden" tat es in einer Schleife. Jede
// Runde las dabei `project.metadata.rentmanCableMap` aus der Render-Closure,
// die sich waehrend der Schleife nicht aendert. Runde 2 schrieb also
// `{ ...alteKarte, [key2]: … }` und loeschte damit den Zaehler aus Runde 1
// wieder. Nach „Alle senden" ueber N Eimer stand nur der LETZTE `lastSentQty`
// in der Datei.
//
// Das ist kein kosmetischer Fehler: die uebrigen Eimer behalten ihren alten
// Zaehler, ihr Delta bleibt positiv, und der naechste Versand bucht dieselbe
// Menge ein zweites Mal nach Rentman. Auf einer Produktion sind das reale
// Kabel auf einem realen Lieferschein.
//
// Der Kommentar im Dialog behauptete sogar das Gegenteil — „updates project
// metadata after each push so the next iteration sees the fresh sentQty
// value". Das stimmte fuer den Store, aber nicht fuer die Closure, aus der
// gelesen wurde.
//
// Deshalb hier: eine reine Funktion, die eine Karte NIMMT und eine neue
// zurueckgibt. Der Aufrufer reicht das Ergebnis weiter, statt jede Runde neu
// aus dem Render zu lesen — damit kann der Fehler strukturell nicht
// wiederkehren, und die Verschmelzung ist headless testbar.
// ───────────────────────────────────────────────────────────────────────────
import type { CablePlannerProject } from '../types/project'

export type RentmanCableMap = NonNullable<CablePlannerProject['metadata']['rentmanCableMap']>

/**
 * Traegt `lastSentQty` (und die Zuordnung) fuer EINEN Eimer nach und laesst
 * alles andere unangetastet.
 *
 * ADR-005, Regel 1: der Eintrag wird FORTGESCHRIEBEN, nicht neu gebaut. Wer
 * hier die bekannten Schluessel auflistet, loescht `mergedEquipmentIds` —
 * also genau den Hinweis darauf, dass mehrere Rentman-Stammartikel in diesen
 * Eimer gefallen sind.
 */
export const withSentQty = (
  map: RentmanCableMap | undefined,
  key: string,
  rentmanEquipmentId: string,
  lastSentQty: number,
): RentmanCableMap => {
  const current = map ?? {}
  return {
    ...current,
    [key]: {
      ...current[key],
      rentmanEquipmentId,
      lastSentQty,
    },
  }
}
