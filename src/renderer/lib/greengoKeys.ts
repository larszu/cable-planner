import type { GreenGoUser } from '../types/greengo'

/**
 * Zugehörigkeiten und Tastenkarte gemeinsam fortschreiben (E-2, Schritt 3).
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * WARUM ES DIESE FUNKTION GEBEN MUSS
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Seit `GreenGoUser.keys` existiert, führt eine Station ZWEI Angaben über
 * dieselbe Gruppe: dass sie ihr angehört (`groupIds`) und wo sie liegt
 * (`keys`). Die eine Richtung der Zusage aus `types/greengo.ts` verbindet sie:
 *
 *   Jede Gruppe auf einer Taste MUSS in `groupIds` stehen. Umgekehrt nicht.
 *
 * Wer im Dialog eine Gruppe abwählt oder löscht und nur `groupIds` kürzt,
 * lässt ihre Taste stehen — und der Export schriebe sie wieder auf die Anlage,
 * weil die Karte des Plans die Karte ist. Die Gruppe wäre in der Oberfläche
 * weg und auf dem Beltpack noch da.
 *
 * Deshalb geht jede Änderung an `groupIds` durch hier, und deshalb ist es EINE
 * Funktion und keine zwei Aufräumschritte an zwei Aufrufstellen: die zweite
 * wäre die, die man beim nächsten Mal vergisst.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * `undefined` UND `[]` SIND NICHT DASSELBE
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * `keys === undefined` heisst: der Plan hat nie eine Karte gelesen (ein
 * Projekt von vor E-2). Dann bleibt es dabei — hier eine leere Karte zu
 * erfinden hiesse dem Export zu sagen, er dürfe schreiben, und er schriebe
 * die Positionen platt, die er nie gesehen hat.
 *
 * `keys === []` heisst: der Plan kennt die Karte, und sie ist leer.
 */
export const withGroupIds = (user: GreenGoUser, groupIds: number[]): GreenGoUser => {
  if (user.keys === undefined) return { ...user, groupIds }
  const erlaubt = new Set(groupIds)
  return { ...user, groupIds, keys: user.keys.filter((k) => erlaubt.has(k.groupId)) }
}
