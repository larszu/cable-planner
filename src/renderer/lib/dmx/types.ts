// ───────────────────────────────────────────────────────────────────────────
// Das DMX-Modell: ein Geraet, seine Modi, und was es im Universe belegt.
//
// ─── DER BEFUND, DER DIESES MODUL AUSGELOEST HAT (gemessen 2026-09-10) ──────
//
// Beide Planer kannten den BEGRIFF „DMX-Kanaele", aber keiner kannte MODI:
//
//   light-planner  `Fixture.dmxChannels?: number` — EINE Zahl je Geraet.
//                  Der Robin MegaPointe steht dort mit `dmxChannels: 30`.
//   cable-planner  `categorySchemas.Licht` bietet zwei freie Felder,
//                  `dmxChannels` und `dmxAddress`. Beide tippt ein Mensch,
//                  gerechnet wird mit keinem von beiden.
//
// Ein Moving Head hat aber nicht EINEN Fussabdruck, sondern je Modus einen.
// Wer im Pult Modus A faehrt und im Plan mit der Zahl aus Modus B rechnet,
// bekommt eine Adressliste, in der ab dem zweiten Geraet JEDE Adresse falsch
// ist — und zwar um genau so viel, wie die beiden Modi auseinanderliegen.
// Das faellt nicht beim Patchen auf, sondern wenn das dritte Geraet auf einen
// Befehl reagiert, der dem zweiten galt.
//
// Deshalb ist der Modus hier keine Eigenschaft nebenbei, sondern das, was die
// Adressvergabe ueberhaupt erst entscheidbar macht.
//
// ─── WARUM `herkunft` PFLICHT IST ──────────────────────────────────────────
//
// Eine Kanalzahl ist eine BEHAUPTUNG ueber ein fremdes Geraet. Steht sie ohne
// Quelle da, ist sie von einer Messung nicht zu unterscheiden — dieselbe
// Defektform, gegen die `Senkenprofil.herkunft` (B-47) und die sechs Kataloge
// (B-11) stehen. `herkunft` ist deshalb kein optionales Feld: wer einen Modus
// eintraegt, sagt dazu, woher die Zahl kommt.
// ───────────────────────────────────────────────────────────────────────────

/** Kanaele je DMX-Universe. Keine Konvention, sondern die Groesse des Pakets. */
export const UNIVERSE_GROESSE = 512

/**
 * Woher die Kanalzahl eines Modus stammt.
 *
 * `geraet` meint: am echten Geraet abgelesen (Display/Menu). `pult` meint:
 * aus einem eingelesenen Pult-Patch uebernommen — das Pult weiss, womit es
 * tatsaechlich faehrt, und ist damit die staerkste Quelle im Haus.
 */
export type ModusHerkunft = 'handbuch' | 'gdtf' | 'pult' | 'geraet' | 'geschaetzt'

/**
 * Ein Betriebsmodus eines Geraets.
 *
 * `kanaele` ist der Fussabdruck IN DIESEM MODUS. Mehr steht hier absichtlich
 * nicht: welche Kanalnummer welche Funktion hat, ist Sache des Pults und
 * gehoert nicht in eine Planungssoftware — der Plan beantwortet „wie viele
 * und ab wo", nicht „was tut Kanal 7".
 */
export interface DmxModus {
  /** Stabil je Profil. Der Plan speichert diese Id, nicht den Namen. */
  id: string
  /** Wie der Modus am Geraet heisst, z. B. `Mode 1` oder `Standard 16bit`. */
  name: string
  /** Fussabdruck in Kanaelen. Muss >= 1 sein. */
  kanaele: number
  /** Woher die Zahl kommt — Pflicht, siehe Kopf. */
  herkunft: ModusHerkunft
  /** Freitext zur Quelle: Seitenzahl, Dateiname, Pult-Export, Datum. */
  beleg?: string
}

/**
 * Ein Geraetetyp, wie ihn die Bibliothek fuehrt.
 *
 * `modi` darf LEER sein — dann ist ueber die Modi dieses Geraets nichts
 * erklaert, und die Adressvergabe sagt das, statt eine Zahl zu erfinden.
 */
