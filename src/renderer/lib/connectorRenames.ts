// ───────────────────────────────────────────────────────────────────────────
// Steckertypen, die einen neuen Namen bekommen haben (#832).
//
// ─── WAS HIER STEHT UND WAS AUSDRUECKLICH NICHT ────────────────────────────
//
// Hier stehen NUR Werte, deren neuer Name aus dem alten FOLGT — kein Raten.
// `TRS Jack` war dreipolig und 6,3 mm, das stand in seinem Eintrag im
// Stecker-Katalog (`poles: 3`, kein `mini`). `Mini Jack` war dreipolig und
// mini, also 3,5 mm TRS. Beides ist eine Uebersetzung, keine Annahme.
//
// `Klinke` steht NICHT hier, und das ist die wichtigste Zeile dieser Datei.
// Der Wert sagt „hier sitzt eine Klinke" und sonst nichts. Ihn auf
// `Jack 6.35 mm TRS` zu migrieren waere die bequeme Wahl und eine erfundene
// Angabe: der Plan saehe danach aus, als haette jemand nachgesehen. Er bleibt
// gueltig und bedeutet weiter „Groesse und Beschaltung nicht angegeben".
//
// ─── WARUM DIE TABELLE HIER LIEGT UND NICHT IN DER MIGRATION ───────────────
//
// Weil sie zwei Aufgaben hat, die auseinanderliefen, wenn es sie zweimal
// gaebe — dieselbe Begruendung wie bei `LEGACY_CATEGORY_RENAMES`:
// `healProjectPositions` schreibt bestehende Projekte um, und die Bibliothek
// zieht gespeicherte Vorlagen nach. Beide lesen dieselbe Zeile.
// ───────────────────────────────────────────────────────────────────────────
import type { ConnectorType } from '../types/equipment'

export const LEGACY_CONNECTOR_RENAMES: Record<string, ConnectorType> = {
  // Die freien Zeichenketten aus dem Stecker-Katalog des Patchblenden-Dialogs.
  'TS Jack': 'Jack 6.35 mm TS',
  'TRS Jack': 'Jack 6.35 mm TRS',
  'Mini Jack': 'Jack 3.5 mm TRS',
}

/**
 * Den gespeicherten Wert auf seinen heutigen Namen bringen.
 *
 * Laesst alles unveraendert, was nicht in der Tabelle steht — auch Unbekanntes.
 * Ein Wert, den niemand kennt, ist eine Angabe des Nutzers (eigener
 * Steckertyp) und keine Einladung, ihn zu ersetzen.
 */
export const heileSteckertyp = <T extends string | undefined>(wert: T): T =>
  (wert && LEGACY_CONNECTOR_RENAMES[wert] ? (LEGACY_CONNECTOR_RENAMES[wert] as T) : wert)
