// ───────────────────────────────────────────────────────────────────────────
// Transport-Eigenschaften eines Cases — Rollen, Rollenteller, Lage, Nachgeben
//
// ─── WARUM DAS NICHT IN `PhysicalDimensions` GEHÖRT ────────────────────────
//
// `PhysicalDimensions` trägt Breite, Höhe, Tiefe und Gewicht. Für die
// Ladeplanung reicht das nicht — und zwar nicht, weil Felder fehlen, sondern
// weil `heightMm` OHNE Rollenangabe MEHRDEUTIG IST. Ist die Rolle in der Höhe
// drin oder nicht? Wer das rät, liegt pro Lage 20 bis 40 mm daneben, und bei
// vier Lagen ist das eine ganze Lage. Am Dock heisst das: das Rolltor geht
// nicht zu.
//
// Deshalb steht hier ein eigener, optionaler Nachbar statt eines Anbaus.
// `PhysicalDimensions` liegt byte-gleich in den Planern (`inventoryPortable`
// trägt `avplan-inventory`); es zu erweitern wäre ein Versionssprung in allen
// Repos für ein Feld, das nur die Ladeplanung braucht.
//
// ─── ROLLENTELLER SIND EIN ECHTES BAUTEIL, KEINE ERFINDUNG ─────────────────
//
// Was umgangssprachlich „die Aussparungen oben" heisst, ist Industrie-
// Standardbeschlag: castor dishes, bei Penn Elcom und Swanflight im Katalog.
// Sie nehmen Rollen bis 100 mm auf, gibt es flach und tief, und sie ragen rund
// 20 mm nach INNEN — das betrifft das Innenmass, nicht das Aussenmass.
//
// Dazu gehört ein zweiter Beschlag: Auto-Turn-Rollen drehen sich beim Anheben
// selbsttätig in die Ausgangsstellung zurück, damit sie beim Absetzen in die
// Teller treffen. Für uns heisst das: eine freie Lenkrolle hat einen
// UNBESTIMMTEN Aufstandspunkt (sie schwenkt), eine Bock- oder Auto-Turn-Rolle
// einen bestimmten. Nur beim zweiten darf das Werkzeug Stapeln zusagen.
//
// ─── „STAPELBAR MIT GLEICHEM CASETYP" IST KEIN FLAG ────────────────────────
//
// Es sieht wie eine Typ-Eigenschaft aus, ist aber Geometrie: Stapeln geht,
// wenn das Tellerraster oben zum Rollenraster unten passt. Bei gleichem
// Casetyp ist das trivial erfüllt — deshalb WIRKT es wie eine Eigenschaft.
// Als Flag modelliert verliert man „Case A trägt Case B", und genau das kommt
// in der Praxis dauernd vor.
//
// Siehe `lib/stapeln.ts` für die Rechnung und `docs` für die Quellen.
// ───────────────────────────────────────────────────────────────────────────

/**
 * Bauart der Rolle.
 *
 * `swivel` ist die gewöhnliche Lenkrolle: sie schwenkt, ihr Aufstandspunkt
 * wandert auf einem Kreis um die Schwenkachse. `swivelAuto` ist die
 * Auto-Turn-Rolle, die beim Anheben zurückdreht. `fixed` ist die Bockrolle.
 */
export type CastorKind = 'fixed' | 'swivel' | 'swivelAuto'

/**
 * Die Rollen am Case.
 *
 * FEHLT DAS FELD, IST DAS NICHT „KEINE ROLLEN" — es ist unbekannt. Ein Case
 * ohne Angabe wird nicht als rollenlos gerechnet; es wird als ungeklärt
 * gemeldet.
 */
export interface CastorSpec {
  /** Aufbauhöhe der Rolle in mm. */
  heightMm: number
  /**
   * Ist `heightMm` in der Case-Höhe schon enthalten?
   *
   * Die eine Zeile, die den häufigsten Stapelfehler verhindert. Sie hat keine
   * Vorgabe: wer sie nicht ausfüllt, hat nicht gemessen.
   */
  includedInHeightMm: boolean
  kind: CastorKind
  braked?: boolean
  /**
   * Abstand der Rollenmitte von der jeweiligen Kante, je Achse, in mm.
   *
   * Ohne diese Angabe lässt sich kein Tellerabgleich rechnen — dann ist die
   * Antwort auf „passt das aufeinander" nicht „nein", sondern „unbekannt".
   */
  insetMm?: { x: number; y: number }
}

/** Rollenteller im Deckel — die Aufnahme für das Case darüber. */
export interface StackTopSpec {
  /**
   * Tiefe der Aussparung in mm.
   *
   * Der Teller SCHLUCKT einen Teil der Rollenhöhe. Genau deshalb ist die
   * Stapelhöhe nicht die Summe der beiden Case-Höhen.
   */
  recessDepthMm: number
  /** Grösste Rollenbreite, die der Teller aufnimmt (üblich bis 100). */
  fitsCastorMm: number
  /** Abstand der Tellermitte von der jeweiligen Kante, je Achse, in mm. */
  dishInsetMm: { x: number; y: number }
  /**
   * Wie weit der Teller nach innen ragt (rund 20 mm).
   *
   * Für die Packliste — was noch ins Case passt —, nicht für den Stapel.
   */
  innerProtrusionMm?: number
}

/**
 * Welche Lagen das Case verträgt.
 *
 * `upright` steht auf den Rollen. Gekippt (`onSide`, `onEnd`) liegt eine
 * rollenlose Fläche unten: die Aufbauhöhe entfällt, das Case ist nicht mehr
 * rollbar, und es trägt keinen Stapelpartner über die Teller.
 */
export type CaseOrientation = 'upright' | 'onSide' | 'onEnd'

/** Weiche Taschen, Ordertaschen, Kabelsäcke: sie geben nach. */
export interface DeformableSpec {
  /** Um wie viel mm sich das Stück je Achse zusammendrücken lässt. */
  compressibleMm?: { x?: number; y?: number; z?: number }
  /**
   * Belastbarkeit der Oberseite in kg.
   *
   * OHNE ANGABE TRÄGT EINE WEICHE TASCHE NICHTS. Das ist keine Vorsicht,
   * sondern die Hausregel: was nicht angegeben ist, ist nicht null und erst
   * recht nicht beliebig.
   */
  maxLoadOnTopKg?: number
}

/**
 * Alles, was ein Case für den Transport ausmacht, ausser den Aussenmassen.
 *
 * Jedes Feld optional — ein Bestand, in dem niemand die Rollen gepflegt hat,
 * soll nicht so aussehen, als hätte er keine.
 */
export interface TransportSpec {
  castors?: CastorSpec
  stackTop?: StackTopSpec
  /** Ohne Angabe gilt nur `upright` als geprüft; andere Lagen sind unbekannt. */
  orientations?: CaseOrientation[]
  deformable?: DeformableSpec
  /** Höchstlast auf diesem Case in kg. */
  maxStackKg?: number
  /** Höchstzahl Lagen über diesem Case. */
  maxLayers?: number
  /** Auf dieses Case kommt nichts. Gilt unabhängig von `maxStackKg`. */
  noLoadOnTop?: boolean
}
