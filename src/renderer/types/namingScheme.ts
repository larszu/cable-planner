// ───────────────────────────────────────────────────────────────────────────
// BEDARF 74 (P2) — Namen nach Regel statt nach Gefuehl, und ein Umbenennungs-
// satz, den jemand abtippen kann.
//
// Der Beleg ist ungewoehnlich hart: Audinates EIGENE offizielle Anleitung zum
// Massen-Umbenennen lautet, ein Dante-Preset zu speichern, die XML-Datei in
// einem Texteditor zu oeffnen, den Geraetenamen per Suchen-und-Ersetzen zu
// tauschen und das Preset wieder einzuspielen — damit die Subscriptions
// ueberleben. Wenn der Hersteller den Texteditor empfiehlt, fehlt das Feature
// unmissverstaendlich.
//
// Dazu die zweite Haelfte des Belegs: das Umbenennen eines Sendekanals bricht
// ab Firmware 4.3 bestehende Subscriptions. Der A1, der in der Probenpause die
// Beschriftungen aufraeumt, zerlegt damit den Patch.
//
// ─── DREI DINGE, DIE DIESE DATEI TUT ───────────────────────────────────────
//
// 1. Namen aus einer REGEL erzeugen (Rolle-Ort-Nummer), statt sie zu tippen.
// 2. Pruefen, was die Regel anrichtet: doppelte Namen, zu lange Namen, und
//    Umbenennungen, die einen Verweis IM PLAN brechen.
// 3. Den Umbenennungssatz ausgeben — alt neben neu, zum Abtippen oder fuers
//    Suchen-und-Ersetzen.
//
// ─── WAS SIE AUSDRUECKLICH NICHT TUT ───────────────────────────────────────
//
// Sie schreibt KEINE Dante-Preset-XML. Diese Anwendung hat das Schema nie
// gesehen, es haengt an der Controller-Version, und eine Datei, die aussieht
// wie ein Preset und keines ist, wird in ein laufendes Netz eingespielt.
// Dieselbe Entscheidung wie beim NOALBS-Geruest (Bedarf 89): ein Geruest zum
// Abtippen, mit dem Hinweis IN der Datei.
//
// Und sie benennt NICHTS von selbst um. `applyNamingScheme` gibt ein neues
// Projekt zurueck, nachdem ein Mensch den Aenderungssatz gesehen hat — und
// verweigert die Anwendung, solange sie Namen doppeln wuerde. Das ist
// dieselbe Regel wie in Bedarf 96: ein Preset darf nie still ueberschreiben.
// ───────────────────────────────────────────────────────────────────────────

/** Woraus ein Namensteil gebildet wird. */
export type NamePart =
  /** Die Kategorie des Geraets („Video", „Audio"). */
  | 'category'
  /** Der Ort, in dessen Rahmen das Geraet liegt. */
  | 'location'
  /** Eine laufende Nummer innerhalb der Gruppe. */
  | 'index'
  /** Fester Text. */
  | 'literal'
  /** Der bisherige Name — fuer Schemata, die nur etwas anhaengen. */
  | 'current'

export interface NameSegment {
  part: NamePart
  /** Nur bei `literal`: der feste Text. */
  literal?: string
  /** Nur bei `index`: auf wie viele Stellen mit Nullen aufgefuellt wird. */
  pad?: number
}

export type NameCase = 'as-is' | 'upper' | 'lower'

export interface NamingScheme {
  segments: NameSegment[]
  /** Was zwischen die Teile kommt. Leer erlaubt. */
  separator: string
  caseMode: NameCase
  /**
   * Auf welche Kategorie das Schema wirkt. Leer heisst: auf alle.
   *
   * Ein Filter und kein Vorgabewert: ein Schema, das versehentlich auf jedes
   * Geraet im Plan losgeht, benennt in einem Zug die halbe Show um.
   */
  categoryFilter?: string
}

/**
 * Die Laengengrenze eines Dante-Geraetenamens.
 *
 * 31 Zeichen, aus der Audinate-Dokumentation zu Kanal-Beschriftungen, die die
 * Bedarfs-Datenbank als gelesene Fundstelle fuehrt
 * (support.getdante.com/hc/en-gb/articles/5453986486175). Die Zahl steht hier
 * mit ihrer Quelle, wie jeder andere Vorgabewert in dieser Codebasis auch —
 * eine geratene Grenze kuerzte Namen, die gepasst haetten.
 */
export const DANTE_NAME_LIMIT = 31

export const DANTE_NAME_LIMIT_SOURCE =
  'support.getdante.com/hc/en-gb/articles/5453986486175 (Kanal-/Geräte-Beschriftungen)'

/** Ein Vorschlag: was das Geraet heisst und was es heissen wuerde. */
export interface NameProposal {
  equipmentId: string
  before: string
  after: string
}
