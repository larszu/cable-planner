// ───────────────────────────────────────────────────────────────────────────
// BEDARF 100 — das Namensschema der Aufzeichnungen, als Projekt-Daten.
//
// Es steht im PROJEKT und nicht in den Einstellungen: die Take-Nummer und der
// Zuschnitt des Namens gehoeren zu dieser Produktion, fahren mit der Datei per
// Mail und muessen beim Empfaenger dieselben sein. Ein Wert in den
// App-Einstellungen gaelte fuer den Rechner — und dann truege dieselbe Show
// auf zwei Rechnern zwei verschiedene Dateinamen.
//
// Gerechnet wird nichts hier; das macht `lib/recordNaming.ts`.
// ───────────────────────────────────────────────────────────────────────────

/** Woraus ein Teil des Aufnahmenamens gebildet wird. */
export type RecordNamePart =
  /** Der Projektname („Herbstgala"). */
  | 'show'
  /** Die Take-Nummer — einmal fuer das ganze Projekt. */
  | 'take'
  /** Der redaktionelle Name der Rolle („Kamera 1"). */
  | 'source'
  /** Die redaktionelle Nummer der Rolle, wo die Produktion mit Nummern arbeitet. */
  | 'sourceNumber'
  /** Der Recorder, auf dem die Aufzeichnung landet. */
  | 'recorder'
  /** Der Kanal beziehungsweise Eingang am Recorder. */
  | 'channel'
  /** Fester Text. */
  | 'literal'

export interface RecordNameSegment {
  part: RecordNamePart
  /** Nur bei `literal`. */
  literal?: string
  /** Nur bei `take`, `sourceNumber` und `channel`: Stellen mit Nullen auffuellen. */
  pad?: number
}

export interface RecordNamingScheme {
  segments: RecordNameSegment[]
  separator: string
  /**
   * Die laufende Nummer des Durchgangs. EINE fuer das ganze Projekt.
   *
   * Optional, und das ist kein Versehen: eine Produktion, die ohne
   * Take-Nummern arbeitet, soll keine erfundene bekommen. Fehlt sie und das
   * Schema nennt `take`, ist das ein BEFUND und keine stille Null.
   */
  take?: number
}

/**
 * Das Schema, mit dem eine Produktion anfaengt.
 *
 * `<show>_<take>_<sourcename>` — genau die Form, die die Massnahme nennt.
 * Es ist ein START und keine Vorschrift; wer anders schneidet, aendert die
 * Segmente.
 */
export const DEFAULT_RECORD_SCHEME: RecordNamingScheme = {
  segments: [{ part: 'show' }, { part: 'take', pad: 2 }, { part: 'source' }],
  separator: '_',
}