export interface DmxProfil {
  hersteller: string
  modell: string
  modi: DmxModus[]
}

/**
 * Ein Geraet im Plan, so weit die Adressvergabe es braucht.
 *
 * Bewusst KEIN Bezug auf `EquipmentItem` (cable-planner) oder `PlacedFixture`
 * (light-planner): beide Apps reichen ihre eigenen Objekte hier durch eine
 * schmale Abbildung herein. Das Paket rechnet, es kennt keine App.
 */
export interface DmxGeraet {
  id: string
  /** Fuer die Meldung — der Name, den der Nutzer auf dem Blatt sucht. */
  name: string
  profil?: DmxProfil
  /** Welcher Modus gefahren wird. Fehlt er, wird nicht adressiert. */
  modusId?: string
  /** Universe (1-basiert) und Startadresse (1..512), soweit gesetzt. */
  universe?: number
  adresse?: number
  /**
   * Diese Adresse hat ein Mensch gesetzt und die Automatik fasst sie nicht an.
   *
   * Dieselbe Bauform wie `Port.nameFromUser` (#838): eine von Hand gesetzte
   * Adresse ist von einer vergebenen nicht zu unterscheiden, solange niemand
   * es hinschreibt — und still verschoben zu werden ist das, was einem im
   * Saal am teuersten zu stehen kommt.
   */
  adresseFestgesetzt?: boolean
  /** Sortierschluessel fuer die Lesereihenfolge (Position im Plan). */
  x?: number
  y?: number
}

/** Der belegte Bereich eines Geraets — beide Grenzen einschliesslich. */
export interface Belegung {
  geraetId: string
  universe: number
  von: number
  bis: number
}

export type BefundArt =
  /** Zwei Geraete belegen denselben Kanal. */
  | 'ueberschneidung'
  /** Der Fussabdruck passt nicht mehr in dieses Universe. */
  | 'universe-voll'
  /** Ein Modus mit mehr als 512 Kanaelen — in keinem Universe unterzubringen. */
  | 'modus-zu-gross'
  /** Kein Modus gewaehlt: der Fussabdruck ist unbekannt. */
  | 'modus-fehlt'
  /** Das Profil kennt gar keine Modi. */
  | 'profil-ohne-modi'
  /** Der gewaehlte Modus steht nicht (mehr) im Profil. */
  | 'modus-unbekannt'
  /** Die Kanalzahl ist geschaetzt — der Plan sagt es, statt sie zu glauben. */
  | 'herkunft-geschaetzt'

/**
 * Ein Befund, SPRACHFREI.
 *
 * `schluessel` + `werte` fuer die Uebersetzung, `text` ist der englische Satz
 * mit eingesetzten Werten und zugleich der Fallback. Dieselbe Bauform wie
 * `types/adapter.ts` im cable-planner (#837) — und aus demselben Grund: das
 * Paket wird von zwei Apps mit zwei Woerterbuechern angezeigt, und ein
 * `t()` hier drin haenge das Ergebnis an die eingestellte Sprache.
 */
export interface DmxBefund {
  art: BefundArt
  geraetId: string
  /** Bei `ueberschneidung`: das andere Geraet. */
  anderesGeraetId?: string
  schwere: 'fehler' | 'warnung' | 'hinweis'
  schluessel: string
  werte: Record<string, string | number>
  text: string
}

export interface VergabeOptionen {
  /** Erstes Universe, in dem vergeben wird. */
  startUniverse: number
  /** Erste Adresse darin. */
  startAdresse: number
  /**
   * Ein Geraet darf nicht ueber eine Universe-Grenze hinweg liegen.
   *
   * Das ist keine Einstellung, sondern eine Tatsache des Protokolls — die
   * Option existiert nur, damit der Aufrufer sie nicht versehentlich als
   * gegeben ansieht. Wer sie auf `false` setzt, bekommt einen Befund.
   */
  universeGrenzeAchten?: boolean
}

export interface VergabeErgebnis {
  /** Je Geraet-Id das Ergebnis; Geraete ohne Modus fehlen hier. */
  vergeben: Map<string, { universe: number; adresse: number }>
  belegungen: Belegung[]
  befunde: DmxBefund[]
}
