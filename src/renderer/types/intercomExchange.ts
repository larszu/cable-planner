// ───────────────────────────────────────────────────────────────────────────
// Herstellerneutrales Intercom-Austauschformat (B-8, Inkrement 1).
//
// WARUM ES DAS GIBT. Der Green-GO-Round-Trip ist seit `cable#653` verlustfrei
// — aber er ist auch das Einzige, was es gibt. Wer die Anlage bei Riedel oder
// Clear-Com aufbaut, faengt bei null an; das Segment-Dossier fuehrt die Luecke
// woertlich als "no interchange format from anyone". Ein Plan, der die
// Sprechstellen und Konferenzen kennt, kann sie herausgeben, statt sie
// zweimal tippen zu lassen.
//
// WAS NEUTRAL HEISST UND WAS NICHT. Neutral ist die FACHLICHE Struktur:
// Sprechstellen, Konferenzen, wer spricht und wer hoert. Nicht neutral sind
// Transport und Anlagen-Details (Multicast-Adresse, Abtastrate, Farbindizes) —
// die haengen am Hersteller und stehen deshalb unter `vendor`, nach Hersteller
// getrennt. Sie mitzunehmen, aber als das zu kennzeichnen, was sie sind, ist
// ehrlicher als sie wegzuwerfen (der Round-Trip verloere sonst) oder sie in
// den neutralen Teil zu heben (dann waere er nicht neutral).
//
// TALK UND LISTEN GETRENNT — das ist der eigentliche Gehalt.
// `GreenGoUser.groupIds` ist EINE Liste: "diese Konferenzen gehen den Nutzer
// etwas an". In jeder realen Anlage sind das zwei Fragen. Die Regie hoert den
// Kamera-Kanal mit, spricht aber nur auf PGM; eine Kamera hoert PGM, spricht
// aber nur zur Regie. Wer das in einer Liste fuehrt, kann den Unterschied
// nicht ausdruecken, und beim Uebertragen in ein anderes System raet jemand.
// Aus einer Green-GO-Konfiguration lesen wir deshalb beide Richtungen als
// gesetzt (mehr weiss die Quelle nicht) und SAGEN das im Feld `derivedFrom` —
// statt eine Genauigkeit zu behaupten, die die Quelle nicht hergibt.
// ───────────────────────────────────────────────────────────────────────────

export const INTERCOM_FORMAT = 'avplan-intercom'

/**
 * Erhoehen, sobald ein Feld dazukommt, dessen Fehlen beim Re-Export etwas
 * LOESCHT — dieselbe Regel wie beim portablen Lager
 * (`inventoryPortable.ts`), und aus demselben Grund: eine Versionsnummer,
 * die nur mitzaehlt, sagt einem Leser nichts.
 *
 * VERSION 2 (2026-09-09): die TASTENBELEGUNG (`IntercomStation.keys`). Genau
 * der Fall, fuer den diese Regel geschrieben ist — ein v1-Leser kennt das
 * Feld nicht, nimmt die Datei an und laesst die Belegung fallen. Die
 * Ablehnung einer zu neuen Version auf der Gegenseite gehoert deshalb zur
 * Erweiterung dazu; sie ist in `Broadcast-intercom/packages/shared`
 * (`INTERCOM_PLAN_VERSION`) in derselben Sitzung mitgehoben worden. Wer nur
 * eine Seite aktualisiert, bekommt eine ehrliche Fehlermeldung statt einer
 * halben Uebernahme.
 */
export const INTERCOM_FORMAT_VERSION = 2

/** Eine Konferenz / ein Kanal ("PGM", "CAM", "Ton"). */
export interface IntercomChannel {
  /** Stabil innerhalb der Datei; keine Anlagen-Nummer. */
  id: string
  name: string
  /** Freitext, was auf dem Kanal besprochen wird. */
  purpose?: string
}

/** Wie eine Sprechstelle an einer Konferenz haengt. */
export interface IntercomMembership {
  channelId: string
  /** Die Stelle kann auf diesen Kanal sprechen. */
  talk: boolean
  /** Die Stelle hoert diesen Kanal mit. */
  listen: boolean
}

/**
 * Eine Taste auf der Sprechstelle: welche Konferenz liegt auf welchem Platz.
 *
 * Format-Version 2. Die Belegung ist eine REGIE-ENTSCHEIDUNG und keine Folge
 * der Zugehoerigkeit — wer auf drei Konferenzen haengt, hat dadurch noch
 * keine Reihenfolge. Sie steht deshalb neben `memberships` und nicht darin,
 * genau wie `GreenGoUser.keys` neben `groupIds` steht.
 *
 * Seite und Taste zaehlen ab 1 und werden nicht beschnitten: Green-GO
 * schreibt zwei Seiten, gesehen wurden mehr, und was der Plan nicht
 * versteht, veraendert er nicht.
 */
export interface IntercomKeyPosition {
  page: number
  button: number
  /** Die Konferenz auf dieser Taste — die neutrale Kennung, keine Nummer. */
  channelId: string
}

/** Eine Sprechstelle / Rolle ("Regie", "Kamera 1"). */
export interface IntercomStation {
  id: string
  /** Rollenname, wie er in der Regie gesagt wird. */
  name: string
  /** Kurzform fuer das Display der Sprechstelle, wenn eine gepflegt ist. */
  shortName?: string
  memberships: IntercomMembership[]
  /**
   * Geraet im Plan, an dem die Stelle haengt — die Bruecke zurueck in die
   * Verkabelung. Bewusst der Plan-eigene Bezeichner und keine Seriennummer:
   * das Format beschreibt einen PLAN, keine Inventur.
   */
  equipmentId?: string
  /**
   * Die Tastenbelegung, wenn der Plan sie fuehrt (Format-Version 2).
   *
   * DREI ZUSTAENDE, NICHT ZWEI — und der Unterschied ist der Grund fuer das
   * Fragezeichen:
   *
   *   `undefined` — der Plan weiss ueber die Belegung dieser Stelle nichts.
   *   `[]`        — der Plan kennt die Karte, und sie ist leer.
   *   Eintraege   — so liegt sie.
   *
   * Das ist wortgleich die Unterscheidung aus `GreenGoUser.keys`, und sie
   * muss ueber die Datei ueberleben: wer sie hier auf „leer oder nicht"
   * verkuerzt, laesst die Belegung, die jemand gerade entfernt hat, beim
   * naechsten Import wieder auferstehen.
   */
  keys?: IntercomKeyPosition[]
}

export interface IntercomExchangeFile {
  format: typeof INTERCOM_FORMAT
  version: number
  /** ISO-Zeitstempel, vom Aufrufer gesetzt — hier keine Uhr. */
  exportedAt?: string
  /** Name der Anlage/Produktion. */
  systemName: string
  description?: string
  channels: IntercomChannel[]
  stations: IntercomStation[]
  /**
   * Herstellerspezifische Reste, nach Hersteller getrennt. Wer die Datei in
   * ein anderes System traegt, ignoriert den Block; wer sie zurueck in
   * dasselbe traegt, verliert nichts.
   */
  vendor?: Record<string, unknown>
  /**
   * Woraus die Datei gebaut wurde, im Klartext. Steht in der Datei, nicht nur
   * im Code: wer sie in vier Wochen oeffnet, sieht sofort, welche Angaben
   * gemessen und welche aus einer aermeren Quelle abgeleitet sind.
   */
  derivedFrom?: string
}
