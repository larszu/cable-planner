// ───────────────────────────────────────────────────────────────────────────
// Woher das Tally an dieser Position kommt — und ob es die Wahrheit sagt
// (Bedarf 105, P3).
//
//   > Tally is trusted until it lies; software tally over NDI/TSL misreports,
//   > blinks, or needs port workarounds, and LAMP BRIGHTNESS IS OFTEN WRONG
//   > for the ambient light.
//
// Belegt an zwei offenen Fällen aus demselben Projekt:
//
//   * `DistroAV/DistroAV#318` (2019-06-17, als „not planned" geschlossen):
//     OBS-NDI schickt ein VORSCHAU-Tally, sobald eine Quelle bloss in einem
//     Multiview auftaucht. Die Lampe leuchtet also, ohne dass die Kamera je
//     auf Sendung war — und das ist die gefährlichere Richtung: der Operator
//     glaubt, er sei on air.
//   * BirdDog PF120: das Tally „rapidly blinks between red and green", wenn
//     die Kamera live ist (2021-09-27 gemeldet, im Korpus als weiterhin offen
//     geführt).
//
// ─── WARUM DAS EIN PLANUNGS-GEGENSTAND IST ─────────────────────────────────
//
// `lib/tallyMap.ts` hält seit Initiative 2 drei Glieder der Kette: Rolle →
// Mischer-Eingang → UMD-Adresse. Das vierte, die LAMPE am Platz, war
// ausdrücklich ausgespart, weil es eine Verdrahtungs-Entscheidung an der
// Hardware ist. Genau dieses vierte Glied ist es, das laut Beleg lügt.
//
// Aufgeschrieben wird deshalb, was der Plan wirklich weiss: über WELCHEN Weg
// das Tally an diese Position kommt und WO die Lampe sitzt. Und daneben, was
// nur eine Prüfung wissen kann: was beim Schalten auf Programm und auf
// Vorschau tatsächlich zu sehen war.
//
// ─── DIE PRÜFUNG IST EINE BEOBACHTUNG, KEINE ZUSAGE ────────────────────────
//
// Der Plan sagt NIE, dass ein Tally funktioniert. Er hält fest, was jemand
// gesehen hat, und wann. Eine Position ohne Prüfung heisst `nicht geprüft` —
// nicht „in Ordnung". Das ist der ganze Unterschied zwischen diesem Modell und
// „Tally is trusted until it lies": das Vertrauen bekommt ein Datum.
// ───────────────────────────────────────────────────────────────────────────

/**
 * Über welchen Weg das Tally an die Position kommt.
 *
 * AUFNAHMEKRITERIUM wie bei `labelTargets.ts`: nur, wofür in diesem Haus oder
 * im Korpus ein Beleg liegt. Kein Sammelsurium aller je gebauten Tally-Wege —
 * ein Eintrag, den niemand nachprüfen kann, erzeugt Befunde, die niemand
 * beurteilen kann.
 */
export type TallyTransport =
  /** TSL UMD v3.1 an ein Display. Spec in `lib/labelTargets.ts`. */
  | 'tsl-umd-v31'
  /** Potentialfreier Kontakt / GPIO — der Weg, den `tally-pi` fährt. */
  | 'gpio'
  /** NDI-Metadaten. Der Weg aus `DistroAV#318`, und der unzuverlässigste. */
  | 'ndi'
  /** Die eigene Tally-Ausgabe des Mischers (ATEM-Kamerasteuerung, SDI-Rückweg). */
  | 'switcher-native'
  /** Nicht festgelegt. Ehrlicher als eine Vermutung. */
  | 'unknown'

export const TALLY_TRANSPORT_LABEL: Readonly<Record<TallyTransport, string>> = {
  'tsl-umd-v31': 'TSL UMD v3.1',
  gpio: 'GPIO / Kontakt',
  ndi: 'NDI-Metadaten',
  'switcher-native': 'Mischer selbst',
  unknown: 'nicht festgelegt',
}

/**
 * Was bei der Prüfung an der Lampe zu sehen war.
 *
 * `blinking` und `wrong-colour` sind KEINE Sammelkategorie „kaputt": beide
 * stehen für einen konkreten belegten Fall (`blinking` für die PF120, die rot
 * und grün wechselt; `wrong-colour` für das Vorschau-Tally aus `#318`, das
 * rot statt grün zeigt), und wer den Befund später liest, braucht den
 * Unterschied, um das richtige Gerät anzufassen.
 */
export type TallyObservation =
  | 'red'
  | 'green'
  | 'off'
  /** Wechselt sichtbar — die Lampe ist da, aber nicht lesbar. */
  | 'blinking'
  /** Leuchtet, aber in der falschen Farbe. */
  | 'wrong-colour'
  /** Es leuchtete etwas — an einer ANDEREN Position. */
  | 'wrong-position'
  /** Nicht geprüft. Der Vorgabewert, und er bleibt sichtbar. */
  | 'not-checked'

export const TALLY_OBSERVATION_LABEL: Readonly<Record<TallyObservation, string>> = {
  red: 'rot',
  green: 'grün',
  off: 'aus',
  blinking: 'blinkt',
  'wrong-colour': 'falsche Farbe',
  'wrong-position': 'falsche Position',
  'not-checked': 'nicht geprüft',
}

/** Eine Sichtprüfung an der Lampe. */
export interface TallyCheck {
  /** Zeitpunkt (ISO). Kommt von der Uhr des Aufrufers, nie aus der Ableitung. */
  at: string
  /** Was zu sehen war, während die Position auf PROGRAMM lag. */
  onProgram: TallyObservation
  /** Was zu sehen war, während sie auf VORSCHAU lag. */
  onPreview: TallyObservation
  /** Wer geprüft hat. Optional — eine Prüfung ohne Namen ist besser als keine. */
  by?: string
  note?: string
}

/**
 * Das Tally EINER Position.
 *
 * Position = Rolle (`SourceIdentity`). „Kamera 1" bleibt „Kamera 1", auch wenn
 * die Havarie-Kamera einspringt — und ihre Lampe hängt am Platz, nicht am
 * Blech. Genau deshalb hängt dieser Datensatz an der Rolle und nicht am Gerät.
 */
export interface TallyPosition {
  identityId: string
  transport: TallyTransport
  /**
   * Adresse, Host oder Pin — wie es AM GERÄT eingetragen ist.
   *
   * Freitext, und der Plan prüft ihn NICHT. Was hier gültig ist, hängt am
   * Transport (eine IP, eine GPIO-Nummer, ein NDI-Quellname), und eine
   * Prüfung, die drei Formen halb kann, weist gültige Einträge ab. Was den
   * Eintrag wirklich prüft, ist die Sichtprüfung an der Lampe.
   */
  endpoint?: string
  /** Wo die Lampe sitzt („Kamerakopf", „Rückseite", „Box am Stativ"). */
  lamp?: string
  /**
   * Die Prüfungen, jüngste zuerst.
   *
   * Eine Liste und kein einzelner Wert: „gestern ging es, heute nicht" ist die
   * Auskunft, die den Fehler findet, und sie geht verloren, wenn jede Prüfung
   * die vorige überschreibt.
   */
  checks?: TallyCheck[]
}

/** Was auf dem Blatt steht, wo nichts festgehalten wurde. */
export const NOT_CHECKED = 'nicht geprüft'
export const NO_LAMP = 'keine Lampe benannt'
export const NO_ENDPOINT = 'keine Adresse hinterlegt'
