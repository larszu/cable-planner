// ───────────────────────────────────────────────────────────────────────────
// BEDARF 87 (P2) — der Sendebericht.
//
//   > A transmission record that can be exported after the show to explain
//   > what happened. There is no show-shaped record of what the transport did;
//   > post-mortems are reconstructed from OBS log files, a platform health
//   > graph and memory.
//
// Der Beleg der Bedarfs-Datenbank ist die Existenz von Bastelprojekten, die
// zu keinem anderen Zweck existieren — `loopy750/SRT-Stats-Monitor` und
// `roflb0y/SRTExporter` — und Stellenausschreibungen, die „incident analysis
// across the whole chain" als Kernaufgabe der Rolle nennen.
//
// ─── DIE GRENZE STEHT IM BEDARF SELBST ─────────────────────────────────────
//
//   > Plan-side: a record of the intended delivery configuration and its
//   > as-built deviations, exportable as the client-facing artefact;
//   > NOT LIVE TELEMETRY CAPTURE.
//
// Das ist die ganze Entwurfsentscheidung. Dieser Planer misst nichts: keine
// Bitrate, keine Rundlaufzeit, keinen Paketverlust. Er wuesste die Zahlen
// nicht, und eine geratene saehe aus wie eine gemessene — dieselbe Grenze wie
// bei „is it flowing" (Bedarf 76), bei der Encoder-Ueberlast (Bedarf 90) und
// bei der Statistik-URL des Waechters (Bedarf 89).
//
// ─── DESHALB TRAEGT JEDE ZEILE IHRE HERKUNFT ───────────────────────────────
//
// Ein Bericht, der zum Kunden geht, wird gelesen wie ein Messprotokoll. Genau
// das darf er nicht sein duerfen. `TransmissionSource` steht deshalb an JEDER
// Zeile und ist Pflicht im Typ: gesehen, aus einem Log abgetippt, vom Kunden
// gemeldet — oder ausdruecklich `unstated`. Ein fehlendes Feld haette
// „gemessen" bedeuten koennen, und das waere die teuerste stille Annahme in
// dieser ganzen Datei.
//
// ─── EINE UHR HAT DER PLAN NICHT ───────────────────────────────────────────
//
// Der Zeitpunkt einer Zeile kommt von einem Menschen, nicht von `Date.now()`.
// Ein Bericht, dessen Zeiten die Anwendung vergibt, saehe aus, als haette sie
// zugesehen. Und wie in Bedarf 88 gilt: ohne Offset ist eine Uhrzeit
// mehrdeutig — beim Nachvollziehen gegen ein OBS-Log und eine Plattform-Kurve
// ist genau das der Fehler, der die Rekonstruktion unmoeglich macht.
// ───────────────────────────────────────────────────────────────────────────

/** Was passiert ist. Bewusst grob — feiner koennte es nur eine Messung. */
export type TransmissionEventKind =
  /** Sendung begonnen. */
  | 'start'
  /** Sendung beendet. */
  | 'stop'
  /** Abriss — es kam nichts mehr an. */
  | 'dropout'
  /** Sichtbar schlechter, aber nicht weg. */
  | 'degraded'
  /** Auf den Ausweichweg geschaltet. */
  | 'switch'
  /** Wieder normal. */
  | 'recovered'
  /** Am Weg oder am Encoder wurde waehrend der Sendung etwas geaendert. */
  | 'config-change'
  /** Sonstige Beobachtung. */
  | 'note'

export const TRANSMISSION_EVENT_LABEL: Readonly<Record<TransmissionEventKind, string>> = {
  start: 'Sendestart',
  stop: 'Sendeende',
  dropout: 'Abriss',
  degraded: 'Verschlechterung',
  switch: 'Umschaltung',
  recovered: 'Wieder normal',
  'config-change': 'Änderung während der Sendung',
  note: 'Beobachtung',
}

/**
 * Woher die Angabe stammt.
 *
 * PFLICHTFELD, und `unstated` ist ein Wert und keine Luecke. Der Unterschied
 * zwischen „ich habe es gesehen" und „so stand es im Log" entscheidet, wie
 * belastbar eine Zeile ist — und ein Bericht, der beides gleich aussehen
 * laesst, behauptet mehr, als er weiss.
 */
export type TransmissionSource =
  /** Jemand hat es zur Sendezeit gesehen. */
  | 'observed'
  /** Aus einem Log/einer Plattform-Ansicht abgetippt. */
  | 'from-log'
  /** Vom Kunden oder aus dem Publikum gemeldet. */
  | 'reported'
  /** Niemand hat gesagt, woher. */
  | 'unstated'

export const TRANSMISSION_SOURCE_LABEL: Readonly<Record<TransmissionSource, string>> = {
  observed: 'gesehen',
  'from-log': 'aus Log abgetippt',
  reported: 'gemeldet',
  unstated: 'Herkunft nicht angegeben',
}

export interface TransmissionEvent {
  id: string
  /**
   * Wann — als ISO-8601-Zeichenkette, so wie ein Mensch sie eingetragen hat.
   *
   * Nicht von der Anwendung vergeben (siehe Kopf), und nicht repariert: fehlt
   * der Offset, sagt der Befund `event-unzoned` das laut, statt eine Zone zu
   * erfinden.
   */
  at: string
  kind: TransmissionEventKind
  /** Das betroffene Ziel. Leer heisst: die ganze Sendung. */
  destinationId?: string
  /** Was beobachtet wurde, im Klartext. */
  text: string
  /** Wer es beobachtet hat. */
  observedBy?: string
  source: TransmissionSource
}

export interface TransmissionRecord {
  events: TransmissionEvent[]
  /**
   * Die Zusammenfassung fuer den Kunden, von Hand geschrieben.
   *
   * Bewusst nicht erzeugt: eine automatische Zusammenfassung aus acht Zeilen
   * waere eine Bewertung der Sendung, und die gehoert dem Menschen, der sie
   * verantwortet.
   */
  summary?: string
}
