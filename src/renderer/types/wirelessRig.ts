// ───────────────────────────────────────────────────────────────────────────
// Wireless-Rig — Kanalplan für Funkmikrofone (Gesang, Headsets, Anstecker).
//
// Ein Kanal = ein Sänger/Objekt mit Sender-Body + Kapsel/Headset + Frequenz.
// Reitet — wie `drumKit` — verlustfrei im Projekt und im `.avplan`.
// Kompatibilität + RF-Koordination werden abgeleitet (siehe lib/wirelessRig.ts,
// lib/rfCoordination.ts), nichts wird geraten.
// ───────────────────────────────────────────────────────────────────────────

export interface WirelessChannel {
  id: string
  /** Sänger-/Kanalname (z. B. „Lead Vox", „Pfarrer"). */
  label: string
  /** Sender-Body (Hand- oder Taschensender) — GUID aus dem Wireless-Katalog. */
  bodyDeviceTypeId?: string
  /** Kapsel ODER Headset/Lavalier/Instrumentenkabel — GUID. */
  micDeviceTypeId?: string
  /** Belegte Sendefrequenz in MHz. */
  frequencyMhz?: number
}

export interface WirelessRigPlan {
  name?: string
  channels: WirelessChannel[]
}
