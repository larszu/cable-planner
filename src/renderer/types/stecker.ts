// ───────────────────────────────────────────────────────────────────────────
// #1181 — DER STECKER ALS DATENSATZ, NICHT ALS NAME.
//
// Bis hierher ist ein Stecker im Plan ein `ConnectorType` — „XLR", „BNC".
// Das reicht fuer die Frage „passt das zusammen", aber nicht fuer die
// Bestellung: ein DEUTSCH-DT-Stecker besteht aus Gehaeuse, Verriegelung
// (Wedgelock) und einem Kontakt je Pol, und der Kontakt haengt am
// Aderquerschnitt. Genau die Kleinteile vergisst man beim Bestellen.
//
// Deshalb ZWEI Ebenen:
//
//   SteckerTyp   das Gehaeuse mit Teilenummer, Hersteller, Polzahl,
//                Geschlecht und Datenblatt.
//   Konfektion   eine bestellbare Zusammenstellung der Kleinteile, die zu
//                diesem Gehaeuse gehoeren. Mehrere je Typ, weil der Kontakt
//                vom Aderquerschnitt abhaengt.
//
// Ein Kabelende verweist auf einen SteckerTyp und optional eine Konfektion
// (`Cable.steckerVon` / `steckerNach`). Die Stueckliste zaehlt daraus die
// Teile; siehe `lib/steckerKatalog.ts`.
//
// DATENREGEL: jeder eingebaute Eintrag traegt `datenblattUrl` — wie
// `manufacturerUrl` am Geraetekatalog (Initiative 11). Was dort nicht steht,
// steht hier auch nicht: kein Preis, keine Farbe ohne Beleg.
// ───────────────────────────────────────────────────────────────────────────

/** Geschlecht des Steckers bzw. seiner Kontakte. */
export type SteckerGeschlecht = 'male' | 'female'

/** Was fuer ein Kleinteil ein Konfektionsteil ist. */
export type SteckerTeilArt = 'contact' | 'lock' | 'seal' | 'backshell' | 'other'

export const STECKER_TEIL_ARTEN: SteckerTeilArt[] = ['contact', 'lock', 'seal', 'backshell', 'other']

export interface SteckerTeil {
  art: SteckerTeilArt
  teilenummer: string
  hersteller?: string
  beschreibung?: string
  /** Stueckzahl je Stecker, oder `perPole` = ein Teil je Pol (Kontakte). */
  anzahl: number | 'perPole'
  /**
   * Aderquerschnitt, fuer den das Teil gemacht ist, als AWG-Bereich
   * [dickste, duennste] — also kleine Zahl zuerst (16–20 AWG = [16, 20]).
   */
  awg?: [number, number]
  /** Stueckpreis, nur wenn belegt (Angebot, Preisliste). */
  preis?: number
  datenblattUrl?: string
}

export interface Konfektion {
  id: string
  name: string
  teile: SteckerTeil[]
}

export interface SteckerTyp {
  id: string
  teilenummer: string
  hersteller: string
  beschreibung: string
  /** Herstellerdatenblatt — Pflicht fuer eingebaute Eintraege. */
  datenblattUrl: string
  /** Zu welchem Steckertyp des Plans er gehoert (`ConnectorType`), wenn es einen gibt. */
  connectorType?: string
  polzahl: number
  geschlecht: SteckerGeschlecht
  farbe?: string
  preis?: number
  /** Zulaessiger Kabel-Aussendurchmesser laut Datenblatt, mm. */
  kabelOdMm?: [number, number]
  konfektionen: Konfektion[]
}

/** Wahl am Kabelende. */
export interface SteckerWahl {
  steckerId: string
  /** Fehlt sie, gilt die erste Konfektion bzw. der Vorschlag nach AWG. */
  konfektionId?: string
}
