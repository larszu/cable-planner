// ───────────────────────────────────────────────────────────────────────────
// Funktionsmodell fuer Mischer und Kreuzschienen (#1240, Stufe 1).
//
// Konzept: docs/konzept-mischer-kreuzschienen-simulation.md, Abschnitte 1-2.
// Kein Geraet ist ein Sonderfall. Jeder Mischer und jede Kreuzschiene ist
// eine Zusammensetzung weniger Bausteine; WELCHE, wie viele und mit welchen
// Grenzen, steht im Geraeteprofil (`SwitchingProfile`). Der Zustand, den der
// Planer setzt, liegt am Geraet im Projekt (`SwitchingState`).
//
// Die interne Signalfuehrung eines Mischers ist ebenfalls eine Matrix: jede
// M/E, SuperSource-Box, jeder Keyer-Eingang und Aux ist ein ZIEL, jede M/E,
// SuperSource, jeder Mediaplayer und Eingang eine QUELLE. Ein Weg durch das
// Geraet ist damit eine Folge von Kreuzpunkten und laesst sich genauso
// verfolgen wie ein Kabel im Plan (`innerPath.ts`).
//
// REIN: Typen, kein IO.
// ───────────────────────────────────────────────────────────────────────────
import type { Easing } from './easing'

/** Welche Rolle das Geraet hat. Kreuzschiene und Mischer sind getrennte Produkte. */
export type SwitchingRole = 'mixer' | 'router'

/** Die zaehlbaren Bausteine eines Mischers. Fehlt ein Wert, ist er nicht belegt. */
export interface SwitchingBlockCounts {
  /** Externe Videoeingaenge. */
  inputs?: number
  mixEffects?: number
  /** Upstream-Keyer insgesamt (Datenblatt nennt meist die Summe). */
  upstreamKeyers?: number
  /** Upstream-Keyer je M/E, wo das Datenblatt es ausdruecklich sagt. */
  upstreamKeyersPerMe?: number
  downstreamKeyers?: number
  superSources?: number
  /** Boxen (DVE-Ebenen) je SuperSource. */
  superSourceBoxes?: number
  mediaPlayers?: number
  /** Plaetze fuer Standbilder im Media-Pool. */
  stills?: number
  /** Plaetze fuer Clips im Media-Pool. */
  clips?: number
  colorGenerators?: number
  aux?: number
  multiviewers?: number
  dves?: number
  macros?: number
}

export type SwitchingBlockCountKey = keyof SwitchingBlockCounts

/**
 * Eine Betriebsart mit eigenen Grenzen (Format, Aufloesung).
 *
 * `limits` nennt NUR, was das Datenblatt fuer diese Betriebsart angibt. Ein
 * fehlender Wert heisst „nicht belegt“, nicht „wie im Normalbetrieb“: die
 * Pruefung meldet dann nichts, statt eine Zahl zu erfinden.
 */
export interface SwitchingMode {
  id: string
  /** Englische Quelle; die Oberflaeche uebersetzt. */
  label: string
  limits: SwitchingBlockCounts
}

/** Eine Ebene einer Kreuzschiene (Video, Audio n, Daten, Tally). */
export interface MatrixLevelDef {
  id: string
  label: string
}

/** Was eine Kreuzschiene ueber die Ebenen hinaus kann. Fehlt ein Wert: nicht belegt. */
export interface MatrixFeatures {
  /** Bild und Ton von verschiedenen Quellen auf dasselbe Ziel. */
  breakaway?: boolean
  /** Ziele lassen sich sperren. */
  locks?: boolean
  /** Vormerken und gemeinsam schalten. */
  takeMode?: boolean
}

/**
 * Das Geraeteprofil: Daten, kein Code.
 *
 * DATENREGEL: Jede Zahl stammt aus dem Datenblatt bzw. der Tech-Specs-Seite
 * des Herstellers. `manufacturerUrl` belegt alle Werte, `sources` belegt
 * einzelne Werte, die von einer anderen Herstellerseite stammen. Nicht
 * belegte Werte bleiben leer — nichts wird geschaetzt.
 */
export interface SwitchingProfile {
  role: SwitchingRole
  /** Welches offen dokumentierte Format die Quellen-IDs vorgibt. */
  idScheme?: 'atem' | 'videohub'
  manufacturerUrl: string
  /** Beleg je Wert, wo er nicht von `manufacturerUrl` stammt. */
  sources?: Partial<Record<SwitchingBlockCountKey | 'levels' | 'features', string>>
  blocks: SwitchingBlockCounts
  modes?: SwitchingMode[]
  /** Nur Kreuzschiene: Ebenen und Groesse. */
  levels?: MatrixLevelDef[]
  outputs?: number
  features?: MatrixFeatures
}

// ─── Zustand am Geraet (liegt im Projekt) ────────────────────────────────

export type KeyerType = 'luma' | 'chroma' | 'pattern' | 'dve'

export interface KeyerState {
  type?: KeyerType
  /** Liegt der Keyer auf dem Bild? Nur dann geht er in den Signalweg ein. */
  onAir?: boolean
}

/**
 * Ein belegter Platz im Media-Pool.
 *
 * `fotoId`: das Bild liegt im Projekt (`project.fotos`), geladen ueber
 * „Bild laden…“ oder Drag & Drop. Das ist der Weg, der ueberall geht, auch
 * im Browser und in einem noch nicht gespeicherten Projekt.
 * `anhangId`: ein vorhandener Bild-Anhang (Ordner `Anhaenge`, Desktop).
 * Steht beides, gilt `fotoId`.
 */
export interface MediaSlotState {
  anhangId?: string
  fotoId?: string
}

