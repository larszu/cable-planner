// ───────────────────────────────────────────────────────────────────────────
// Zusammenfuehren beim Lager-Import im Modus „merge".
//
// ADR-005, Regel 2: eine Projektion darf nicht ueberschreiben. Der Import
// nahm den eingehenden Datensatz bisher ALS GANZES:
//
//   for (const x of add) byId.set(x.id, x)
//
// Damit loescht eine aeltere Datei still, was sie nicht kennt. Konkret: eine
// v1-Datei (vor ADR-002) traegt keine `deviceTypeId`. Steht im lokalen Lager
// derselbe Artikel MIT bestaetigter Typ-Identitaet, ist sie nach dem Import
// weg — und mit ihr die autoritative Aufloesung auf das Datenblatt, die genau
// deshalb eingefuehrt wurde, damit nicht mehr ueber Namen geraten wird.
//
// Im cable-planner ist es schaerfer als anderswo: `healItem` setzt fehlende
// Felder AUSDRUECKLICH auf `undefined`, der eingehende Artikel traegt sie
// also als gesetzte Schluessel. Ein einfaches `{ ...alt, ...neu }` wuerde den
// vorhandenen Wert damit ebenfalls ausloeschen.
//
// Deshalb: nur DEFINIERTE Werte uebernehmen. Was die Datei nicht sagt, sagt
// nichts — und loescht nichts. Wer den Datensatz wirklich ersetzen will,
// nimmt den Modus „replace"; genau dafuer gibt es ihn.
//
// Die Regel selbst wohnt seit dem Lager-Schnitt (ADR-006) in
// `lib/mergeDefined.ts` — sie ist nicht Lager, sondern allgemein.
// ───────────────────────────────────────────────────────────────────────────

import { mergeDefined } from '../../lib/mergeDefined'

export { mergeDefined }

/**
 * Eingehende Datensaetze in den Bestand mischen: bekannte Ids feldweise
 * fortschreiben, unbekannte anhaengen.
 */
export const mergeById = <T extends { id: string }>(base: T[], add: T[]): T[] => {
  const byId = new Map(base.map((x) => [x.id, x]))
  for (const incoming of add) {
    const existing = byId.get(incoming.id)
    byId.set(incoming.id, existing ? mergeDefined(existing, incoming) : incoming)
  }
  return [...byId.values()]
}
