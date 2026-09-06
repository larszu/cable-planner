/**
 * Was beim Laden eines Projekts nicht übernommen werden konnte.
 *
 * ADR-005, Regel 3: „Wer nicht bewahren kann, sagt es an der Stelle, an der es
 * passiert." Auf dem Lade-Pfad war das bisher **strukturell unmöglich**:
 * `healProjectPositions` ist eine reine Funktion ohne Weg zur Oberfläche, also
 * verschwand alles, was sie verwarf, definitionsgemäß still.
 *
 * Konkret aufgefallen an den Signalquellen-Rollen aus ADR-001: eine Rolle ohne
 * Namen oder mit doppelter Id wurde wortlos entfernt, und `clearDanglingIdentity`
 * strich anschließend die Verweise der Geräte darauf. Eine Kamera verlor damit
 * ihre TSL-Adresse, ohne dass irgendwo etwas stand.
 *
 * Der Grund ist als **Code** hinterlegt, nicht als Satz: der Store soll keine
 * Sprache kennen, die Oberfläche übersetzt ihn.
 */

/** Warum ein Datensatz beim Laden nicht übernommen wurde. */
export type LoadDropReason =
  /** Pflichtfeld fehlte (z. B. eine Rolle ohne Namen). */
  | 'missing-required'
  /** Eine Id kam mehrfach vor; der erste Datensatz hat gewonnen. */
  | 'duplicate-id'

/** Woher der verworfene Datensatz kam. */
export type LoadDropKind =
  | 'source-identity'
  /** Initiative 9 — ein Ausspielziel, das die Normalisierung nicht bestanden
   *  hat. Dieselbe Regel wie bei der Rolle: ein Ziel, das still verschwindet,
   *  nimmt die Ingest-URL und den Verweis auf seinen Stream-Key mit, und der
   *  faellt erst am Showtag auf. */
  | 'delivery-destination'
  /** Bedarf 85 — eine Antwort der Haus-IT, die keine ist: ohne Punkt, auf den
   *  sie sich bezieht, oder mit einem Ausgang, den es nicht gibt. Sie still zu
   *  verwerfen waere hier besonders teuer: eine fehlende Zeile im Blatt sieht
   *  aus wie „nie gefragt", und dann fragt jemand ein zweites Mal — oder gar
   *  nicht mehr, weil er die Genehmigung von letztem Jahr im Kopf hat. */
  | 'venue-answer'

export interface LoadDrop {
  kind: LoadDropKind
  reason: LoadDropReason
  /**
   * Bester menschenlesbarer Griff auf den verworfenen Datensatz, damit jemand
   * ihn in seiner Datei wiederfindet. Leer, wenn die Datei keinen hergab —
   * dann sagt der Bericht wenigstens, dass es ihn gab.
   */
  label: string
}

export interface LoadReport {
  drops: LoadDrop[]
}

/** Ein Bericht ohne Inhalt ist kein Bericht — dann gibt es nichts zu melden. */
export const hasDrops = (report: LoadReport | null | undefined): boolean =>
  !!report && report.drops.length > 0
