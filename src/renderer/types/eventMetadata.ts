// ───────────────────────────────────────────────────────────────────────────
// BEDARF 88 (P2) — die Angaben zur Veranstaltung, einmal getippt.
//
//   > Event metadata (title, description, thumbnail, scheduled start, privacy)
//   > entered once and reconciled across platforms. Typed separately into
//   > YouTube Studio, the Facebook/LinkedIn/Vimeo event, and the client's CMS
//   > or webinar portal, plus the marketing calendar.
//
// Der Beleg der Bedarfs-Datenbank ist ungewoehnlich, aber stark: eine ganze
// Produktkategorie wird auf genau diesem Versprechen verkauft — Restream,
// StreamYard, Livepush und Dacast werben alle mit „no need to retype titles,
// descriptions and other details separately". Wenn vier Anbieter dasselbe
// Retippen als Kaufgrund nennen, ist das Retippen real.
//
// ─── WAS HIER NICHT GEBAUT WIRD ────────────────────────────────────────────
//
// 1. **Keine Plattform-Anbindung.** Die Bedarfs-Datenbank sagt es selbst:
//    „integration with platform APIs is out of scope for an offline-first
//    planning tool". Diese Anwendung tippt nichts in YouTube Studio.
// 2. **Keine erfundenen Plattform-Grenzen.** Es waere naheliegend, hier eine
//    Tabelle „YouTube: 100 Zeichen Titel, Facebook: …" anzulegen. Fuer keine
//    einzige dieser Zahlen liegt im Korpus eine Fundstelle, und
//    `types/delivery.ts` hat die Regel bereits aufgeschrieben: „jeder
//    Vorgabewert traegt seine Quelle". Ein Laengen-Warner mit geratenen
//    Grenzen kuerzte Titel, die gepasst haetten, und liesse welche durch, die
//    nicht passen — beides sieht nach Pruefung aus.
// 3. **Keine Rueckmeldung, ob die Plattform es angenommen hat.** Dieselbe
//    Grenze wie bei „is it flowing" (Bedarf 76) und der Encoder-Ueberlast
//    (Bedarf 90): das waere eine Messung, und eine geratene sieht aus wie
//    eine echte.
//
// ─── WAS GEBAUT WIRD ───────────────────────────────────────────────────────
//
// Ein Satz Angaben am Projekt, ausdrueckliche Abweichungen je Ziel, und ein
// Blatt, von dem jemand abtippt. Die Bedarfs-Datenbank nennt genau das:
// „Hold the metadata once alongside the destination register and export a
// per-platform sheet."
//
// ─── DIE ZEITZONE IST DER EIGENTLICHE FEHLER ───────────────────────────────
//
// Ein Beginn ohne Zeitzone ist die teuerste Zeile auf dem Blatt. „19:00"
// bedeutet in YouTube Studio die Zeitzone des KANALS, im CMS des Kunden die
// des Servers und im Marketing-Kalender die des Verfassers. Der Plan kann das
// nicht aufloesen, aber er kann es benennen: `scheduledStart` traegt einen
// ISO-Zeitpunkt MIT Offset, `timezone` den Ort, fuer den er angesagt wurde,
// und fehlt der Offset, sagt der Befund `start-unzoned` das laut. Ein Feld,
// das eine nackte Uhrzeit annimmt und nichts sagt, waere die Vorlage fuer
// genau den Fehler, gegen den dieser Bedarf geschrieben ist.
// ───────────────────────────────────────────────────────────────────────────

/**
 * Sichtbarkeit der Veranstaltung auf der Plattform.
 *
 * `not-stated` ist ein eigener Wert und kein `undefined`, aus demselben Grund
 * wie `ArchiveAnswer.not-stated` in Bedarf 90: „niemand hat es gesagt" ist
 * etwas anderes als „oeffentlich". Ein Vorgabewert `public` waere hier
 * besonders teuer — er schaltet die Generalprobe des Kunden ins Netz.
 */
export type EventPrivacy = 'public' | 'unlisted' | 'private' | 'not-stated'

