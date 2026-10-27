// ─── DAS RASTER IST EINE ZAHL ───────────────────────────────────────────────
//
// NUTZER-MELDUNG 2026-09-12: „Stattdessen solltest du besser die
// Berechnungsgrundlage des A* von dem Raster abhaengig machen. Das Raster kann
// man doch auch im Menue veraendern. Da ist ein hart kodiertes 20-px-Zellen
// doch dumm. Ebenso das fest kodierte Raster der Geraete."
//
// Bis hierher standen DREI Zahlen fuer dieselbe Frage „wie gross ist ein
// Schritt":
//
//   * `uiStore.gridSize` — was das Menue anbietet (Einstellungen > Bearbeiten >
//     Rastergroesse), Vorgabe 11.
//   * `EQUIPMENT_LAYOUT` — Kopfhoehe 44, Port-Reihe 22, Polster 11, Breite 220.
//     Alles Vielfache von 11, aber als feste Zahlen hingeschrieben.
//   * `CELL_SIZE = 20` im Wegfinder.
//
// 20 ist kein Vielfaches von 11. Die Buchsen sassen also per Konstruktion
// zwischen zwei Gitterpunkten des Wegfinders, und der gezeichnete Weg holte
// den Rest als Stufe kurz vor der Buchse nach. Wer im Menue etwas anderes als
// 11 einstellte, verschob ausserdem nur das Einrasten der Geraete-Position —
// ihre Kopfhoehe, ihre Port-Reihen und der Wegfinder blieben, wo sie waren.
//
// Diese Datei hat deshalb EINEN Eingang: die eingestellte Rastergroesse. Alles
// andere wird daraus gerechnet.
//
// Die Datei bleibt rein — sie liest den Store nicht. Wer den eingestellten Wert
// braucht, nimmt `aktuellesRaster.ts`; wer nur rechnen will (Tests, Exporte),
// ruft `rasterAus(n)` mit seiner eigenen Zahl auf.

/**
 * Untergrenzen in Pixeln. Sie sind KEINE Rasterwerte, sondern Lesbarkeits- und
 * Bauform-Grenzen: unter 44 px passt die Kopfzeile mit Name und Kategorie
 * nicht, unter 22 px draengen sich zwei Port-Beschriftungen ineinander. Aus
 * ihnen wird das naechste Vielfache der Rastergroesse.
 */
export const RASTER_MINDEST = {
  HEADER_HEIGHT: 44,
  HEADER_HEIGHT_WITH_IP: 66,
  PORT_ROW: 22,
  PADDING: 11,
  DEFAULT_WIDTH: 220,
} as const

/** Vorgabe-Rastergroesse. Bei ihr ergibt sich exakt das Layout von vorher:
 *  44 / 66 / 22 / 11 / 220 — die Zahlen, die frueher fest hier standen. */
export const RASTER_DEFAULT = 11

/**
 * Kleinstes zulaessiges Raster.
 *
 * Eine Zelle des Wegfinders ist ab jetzt ein Rasterschritt. Die Zahl der Zellen
 * je Suche waechst deshalb quadratisch, wenn das Raster feiner wird — und das
 * ist der einzige Grund fuer diese Grenze.
 *
 * GEMESSEN am 2026-09-12, zwoelf Geraete mit je vier Ein- und Ausgaengen,
 * 264 Wege, Zeit je Weg:
 *
 *     Raster  2 px -> 23.67 ms      Raster 11 px ->  0.45 ms  (Vorgabe)
 *     Raster  3 px ->  9.47 ms      Raster 16 px ->  0.32 ms
 *     Raster  4 px ->  4.19 ms      Raster 22 px ->  0.22 ms
 *     Raster  6 px ->  1.33 ms      Raster 60 px ->  0.13 ms
 *
 * Bei 2 px braucht ein Plan mit 300 Kabeln rund sieben Sekunden; das merkt der
 * Nutzer beim Ziehen. Bei 6 px sind es vier Zehntel. Deshalb 6.
 *
 * Zum Vergleich das ALTE Verhalten, feste 20-px-Zellen neben einem 11-px-Raster
 * derselben Szene: 0.86 ms je Weg. Das eine Raster ist bei der Vorgabe also
 * nicht nur genauer, sondern auch schneller — ein feineres Gitter laesst A*
 * geradere Wege finden und spart die Umwege, die der Drehstrafe teuer waren.
 *
 * Die Grenze ist bewusst eine PRODUKT-Grenze und keine stille Klemmung im
 * Wegfinder: wer 6 px einstellt, bekommt 6 px auch im Geraete-Layout — sonst
 * waere es wieder zweierlei Mass.
 */
