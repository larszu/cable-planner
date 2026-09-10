// ───────────────────────────────────────────────────────────────────────────
// Ausgelieferte Vorlagen-Namen: alt -> neu (#837).
//
// ─── WARUM ES DIE TABELLE BRAUCHT ──────────────────────────────────────────
//
// Drei Vorlagen aus `passiveCatalog.ts` trugen deutsche Namen, in einem Repo
// mit Quellsprache `en` (E-28): `Steckdosenleiste 6-fach`,
// `Steckdosenleiste 8-fach`, `IEC-Leiste 8-fach`. Der Sprach-Waechter konnte
// sie nicht sehen — sie sind DATEN und keine `t()`-Aufrufe.
//
// Umbenennen allein reicht hier aber nicht, und das ist der eigentliche Punkt:
// **der Name IST die Kennung.** `projectStore.seedBuiltInLibrary` gleicht die
// mitgelieferten Vorlagen ueber `byName` gegen die Bibliothek des Nutzers ab,
// und `LibraryPanel` sucht Konflikte ueber `tpl.name === template.name`. Ohne
// Migration stuende nach dem Umbenennen die alte deutsche Vorlage NEBEN der
// neuen englischen — dasselbe Geraet zweimal in der Seitenleiste, und der
// Nutzer muesste raten, welche seine Plaene benutzen.
//
// Es ist dieselbe Bauform wie `LEGACY_CATEGORY_RENAMES` (#822/#835) und
// `LEGACY_CONNECTOR_RENAMES` (#832), und aus demselben Grund getrennt: die
// Kategorien stehen an `equipment.category`, die Steckertypen am Port, die
// Vorlagen-Namen in der Bibliothek. Drei Orte, drei Tabellen — eine gemeinsame
// waere kuerzer und wuerde beim naechsten Eintrag an der falschen Stelle
// angewandt.
//
// ─── WAS HIER NICHT HINEINGEHOERT ──────────────────────────────────────────
//
// Namen, die ein Nutzer selbst vergeben hat. Diese Tabelle gilt fuer
// AUSGELIEFERTE Vorlagen; eine eigene Vorlage, die zufaellig so heisst, wird
// mit umbenannt, und das ist der Preis. Er ist klein und die Gegenrichtung
// waere schlimmer: eine Tabelle, die nur „manchmal" greift, laesst die
// Doppelung genau dort stehen, wo sie jemanden trifft.
// ───────────────────────────────────────────────────────────────────────────

export const LEGACY_TEMPLATE_RENAMES: Record<string, string> = {
  'Steckdosenleiste 6-fach': 'Power strip 6-way',
  'Steckdosenleiste 8-fach': 'Power strip 8-way',
  'IEC-Leiste 8-fach': 'IEC strip 8-way',
}

/** Der heutige Name einer Vorlage — unveraendert, wo nichts umbenannt wurde. */
export const heileVorlagenName = (name: string): string =>
  LEGACY_TEMPLATE_RENAMES[name] ?? name
