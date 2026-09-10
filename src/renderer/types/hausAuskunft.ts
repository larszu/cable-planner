// ───────────────────────────────────────────────────────────────────────────
// Was das GEBAEUDE ueber sich erklaert — gelesen, nie bearbeitet
// (larszu-facility-planner Issue #2, letzter offener Haken)
//
// ─── WARUM DAS HIER NICHT DAS GEBAEUDE-MODELL IST ──────────────────────────
//
// Der `facility-planner` fuehrt ein grosses Modell: Raeume, Verteilungen,
// Stromkreise, Trassen, Schaltstellen, Maengel. Davon steht hier NICHTS —
// weder als Kopie noch als Import. Das ist dieselbe Grenze wie beim Lager
// (ADR-006), nur von der anderen Seite gelesen: der Plan beschreibt eine
// SHOW, die am Abbautag eingepackt wird, das Gebaeude steht Jahre. Wer das
// Hausmodell hier hereinzieht, fuehrt die Verwaltung des Hauses in einem
// Werkzeug, das dafuer nicht gebaut ist — und aendert sie dort, wo sie nicht
// hingehoert.
//
// Was der Plan wirklich braucht, sind vier Auskuenfte:
//
//   1. Welche Anschlusspunkte gibt es, und was geben sie her?
//   2. Haengt der Punkt an einem Schalter oder Dimmer?
//   3. Welche Steuerklinken stehen der Show offen?
//   4. Welche festen Strecken gehoeren dem Haus?
//
// ─── ES IST EINE ABSCHRIFT MIT DATUM, KEINE LEITUNG ────────────────────────
//
// Diese Auskunft kommt als DATEI (`avplan-facility`) und wird im Projekt
// mitgespeichert. Sie ist damit der Stand, gegen den geplant wurde, und nicht
// der Stand des Hauses von heute: zwischen Export und Aufbau kann der
// Betreiber eine Dose stillgelegt haben. Deshalb traegt sie `gelesenAm` und
// den Namen der Quelle, und der Plan-Check sagt es, wenn ein Verweis ins
// Leere zeigt.
//
// Und sie ist READ-ONLY. Es gibt in diesem Repo keinen Weg, sie zu aendern:
// der einzige Rueckweg zum Gebaeude ist `mangelMelden` im Vertrag des
// anderen Werkzeugs, und der laeuft nicht ueber diese Datei.
// ───────────────────────────────────────────────────────────────────────────

/** Wie ein Punkt angeschlossen ist — die Werte des Hauses, unveraendert. */
export type HausAnschlussart =
  | 'cee63'
  | 'cee32'
  | 'cee16'
  | 'powerlock'
  | 'klemme'
  | 'schuko'

/** Ein Anschlusspunkt des Hauses, so weit der Plan ihn braucht. */
export interface HausPunkt {
  id: string
  bezeichnung: string
  art: 'einspeisung' | 'dose'
  /** Verweist auf `HausRaum.id`. */
  raumId: string
  anschlussart: HausAnschlussart
  absicherungA: number
  /**
   * Zulaessige Dauerleistung in Watt — NUR wenn das Haus sie angibt.
   *
   * Sie ist NICHT `absicherungA x Spannung`. Der Nennstrom ist die
   * Ausloeseschwelle, nicht die Belastbarkeit; Leitungslaenge, Haeufung und
   * Gleichzeitigkeit gehen ein. Wer sie rechnet, wo sie fehlt, liefert eine
   * Vermutung, die als Messung gelesen wird — und der Plan-Check unten
   * schweigt lieber, als eine erfundene Grenze zu melden.
   */
  dauerleistungW?: number
  /**
   * Der Punkt haengt an einer Schaltstelle.
   *
   * `undefined` heisst „das Haus sagt nichts dazu" und NICHT „nein". Der
   * Unterschied entscheidet, ob der Plan-Check warnt oder schweigt.
   */
  geschaltet?: boolean
  /** Der Punkt haengt an einem Dimmer. Fuer ein Netzteil unbrauchbar. */
  gedimmt?: boolean
  /** Freitext des Betreibers („nur bis 10 A", „nur Reinigung"). */
  hinweis?: string
}

export interface HausRaum {
  id: string
  name: string
  /** Der Bezeichner, unter dem das Haus den Raum fuehrt. Der Plan druckt ihn. */
  hausbezeichner: string
}

export type HausSteuersystem = 'knx' | 'dali' | 'crestron' | 'vissonic' | 'sonstige'

/**
 * Art einer Steuer-Adresse.
 *
 * Bei DALI heisst „3" je nach Art etwas voellig anderes: Kurzadresse 3 ist
 * ein Vorschaltgeraet, Gruppe 3 koennen 30 Leuchten sein, Broadcast ist alles
 * am Bus — auch das Notlicht. Wer eine Gruppenadresse fuer eine Kurzadresse
 * haelt, schaltet im Zweifel den halben Saal.
 */
export type HausAdressart = 'kurz' | 'gruppe' | 'broadcast'

/** Eine Klinke der Haussteuerung, die der Show offensteht. */
export interface HausKlinke {
  id: string
  system: HausSteuersystem
  adresse: string
  adressart?: HausAdressart
  richtung: 'lesen' | 'schalten'
  /** Was passiert, wenn man sie benutzt. Klartext, vom Betreiber. */
  bedeutung: string
}

/** Eine feste Strecke des Hauses (Steigleitung, Leerrohr, verlegte Leitung). */
export interface HausStrecke {
  id: string
  bezeichnung: string
}

/**
 * Die Auskunft, wie der Plan sie fuehrt.
 *
 * `gelesenAm` und `quelle` sind Pflicht: eine Abschrift ohne Datum sieht aus
 * wie der Zustand von heute, und genau das ist sie nicht.
 */
export interface HausAuskunft {
  /** Name des Gebaeudes, wie das Haus ihn fuehrt. */
  name: string
  /** ISO-Zeitstempel, wann diese Abschrift in den Plan kam. */
  gelesenAm: string
  /** Dateiname oder App, aus der sie kam — damit die Herkunft nachvollziehbar ist. */
  quelle: string
  raeume: HausRaum[]
  punkte: HausPunkt[]
  klinken: HausKlinke[]
  strecken: HausStrecke[]
}

/** Der Punkt zu einer Id, oder `undefined`. Kein Namensabgleich (ADR-002). */
export const hausPunkt = (a: HausAuskunft | undefined, id: string | undefined) =>
  a && id ? a.punkte.find((p) => p.id === id) : undefined

/** Die Klinke zu einer Id, oder `undefined`. */
export const hausKlinke = (a: HausAuskunft | undefined, id: string | undefined) =>
  a && id ? a.klinken.find((k) => k.id === id) : undefined

/** Der Raum-Bezeichner, den das Haus fuehrt — fuer die Anzeige und den Druck. */
export const hausRaumLabel = (a: HausAuskunft | undefined, raumId: string): string => {
  const r = a?.raeume.find((x) => x.id === raumId)
  if (!r) return raumId
  return r.hausbezeichner ? `${r.name} (${r.hausbezeichner})` : r.name
}
