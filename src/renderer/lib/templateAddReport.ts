// ───────────────────────────────────────────────────────────────────────────
// Was eine Mengen-Operation getan hat — und was nicht (Bedarf 65, P2).
//
// WAS DER BEDARF SAGT:
//
//   > Scanning a batch, an item that is already checked out elsewhere is
//   > silently dropped from the list with no alert. The case leaves the
//   > building short and nobody knows until the crew opens it on site.
//
//   > Any set operation in the suite (scan a case, import a list, mark a rack
//   > packed) must end with an explicit success/skipped/why account that is
//   > actionable on the spot. **Cheapest reliability win in the whole dossier.**
//
// Beleg: grokability/snipe-it#18106 (offen, auf dem Aug-2026-Meilenstein der
// Betreuer) — „bulk checkout does not display any Alerts. Also the Asset is
// excluded from the list… Especially if scanning multiple items."
//
// WO ES IN DIESER ANWENDUNG PASSIERT. `addCustomTemplates` ueberspringt
// Namen, die es schon gibt. Das ist RICHTIG — ein Import darf eigene Edits
// nicht ueberschreiben (dieselbe Regel wie Bedarf 96). Falsch war, dass es
// niemand erfaehrt:
//
//   * Library-Import (Einstellungen): meldete die Zahl aus der DATEI, nicht
//     die angelegte. Zweihundert Vorlagen importiert, drei angelegt, gemeldet:
//     „200 Geraete-Templates".
//   * GraphML-Import in die Library: meldete GAR NICHTS und schloss den
//     Dialog.
//   * CSV-Import: seit `cable#711` richtig — aber mit einer eigenen,
//     danebengerechneten Zahl.
//
// Drei Meldungen ueber dieselbe Mengen-Operation, von denen zwei falsch waren
// und die dritte parallel gefuehrt wurde. Deshalb steht die Auskunft jetzt am
// ENGPASS: `addCustomTemplates` gibt zurueck, was es getan hat, und jeder
// Aufrufer sagt dasselbe.
//
// REIN: keine Uhr, kein Store, kein IO, keine Uebersetzung.
// ───────────────────────────────────────────────────────────────────────────

export interface TemplateAddReport {
  /** Namen, die neu angelegt wurden. */
  added: string[]
  /**
   * Namen, die es schon gab. Sie bleiben UNVERAENDERT — der Import
   * ueberschreibt keine Handarbeit (Bedarf 96). Aber er sagt es.
   */
  skipped: string[]
  /**
   * Eintraege ohne Namen. Sie lassen sich nicht per Namen zusammenfuehren:
   * zwei davon haetten denselben leeren Schluessel, und der zweite
   * ueberschriebe den ersten. Sie werden deshalb NICHT angelegt — und das
   * ist genau die Art Verlust, die der Bedarf meint, wenn sie niemand nennt.
   */
  unnamed: number
}

export const EMPTY_TEMPLATE_ADD_REPORT: TemplateAddReport = {
  added: [],
  skipped: [],
  unnamed: 0,
}

/** Hat die Operation etwas ausgelassen? Dann muss die Meldung es sagen. */
export const hasOmissions = (r: TemplateAddReport): boolean =>
  r.skipped.length > 0 || r.unnamed > 0