/** Ein Makro: Schrittfolge aus Befehlen des Modells. */
export interface MacroStep {
  delayMs?: number
  /** Kreuzpunkt setzen: Ziel-Knoten und Quelle. */
  route?: { dest: string; source: string }
  keyer?: { id: string; onAir: boolean }
}

export interface SwitchingMacro {
  id: string
  name: string
  steps: MacroStep[]
}

/** Benannte Menge von Kreuzpunkten, ein Ausloeser. */
export interface SwitchingSalvo {
  id: string
  name: string
  /** `level -> ziel -> quelle` */
  crosspoints: Record<string, Record<string, string>>
}

/** Eingefrorener Gesamtzustand, benannt. */
export interface SwitchingSnapshot {
  id: string
  name: string
  routes: Record<string, string>
  keyers?: Record<string, KeyerState>
}

export type LockKind = 'lock' | 'protect'

/** Uebergangsart einer M/E (Stufe 3). */
export type TransitionStyle = 'mix' | 'dip' | 'wipe'

/** Wipe-Muster wie in lz-vision-mixer (`lzwipe`). */
export type WipePattern = 'right' | 'left' | 'down' | 'up' | 'barnDoor' | 'circle' | 'diamond' | 'box'

// Die Wertelisten stehen hier, damit Heilung und Pult dieselbe Liste lesen.
export const TRANSITION_STYLES: readonly TransitionStyle[] = ['mix', 'dip', 'wipe']
export const WIPE_PATTERNS: readonly WipePattern[] = ['right', 'left', 'down', 'up', 'barnDoor', 'circle', 'diamond', 'box']

/** Einstellungen des Uebergangs einer M/E. Fehlt ein Wert, gilt die Vorgabe. */
export interface TransitionSettings {
  style?: TransitionStyle
  /** Dauer in Millisekunden. */
  rateMs?: number
  easing?: Easing
  wipe?: WipePattern
  /** Quelle (Knoten-ID) fuer Dip. Vorgabe: Schwarz. */
  dipSource?: string
}

/**
 * Eine SuperSource-Box. Einheiten wie in lz-switcher-motion: das Bild reicht
 * von x −16…16 und y −9…9 (y nach oben), Groesse 1 fuellt das Bild, Crop
 * wird am Quellbild gemessen (oben/unten 0…18, links/rechts 0…32).
 */
export interface BoxState {
  enabled?: boolean
  x?: number
  y?: number
  size?: number
  cropped?: boolean
  cropTop?: number
  cropBottom?: number
  cropLeft?: number
  cropRight?: number
}

/**
 * Der geplante Zustand. Alles optional: ein Mischer ohne Eintrag hat nichts
 * geplant, und eine leere Tabelle auf jedem Geraet waere Ballast.
 */
export interface SwitchingState {
  /** Betriebsart (`SwitchingMode.id`). */
  mode?: string
  /**
   * Vom Planer ergaenzte Bausteine — NUR wo das Profil nichts belegt (oder
   * es kein Profil gibt). Ein belegter Profilwert gewinnt immer.
   */
  blocks?: SwitchingBlockCounts
  /**
   * Interne Kreuzpunkte des Mischers: `ziel -> quelle` (Knoten-IDs aus
   * `internalMatrix.ts`). Aux-Busse auf einen EXTERNEN Eingang stehen nicht
   * hier, sondern in `plannedCrosspoints` am Geraet — dort liest sie der
   * Signalweg des Plans bereits. Eine Angabe, ein Ort.
   */
  routes?: Record<string, string>
  keyers?: Record<string, KeyerState>
  /** Media-Pool: `still:n -> Anhang`. */
  media?: Record<string, MediaSlotState>
  /** Kreuzschiene: Ebenen ausser Video, `level -> ziel -> quelle` (Port-IDs). */
  levels?: Record<string, Record<string, string>>
  /** Vorgemerkte Kreuzpunkte im Take-Modus, `level -> ziel -> quelle`. */
  pending?: Record<string, Record<string, string>>
  locks?: Record<string, LockKind>
  salvos?: SwitchingSalvo[]
  macros?: SwitchingMacro[]
  snapshots?: SwitchingSnapshot[]
  /** Aus einer ATEM-Setup-Datei gelesen (Stufe 4), siehe `AtemProfileState`. */
  atemProfile?: AtemProfileState
  /** Uebergang je M/E (`me:n`). */
  transitions?: Record<string, TransitionSettings>
  /** Lage der SuperSource-Boxen (`ss:n/box:k`). Fehlt eine, gilt das Quad. */
  boxes?: Record<string, BoxState>
}

// ─── ATEM-Setup-Datei (#1240, Stufe 4) ──────────────────────────────────

/**
 * Was eine geladene ATEM-Setup-Datei (Profil-XML) mitbringt und das Modell
 * sonst nicht fuehrt. Die Datei selbst bleibt als `rawXml` erhalten: beim
 * Speichern wird nur ueberschrieben, was der Plan kennt, alles andere bleibt
 * byte-gleich. Nummern sind 1-basiert wie im Modell (die Datei zaehlt ab 0).
 */
export interface AtemProfileState {
  rawXml: string
  fileName?: string
  product?: string
  /** Eingangsnamen nach ATEM-Quellen-ID. */
  inputs?: Record<string, { shortName: string; longName: string }>
  colors?: Record<string, { hue: number; saturation: number; luma: number }>
  /** Media-Pool: Platz -> Name und Pfad aus der Datei. */
  stills?: Record<string, { name: string; path?: string }>
  /** SuperSource-Boxen an/aus, `ss:n/box:m -> enabled`. */
  boxes?: Record<string, boolean>
  macros?: Record<string, { name: string; description?: string }>
  /** Mix-Minus-Ausgaenge: Nummer -> `audioMode`. */
  mixMinus?: Record<string, string>
}