export const RASTER_MIN = 6
/** Groesstes zulaessiges Raster. Darueber passt ein Geraet mit vier Ports
 *  nicht mehr auf einen Bildschirm. */
export const RASTER_MAX = 60

/**
 * Groesse EINES Geraets, vom Nutzer auf der Flaeche gezogen (`eq.sizeScale`).
 *
 * Sie ist ein FAKTOR und keine Breite, und das ist der Kern dieser Loesung:
 * `equipmentLayout.ts` haelt fest, dass `eq.width`/`eq.height` ein Abbild der
 * zuletzt gemessenen Groesse sind und keine Absicht ausdruecken koennen — wer
 * Geraete ziehbar macht, braucht ein eigenes Feld. Dieses hier ist es.
 *
 * Als Faktor, weil die Groesse eines Geraets nicht frei ist: die Buchsen
 * muessen auf Gitterpunkten sitzen (siehe `zellenMass`), und die Hoehe folgt
 * der Zahl der Port-Reihen. Gezogen wird deshalb nicht eine Breite, sondern
 * der Faktor, mit dem die MINDESTMASSE unten multipliziert werden; danach
 * laeuft dieselbe Einrastung wie immer. So bleibt jede Buchse ein Gitterpunkt,
 * in jeder Groesse.
 *
 * Grenzen: unter 0,6 draengen sich die Port-Beschriftungen ineinander (das
 * Mindestmass 22 px traegt zwei Zeilen Schrift), ueber 3 passt ein Geraet mit
 * vier Ports nicht mehr auf einen Bildschirm — dieselbe Begruendung wie bei
 * `RASTER_MAX`. Die Stufe 0,05 haelt das Ziehen ruhig: ohne sie zittert die
 * Karte bei jedem Pixel Mausbewegung.
 */
export const SKALA_MIN = 0.6
export const SKALA_MAX = 3
export const SKALA_STUFE = 0.05
export const SKALA_VORGABE = 1

/** Faktor in die Grenzen bringen und auf die Stufe runden. */
export const skalaGrenzen = (n: number | undefined): number => {
  if (n == null || !Number.isFinite(n)) return SKALA_VORGABE
  const gestuft = Math.round(n / SKALA_STUFE) * SKALA_STUFE
  return Math.min(SKALA_MAX, Math.max(SKALA_MIN, Math.round(gestuft * 100) / 100))
}

export interface Raster {
  /** Schrittweite in Pixeln — die eine Zahl, aus der alles folgt. */
  GRID_SIZE: number
  HEADER_HEIGHT: number
  HEADER_HEIGHT_WITH_IP: number
  PORT_ROW: number
  PADDING: number
  DEFAULT_WIDTH: number
  /** Hoehe einer OPTIONALEN Kopfzeile (Untertitel, Beltpack-Name, Optik).
   *  Bei Vorgabe-Groesse ist sie die Schrittweite selbst — die Zahl, die
   *  vorher in Knoten und Layout je als `GRID_SIZE` hingeschrieben stand.
   *  Mit `SKALA` waechst sie mit, sonst stuende die groessere Schrift in
   *  einer Zeile alter Hoehe. */
  EXTRA_LINE: number
  /** Klickflaeche des ReactFlow-Handles. Bewusst NICHT rastergebunden — sie
   *  ist eine Fingerkuppe, kein Layoutmass. */
  HANDLE_SIZE: number
  /** Kantenlaenge einer Zelle des Wegfinders. Gleich der Schrittweite: nur
   *  dann ist jede Buchse ein Gitterpunkt (Begruendung bei `zellenMass`). */
  CELL_SIZE: number
  /** Der Faktor, mit dem dieses Raster gerechnet wurde. Schriftgroessen und
   *  die geschaetzten Textbreiten haengen daran — sie sind keine Rastermasse
   *  und rasten nicht ein, muessen aber mitwachsen. */
  SKALA: number
}

export const rasterGrenzen = (n: number): number =>
  Math.min(RASTER_MAX, Math.max(RASTER_MIN, Math.round(n)))

/** Naechstes Vielfaches von `g`, das `mindest` nicht unterschreitet. */
const aufVielfaches = (mindest: number, g: number): number =>
  g * Math.max(1, Math.ceil(mindest / g))

/**
 * Naechstes GERADES Vielfaches von `g`.
 *
 * Nur fuer die Port-Reihe. Die Buchse sitzt in deren Mitte
 * (`kopfhoehe + slot * PORT_ROW + PORT_ROW / 2`); waere PORT_ROW ein ungerades
 * Vielfaches, laege die halbe Reihe zwischen zwei Rasterpunkten und die Buchse
 * damit neben dem Gitter — genau der Fehler, den diese Datei abstellt.
 */