/**
 * Die Angaben zur Veranstaltung, einmal.
 *
 * ALLE FELDER OPTIONAL bis auf `privacy`. Ein halb ausgefuelltes Objekt ist
 * der Normalfall zwei Wochen vor der Show, und ein Pflichtfeld wuerde nur
 * dazu fuehren, dass jemand einen Platzhalter eintippt — der dann als Titel
 * auf dem Blatt steht und in YouTube Studio landet.
 */
export interface EventMetadata {
  /** Der Titel, unter dem die Veranstaltung auf jeder Plattform laeuft. */
  title?: string
  /** Der Beschreibungstext. Bewusst ohne Laengengrenze — siehe Kopf. */
  description?: string
  /**
   * Geplanter Beginn als ISO-8601-Zeitpunkt.
   *
   * MIT Offset (`2026-09-12T19:00:00+02:00`) ist er eindeutig; ohne
   * (`2026-09-12T19:00`) ist er es nicht, und genau dann meldet
   * `assessEventMetadata` den Befund `start-unzoned`. Der Wert wird nicht
   * repariert: eine hier ergaenzte Zeitzone waere geraten.
   */
  scheduledStart?: string
  /**
   * Der Ort, fuer den der Beginn angesagt wurde — als IANA-Name
   * („Europe/Berlin") oder im Klartext („Ortszeit Halle 3").
   *
   * Nicht dasselbe wie der Offset in `scheduledStart`: der Offset sagt, WELCHER
   * Zeitpunkt gemeint ist, dieser Name sagt, WIE er angesagt wurde. Auf dem
   * Blatt stehen beide, weil in YouTube Studio der eine und im Ablaufplan der
   * andere gebraucht wird.
   */
  timezone?: string
  privacy: EventPrivacy
  /**
   * Der VERWEIS auf das Vorschaubild, nicht das Bild.
   *
   * Ein Dateiname oder Pfad. Das Bild selbst gehoert nicht ins Projektfile:
   * `.avplan` wandert per Mail und in den Mobile-Viewer, und ein eingebettetes
   * Vollbild-Thumbnail vervielfacht die Dateigroesse fuer etwas, das ohnehin
   * bei jeder Plattform von Hand hochgeladen wird.
   */
  thumbnailRef?: string
  /** Schlagworte fuer die Plattform-Formulare. Reihenfolge bleibt erhalten. */
  tags?: string[]
}

/**
 * Was an EINEM Ziel bewusst anders ist.
 *
 * Die Abweichung ist der interessante Teil des Bedarfs. Zwei Ziele auf zwei
 * Plattformen tragen meist denselben Titel — bis jemand den englischen Stream
 * anders benennt, und ab da weiss niemand mehr, ob das Absicht war.
 *
 * `reason` ist deshalb ein Feld und keine Pflicht: erzwingen liesse sich nur
 * ein leerer Satz, aber eine Abweichung ohne Grund bekommt den Befund
 * `override-unexplained`. Ein Ueberschreiben, das niemand begruendet hat, ist
 * im Zweifel ein Tippfehler und kein Vorsatz.
 */
export interface DestinationMetadataOverride {
  /** Das Ziel — eine `DeliveryDestination.id`. */
  destinationId: string
  title?: string
  description?: string
  privacy?: EventPrivacy
  /** Warum es hier anders ist. */
  reason?: string
}

/** Beide Haelften zusammen — das, was im Projekt liegt. */
export interface EventMetadataPlan {
  event: EventMetadata
  overrides: DestinationMetadataOverride[]
}

/** Ein Plan ohne Angaben. Kein `undefined`, damit die Oberflaeche immer ein
 *  Objekt zum Anfassen hat. */
export const EMPTY_EVENT_METADATA: EventMetadataPlan = {
  event: { privacy: 'not-stated' },
  overrides: [],
}

/** Kanonische deutsche Beschriftung der Sichtbarkeit. Steht hier und nicht in
 *  der Oberflaeche, weil sie auf dem Blatt landet: ein Dokument, dessen Text
 *  mit der eingestellten Sprache wechselt, aendert seinen Stand. */
export const PRIVACY_LABEL: Readonly<Record<EventPrivacy, string>> = {
  public: 'öffentlich',
  unlisted: 'nicht gelistet',
  private: 'privat',
  'not-stated': 'nicht angegeben',
}
