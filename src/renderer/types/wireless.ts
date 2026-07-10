// ───────────────────────────────────────────────────────────────────────────
// Wireless-Mikrofon-Kompatibilität — Handsender/Kapsel + Taschensender/Anstecker.
//
// Grundsatz „nichts erfinden": Kompatibilität wird NUR über einen geteilten,
// DOKUMENTIERTEN Fassungs-/Steckverbinder-Standard behauptet. Ist der Standard
// eines Geräts unbekannt, gilt es als nicht sicher kompatibel — nicht geraten.
//
// Zwei Achsen:
//  1. Handsender-Body  ⇄  Schraub-/Steck-Kapsel  (capsuleMount)
//  2. Taschensender    ⇄  Headset/Lavalier/Instrumentenkabel (bodypackConnector)
// GUID (`deviceTypeId`) macht die Typen App-übergreifend identifizierbar.
// ───────────────────────────────────────────────────────────────────────────

/**
 * Fassungs-System einer Handsender-Kapsel. Ein Body nimmt nur Kapseln mit
 * demselben Mount auf. Quellen: Shure ULX-D/AD/QLX-D/SLX-D (gemeinsames
 * Shure-Gewinde), Sennheiser evolution vs. Digital 6000/9000.
 */
export type CapsuleMount =
  | 'shure-thread' // Shure-Handheld-Gewinde (ULXD2/AD2/QLXD2/SLXD2 …)
  | 'sennheiser-ew' // Sennheiser evolution SKM 100/300/500 (G3/G4)
  | 'sennheiser-9000' // Sennheiser SKM 6000/9000 (MMD/MME 9-Serie)
  | 'neumann-kk' // Neumann KK-Kapseln (auf Sennheiser 6000/9000)
  | 'unknown'

/**
 * Steckverbinder eines Taschensenders für Headset/Lavalier/Instrumentenkabel.
 * Achtung: viele Headsets/Lavaliere sind in MEHREREN Terminierungen bestellbar
 * — der Wert beschreibt die konkrete Ausführung, nicht das Modell generisch.
 */
export type BodypackConnector =
  | 'shure-ta4f' // Shure TA4F / TQG (SLX/ULXD1/QLXD1 …)
  | 'shure-lemo' // Shure Axient AD1/ADX1 (LEMO)
  | 'sennheiser-3.5-lock' // Sennheiser evolution 3,5 mm verriegelbar (SK 100/300/500)
  | 'sennheiser-lemo' // Sennheiser Digital 6000/9000 (LEMO)
  | 'lectrosonics-ta5' // Lectrosonics TA5 / servo
  | 'unknown'

/** Rolle eines Wireless-Bausteins. */
export type WirelessRole =
  | 'handheldBody' // Handsender ohne Kapsel
  | 'capsule' // Schraub-/Steck-Kapsel für Handsender
  | 'bodypackBody' // Taschensender
  | 'headset' // Headset-/Kopfbügelmikrofon
  | 'lavalier' // Ansteck-/Lavaliermikrofon
  | 'instrumentCable' // Instrumentenkabel für Taschensender
  | 'receiver' // Empfänger (nur zur Systemzuordnung)

/**
 * Ein Wireless-Baustein (Body, Kapsel, Anstecker …) im Kompatibilitäts-Katalog.
 */
export interface WirelessDevice {
  /** GUID — App-übergreifend stabil. */
  deviceTypeId: string
  name: string
  brand: string
  role: WirelessRole
  /** Handsender-Body + Kapsel: Fassungs-System. */
  capsuleMount?: CapsuleMount
  /** Taschensender + Headset/Lavalier/Instrument: Steckverbinder. */
  bodypackConnector?: BodypackConnector
  /** Serie/System (z. B. „ULX-D", „EW 500 G4"). */
  series?: string
  /** Richtcharakteristik (bei Kapseln/Mikros), Vokabular wie im Mic-Schema. */
  polarPattern?: 'omni' | 'cardioid' | 'super' | 'hyper' | 'fig8'
  /** Wandlerprinzip. */
  transducer?: 'dynamic' | 'condenser'
  /** Kurznotiz (z. B. typischer Einsatz, Klang). */
  notes?: string
}
