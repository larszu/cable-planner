/**
 * #344 — Frequenzband-Katalog bekannter Funkmikrofon-/IEM-Systeme.
 *
 * Ordnet eine Arbeitsfrequenz (MHz) den gängigen Hersteller-Band-Namen zu
 * (z. B. 478 MHz → Sennheiser „A1" / Shure „G50"), damit Planer Frequenzen
 * sofort einem Gerätesystem + regulatorischen Bereich zuordnen können.
 *
 * WICHTIG: Band-Buchstaben bedeuten je nach Produktserie/Region
 * unterschiedliche Bereiche. Dies ist eine *kuratierte Auswahl gängiger
 * Nominalbereiche* — vor dem Einsatz immer gegen das aktuelle Datenblatt
 * und die lokale Frequenzregulierung prüfen.
 */

export interface RfBand {
  /** Hersteller / Quelle ("Sennheiser", "Shure", "Regulatorisch (EU)" …). */
  mfr: string
  /** Produktlinie/Serie (Band-Buchstaben sind serienabhängig). */
  line: string
  /** Band-/Bereichsname (z. B. "A1", "G50", "1G8"). */
  band: string
  fromMHz: number
  toMHz: number
  /** Optionaler Hinweis (z. B. Region/Status). */
  note?: string
}

export const RF_BANDS: RfBand[] = [
  // ── Sennheiser evolution wireless (G3/G4) ────────────────────────────────
  { mfr: 'Sennheiser', line: 'ew G3/G4', band: 'A1', fromMHz: 470, toMHz: 516 },
  { mfr: 'Sennheiser', line: 'ew G3/G4', band: 'A', fromMHz: 516, toMHz: 558 },
  { mfr: 'Sennheiser', line: 'ew G3/G4', band: 'AS', fromMHz: 520, toMHz: 558 },
  { mfr: 'Sennheiser', line: 'ew G4', band: 'G', fromMHz: 566, toMHz: 608 },
  { mfr: 'Sennheiser', line: 'ew G3/G4', band: 'GB', fromMHz: 606, toMHz: 648 },
  { mfr: 'Sennheiser', line: 'ew G3/G4', band: 'B', fromMHz: 626, toMHz: 668 },
  { mfr: 'Sennheiser', line: 'ew G3/G4', band: 'C', fromMHz: 734, toMHz: 776, note: 'EU eingeschränkt' },
  { mfr: 'Sennheiser', line: 'ew G3/G4', band: 'D', fromMHz: 780, toMHz: 822, note: 'EU nicht mehr zulässig' },
  { mfr: 'Sennheiser', line: 'ew G3', band: 'E', fromMHz: 823, toMHz: 865, note: 'nur 823–832 / 863–865 lizenzfrei (EU)' },
  { mfr: 'Sennheiser', line: 'ew/Digital', band: '1G8', fromMHz: 1785, toMHz: 1805, note: '1,8 GHz, EU lizenzfrei' },
  // Sennheiser EW-D / Digital (häufige EU-Ranges)
  { mfr: 'Sennheiser', line: 'EW-D', band: 'R1-6', fromMHz: 520, toMHz: 576 },
  { mfr: 'Sennheiser', line: 'EW-D', band: 'S1-7', fromMHz: 606, toMHz: 662 },
  { mfr: 'Sennheiser', line: 'EW-D', band: 'U1/5', fromMHz: 823, toMHz: 865, note: 'Duplex-Gap/Mitbenutzung' },

  // ── Shure (QLX-D / ULX-D / SLX-D, US-Nominalbereiche) ─────────────────────
  { mfr: 'Shure', line: 'QLXD/ULXD', band: 'G56', fromMHz: 470, toMHz: 514 },
  { mfr: 'Shure', line: 'QLXD/ULXD', band: 'G50', fromMHz: 470, toMHz: 534 },
  { mfr: 'Shure', line: 'Axient Digital', band: 'G57', fromMHz: 470, toMHz: 616, note: 'breites Tuning' },
  { mfr: 'Shure', line: 'QLXD/ULXD', band: 'H50', fromMHz: 534, toMHz: 598 },
  { mfr: 'Shure', line: 'SLX-D', band: 'H55', fromMHz: 514, toMHz: 558 },
  { mfr: 'Shure', line: 'QLXD/ULXD', band: 'J50', fromMHz: 572, toMHz: 636 },
  { mfr: 'Shure', line: 'ULXD', band: 'K59', fromMHz: 606, toMHz: 670 },
  { mfr: 'Shure', line: 'GLXD/BLX (900)', band: 'Z2/ISM', fromMHz: 902, toMHz: 928, note: 'US ISM 900 MHz' },

  // ── Sony (UWP-D, häufige EU-Ranges) ──────────────────────────────────────
  { mfr: 'Sony', line: 'UWP-D', band: 'CE42', fromMHz: 638, toMHz: 698 },
  { mfr: 'Sony', line: 'UWP-D', band: 'K33', fromMHz: 566, toMHz: 630 },

  // ── Regulatorische Referenz (EU PMSE) ────────────────────────────────────
  { mfr: 'Regulatorisch (EU)', line: 'PMSE', band: 'UHF-TV', fromMHz: 470, toMHz: 694, note: 'koordiniert, ggf. anmeldepflichtig' },
  { mfr: 'Regulatorisch (EU)', line: 'PMSE', band: 'Duplex-Gap', fromMHz: 823, toMHz: 832, note: 'lizenzfrei (DE/EU)' },
  { mfr: 'Regulatorisch (EU)', line: 'PMSE', band: 'Mitbenutzung', fromMHz: 863, toMHz: 865, note: 'lizenzfrei (DE/EU)' },
  { mfr: 'Regulatorisch (EU)', line: 'PMSE', band: '1G8', fromMHz: 1785, toMHz: 1805, note: 'lizenzfrei (DE/EU)' },
  { mfr: 'Regulatorisch', line: 'ISM', band: '2G4', fromMHz: 2400, toMHz: 2483.5, note: 'WLAN-Koexistenz' },
]

/** Alle Bänder, deren Bereich die gegebene Frequenz (MHz) enthält. */
export const bandsForFrequency = (mhz: number | null | undefined): RfBand[] => {
  if (mhz == null || !Number.isFinite(mhz)) return []
  return RF_BANDS.filter((b) => mhz >= b.fromMHz && mhz <= b.toMHz)
}

/** Kurz-Label „Hersteller Band" (z. B. „Sennheiser A1"). */
export const bandLabel = (b: RfBand): string => `${b.mfr} ${b.band}`