const aufGeradesVielfaches = (mindest: number, g: number): number =>
  2 * g * Math.max(1, Math.ceil(mindest / (2 * g)))

/**
 * Kantenlaenge einer Zelle des Wegfinders.
 *
 * Sie ist die Schrittweite selbst, und das ist keine Bequemlichkeit: alle
 * Buchsen-Koordinaten sind Vielfache von `g` (Geraete-Position eingerastet,
 * Kopfhoehe Vielfaches, Port-Reihe gerades Vielfaches). Ein Punkt liegt genau
 * dann auf jedem Gitterpunkt, wenn das Zellmass `g` TEILT. Ein groesseres Mass
 * — auch ein Vielfaches wie 2g — laesst jede zweite Port-Reihe wieder zwischen
 * die Zellen fallen. Es bleibt also `g`.
 */
const zellenMass = (g: number): number => g

/**
 * Alle Layoutmasse aus einer Rastergroesse — und, wenn der Nutzer das Geraet
 * groesser gezogen hat, aus seinem Faktor. Rein, ohne Store.
 *
 * Der Faktor greift an den MINDESTMASSEN an, nicht am Ergebnis. Erst
 * multiplizieren, dann einrasten: `aufVielfaches`/`aufGeradesVielfaches`
 * laufen unveraendert, und damit gilt die Zusage dieser Datei („jede Buchse
 * ist ein Gitterpunkt") fuer jede Groesse. Wuerde man umgekehrt das fertige
 * Mass skalieren, waere `PORT_ROW * 1,5` kein Vielfaches des Rasters mehr und
 * jede zweite Buchse laege daneben.
 */
export const rasterAus = (gridSize: number, skala: number = SKALA_VORGABE): Raster => {
  const g = rasterGrenzen(Number.isFinite(gridSize) ? gridSize : RASTER_DEFAULT)
  const s = skalaGrenzen(skala)
  const schluessel = `${g}:${s}`
  const gemerkt = zwischenspeicher.get(schluessel)
  if (gemerkt) return gemerkt
  const raster: Raster = {
    GRID_SIZE: g,
    HEADER_HEIGHT: aufVielfaches(RASTER_MINDEST.HEADER_HEIGHT * s, g),
    HEADER_HEIGHT_WITH_IP: aufVielfaches(RASTER_MINDEST.HEADER_HEIGHT_WITH_IP * s, g),
    PORT_ROW: aufGeradesVielfaches(RASTER_MINDEST.PORT_ROW * s, g),
    PADDING: aufVielfaches(RASTER_MINDEST.PADDING * s, g),
    DEFAULT_WIDTH: aufVielfaches(RASTER_MINDEST.DEFAULT_WIDTH * s, g),
    EXTRA_LINE: aufVielfaches(g * s, g),
    HANDLE_SIZE: 16,
    CELL_SIZE: zellenMass(g),
    SKALA: s,
  }
  zwischenspeicher.set(schluessel, raster)
  return raster
}

/** Dasselbe Raster in einer anderen Geraete-Groesse. Fuer Aufrufer, die ein
 *  Raster schon in der Hand haben (die Komponenten mit `useRaster()`) und es
 *  nur fuer EIN Geraet umrechnen wollen. */
export const rasterSkaliert = (raster: Raster, skala: number | undefined): Raster =>
  rasterAus(raster.GRID_SIZE, skalaGrenzen(skala))

// Zwischenspeicher je Rastergroesse UND Geraete-Faktor. Nicht fuer die
// Rechenzeit — die ist vernachlaessigbar —, sondern fuer die Identitaet:
// React-Komponenten rufen `rasterAus` im Rendern auf, und ein bei jedem Aufruf
// neues Objekt haette jede `useMemo`-Abhaengigkeit darauf wertlos gemacht.
//
// Bis 2026-10-27 war es EIN Platz. Das genuegte, solange alle Geraete dasselbe
// Raster teilten; seit jedes seinen eigenen Faktor tragen kann, raeumte ein
// Plan mit zwei verschieden grossen Geraeten den Platz bei jedem Knoten leer
// und gab jedem Aufrufer ein frisches Objekt — die Memoisierung waere still
// verschwunden. Die Zahl der Schluessel ist von der Stufung begrenzt
// (Rastergroessen 6..60 x Faktoren 0,6..3 in 0,05-Schritten), und praktisch
// stehen in einem Plan eine Handvoll.
const zwischenspeicher = new Map<string, Raster>()

/** Das Raster der Vorgabe. Fuer Aufrufer ohne Store-Zugang (Tests, Node-Skripte
 *  und die Voreinstellung des uiStore selbst). */
export const RASTER_VORGABE: Raster = rasterAus(RASTER_DEFAULT)
