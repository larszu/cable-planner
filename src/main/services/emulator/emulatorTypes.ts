// ───────────────────────────────────────────────────────────────────────────
// Emulator-Server (#1240, Stufe 5): gemeinsame Typen fuer main und renderer.
//
// Der Zustand ist eine FLACHE Tabelle `schluessel -> wert`. Das macht den
// Abgleich trivial: der Renderer schickt nur die Schluessel, die sich im Plan
// geaendert haben, und der Server meldet nur die, die ein Pult geschaltet
// hat. So ueberschreibt eine Planaenderung nie, was am Pult geschaltet wurde,
// und umgekehrt.
//
// ATEM-Schluessel (Nummern 0-basiert wie im Protokoll):
//   me.<m>.pgm / me.<m>.pvw          Quelle (ATEM-ID)
//   me.<m>.key.<k>.on                Keyer auf Sendung
//   me.<m>.key.<k>.fill / .key       Quelle
//   dsk.<d>.on / dsk.<d>.fill / .key
//   aux.<a>                          Quelle
//   ss.<s>.box.<b>.on / .src         SuperSource-Box
//   in.<id>.long / in.<id>.short     Name einer Quelle
//
// Videohub-Schluessel (0-basiert wie im Protokoll):
//   route.<o>                        Eingang auf Ausgang o
//   in.<i> / out.<o>                 Beschriftung
//   lock.<o>                         true = vom Plan gesperrt
// ───────────────────────────────────────────────────────────────────────────

export type EmuValues = Record<string, number | string | boolean>

export interface AtemEmuSource {
  id: number
  longName: string
  shortName: string
  /** Interner Anschlusstyp im Protokoll: 0 extern, 1 Schwarz, 2 Bars, 3 Farbe, 4/5 Mediaplayer, 6 SuperSource, 128 M/E, 129 Aux. */
  internalPortType: number
}

export interface AtemEmuTopology {
  /** Steht in ATEM Software Control und Companion als Modellname. Beginnt immer mit „Emulator“. */
  productName: string
  mixEffects: number
  keyersPerMe: number
  downstreamKeyers: number
  aux: number
  mediaPlayers: number
  superSources: number
  superSourceBoxes: number
  stills: number
  macros: number
  sources: AtemEmuSource[]
}

export interface VideohubEmuTopology {
  /** Freundlicher Name; beginnt immer mit „Emulator“. */
  friendlyName: string
  inputs: number
  outputs: number
}

export type EmuKind = 'atem' | 'videohub'

export interface EmuStartRequest {
  kind: EmuKind
  equipmentId: string
  /** false = nur 127.0.0.1 (Vorgabe); true = alle Netzwerkschnittstellen. */
  lan: boolean
  /** Nur fuer Tests; die Oberflaeche nimmt immer den Geraete-Port (9910 bzw. 9990). */
  port?: number
  topology: AtemEmuTopology | VideohubEmuTopology
  values: EmuValues
}

export interface EmuStatus {
  kind: EmuKind
  equipmentId: string
  running: boolean
  /** Adresse, unter der der Emulator erreichbar ist, z. B. `127.0.0.1:9910`. */
  address: string | null
  lan: boolean
  clients: number
  error?: string
}

export interface EmuChange {
  kind: EmuKind
  equipmentId: string
  values: EmuValues
}
