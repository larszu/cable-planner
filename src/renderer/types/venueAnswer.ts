// ───────────────────────────────────────────────────────────────────────────
// Was das Haus geantwortet hat (Bedarf 85, zweite Haelfte).
//
// Bedarf 23 hat das Anforderungsblatt gebaut — die Frage an die Haus-IT,
// abgeleitet aus dem Plan. Die zweite Haelfte fehlte, und der Bedarf nennt
// sie woertlich:
//
//   > the outcome (what was opened, what was refused, what the workaround
//   > was) is never recorded, so the next show at the same venue starts from
//   > zero
//
// ─── WARUM DIE ANTWORT KEIN JA/NEIN IST ────────────────────────────────────
//
// Der haeufigste Ausgang ist keiner von beiden. „Wir machen 1935 auf, aber
// nur im Veranstaltungsfenster" ist weder genehmigt noch abgelehnt, und beide
// Kreuze waeren beim naechsten Mal falsch: „genehmigt" laesst jemanden ohne
// Rueckfrage aufbauen, „abgelehnt" laesst ihn den Umweg bauen, den er nicht
// braucht. Deshalb `partial` mit der BEDINGUNG im Klartext.
//
// Und `refused` traegt den Umweg mit, nicht nur die Absage: der Umweg ist das,
// was beim naechsten Mal Zeit spart, und er ist genau das, was heute
// niemand aufschreibt.
// ───────────────────────────────────────────────────────────────────────────

/**
 * Der Ausgang einer Frage an das Haus.
 *
 * `pending` ist ein eigener Zustand und kein fehlender Eintrag: „noch keine
 * Antwort" ist eine Auskunft, die vor dem Aufbau zaehlt.
 */
export type VenueAnswerStatus = 'granted' | 'partial' | 'refused' | 'pending'

export interface VenueAnswer {
  /** Der Schluessel aus `RequestItem.key` — die Frage, auf die geantwortet wurde. */
  key: string
  status: VenueAnswerStatus
  /**
   * Bei `partial` die Bedingung, bei `refused` der Umweg, bei `granted` die
   * Einschraenkung, falls es eine gibt. Im Klartext, weil das Haus im Klartext
   * antwortet.
   */
  note?: string
  /** Wer geantwortet hat — Name oder Rolle in der Haus-IT. */
  by?: string
  /** ISO-Datum der Antwort. */
  at?: string
  /**
   * Der Ort, fuer den die Antwort gilt — beim Speichern EINGEFROREN.
   *
   * Ohne dieses Feld ist eine aus einer Vorlage uebernommene Antwort eine
   * Behauptung ueber ein Haus, in dem sie nie gegeben wurde. Genau dafuer
   * existiert die Antwort aber: sie soll in die naechste Show mitfahren.
   * Sie faehrt mit, und sie sagt, woher sie kommt.
   */
  venue?: string
}
