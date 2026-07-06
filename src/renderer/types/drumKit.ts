// ───────────────────────────────────────────────────────────────────────────
// Drum-Mikrofonierung — Datentypen.
//
// Ein visuelles Schlagzeug (2D-Draufsicht) mit benannten Zonen (Kessel/Becken)
// und darauf platzierten Mikrofonen. Der eigentliche Nutzen sind die
// Ableitungen (Kanalliste, Phantom-Bedarf, BOM) — siehe lib/drumMicing.ts.
// Verlustfrei im Projekt + in der .avplan mitgefuehrt.
// ───────────────────────────────────────────────────────────────────────────

/** Eine benannte Zone am Kit (Kessel/Becken/Raum). Position normalisiert 0..1
 *  auf der SVG-Draufsicht, damit die Darstellung skaliert. */
export interface DrumZone {
  id: string
  /** Anzeige-Label ("Kick", "SN Top", "Tom 1" …). */
  label: string
  /** Zonen-Klasse — steuert Symbol + Default-Mic-Vorschlag. */
  kind: 'kick' | 'snare' | 'tom' | 'hihat' | 'ride' | 'crash' | 'overhead' | 'room'
  /** Normalisierte Position auf der Draufsicht (0..1). */
  x: number
  y: number
}

/** Ein auf einer Zone platziertes Mikrofon. */
export interface DrumMicPlacement {
  id: string
  /** Zonen-Id, auf der das Mic sitzt. */
  zoneId: string
  /** Stabile Geraetetyp-ID (GUID) aus dem Mikrofon-Katalog. Optional —
   *  ein noch nicht zugeordnetes Mic bleibt "unbekannt" (kein Raten). */
  micDeviceTypeId?: string
  /** Menschlicher Mic-Name (Anzeige/Print), auch ohne Katalog-Match. */
  micName?: string
  /** Kanal-Label fuer die Ableitung ("Kick In", "OH L"). Optional; wird sonst
   *  aus der Zone abgeleitet. */
  channelLabel?: string
  /** Teil eines Stereo-Paars (Overheads/Rooms) — gleiche Gruppen-Id = L/R-Paar. */
  stereoGroup?: string
}

/** Angewandte Mikrofonierungs-Technik (Preset-Startpunkt). */
export type DrumTechnique = 'custom' | 'minimal' | 'glynJohns' | 'recorderman' | 'closeFull'

export interface DrumKitPlan {
  /** Kit-Name/Notiz. */
  name?: string
  /** Zuletzt angewandte Technik (nur informativ). */
  technique?: DrumTechnique
  zones: DrumZone[]
  mics: DrumMicPlacement[]
}
