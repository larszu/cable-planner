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
  /**
   * #1002 — Herstellerdokument, aus dem der Bereich stammt. Nur Baender MIT
   * Quelle werden im Funkstrecken-Dialog zur Auswahl angeboten; die uebrigen
   * dienen nur der Zuordnung im Analyse-Reiter und sind nicht gegengeprueft.
   */
  source?: string
}

const SRC_G4 =
  'https://www.sennheiser.com/globalassets/digizuite/40941-en-ew_g4_specifications_manufacturer_declarations_06_2025.pdf'
const SRC_ULXD = 'https://pubs.shure.com/view/guide/ULXD/en-US.pdf'
const SRC_QLXD = 'https://pubs.shure.com/view/guide/QLXD/en-US.pdf'
const SRC_SLXD = 'https://pubs.shure.com/view/guide/SLXD/en-US.pdf'
const SRC_AD = 'https://www.shure.com/en-US/docs/guide/AD4D'
const SRC_D6000 =
  'https://www.sennheiser.com/globalassets/digizuite/41650-en-sp_1194_v11.0_skm_6000_product_specification_en.pdf'
const SRC_EWD =
  'https://sennheiser.com/globalassets/digizuite/50338-en-2025-sennheiser-ew-d--ew-dx-design-guide.pdf'

export const RF_BANDS: RfBand[] = [
  // ── Sennheiser evolution wireless (G3/G4) ────────────────────────────────
  { mfr: 'Sennheiser', line: 'ew G3/G4', band: 'A1', fromMHz: 470, toMHz: 516, source: SRC_G4 },
  { mfr: 'Sennheiser', line: 'ew G3/G4', band: 'A', fromMHz: 516, toMHz: 558, source: SRC_G4 },
  { mfr: 'Sennheiser', line: 'ew G3/G4', band: 'AS', fromMHz: 520, toMHz: 558, source: SRC_G4 },
  { mfr: 'Sennheiser', line: 'ew G4', band: 'G', fromMHz: 566, toMHz: 608, source: SRC_G4 },
  { mfr: 'Sennheiser', line: 'ew G3/G4', band: 'GB', fromMHz: 606, toMHz: 648, source: SRC_G4 },
  { mfr: 'Sennheiser', line: 'ew G3/G4', band: 'B', fromMHz: 626, toMHz: 668, source: SRC_G4 },
  { mfr: 'Sennheiser', line: 'ew G3/G4', band: 'C', fromMHz: 734, toMHz: 776, note: 'EU eingeschränkt', source: SRC_G4 },
  { mfr: 'Sennheiser', line: 'ew G3/G4', band: 'D', fromMHz: 780, toMHz: 822, note: 'EU nicht mehr zulässig', source: SRC_G4 },
  { mfr: 'Sennheiser', line: 'ew G3', band: 'E', fromMHz: 823, toMHz: 865, note: 'nur 823–832 / 863–865 lizenzfrei (EU)', source: SRC_G4 },
  { mfr: 'Sennheiser', line: 'ew G4', band: '1G8', fromMHz: 1785, toMHz: 1800, note: '1,8 GHz', source: SRC_G4 },
  // Sennheiser EW-D (Bandgrenzen laut EW-D/EW-DX System Design Guide 2025)
  { mfr: 'Sennheiser', line: 'EW-D', band: 'Q1-6', fromMHz: 470.2, toMHz: 526, source: SRC_EWD },
  { mfr: 'Sennheiser', line: 'EW-D', band: 'R1-6', fromMHz: 520, toMHz: 576, source: SRC_EWD },
  { mfr: 'Sennheiser', line: 'EW-D', band: 'R4-9', fromMHz: 552, toMHz: 607.8, source: SRC_EWD },
  { mfr: 'Sennheiser', line: 'EW-D', band: 'S1-7', fromMHz: 606.2, toMHz: 662, source: SRC_EWD },
  { mfr: 'Sennheiser', line: 'EW-D', band: 'S4-7', fromMHz: 630, toMHz: 662, source: SRC_EWD },
  { mfr: 'Sennheiser', line: 'EW-D', band: 'S7-10', fromMHz: 662, toMHz: 693.8, source: SRC_EWD },
  { mfr: 'Sennheiser', line: 'EW-D', band: 'U1/5', fromMHz: 823.2, toMHz: 864.8, note: 'nur 823,2–831,8 / 863,2–864,8', source: SRC_EWD },
  { mfr: 'Sennheiser', line: 'EW-D', band: 'V3-4', fromMHz: 925.2, toMHz: 937.3, source: SRC_EWD },
  { mfr: 'Sennheiser', line: 'EW-D', band: 'Y1-3', fromMHz: 1785.2, toMHz: 1799.8, source: SRC_EWD },

  // Sennheiser EW-DX (gleicher Design Guide)
  { mfr: 'Sennheiser', line: 'EW-DX', band: 'Q1-9', fromMHz: 470.2, toMHz: 550, source: SRC_EWD },
  { mfr: 'Sennheiser', line: 'EW-DX', band: 'R1-9', fromMHz: 520, toMHz: 607.8, source: SRC_EWD },
  { mfr: 'Sennheiser', line: 'EW-DX', band: 'S1-10', fromMHz: 606.2, toMHz: 693.8, source: SRC_EWD },
  { mfr: 'Sennheiser', line: 'EW-DX', band: 'S2-10', fromMHz: 614.2, toMHz: 693.8, source: SRC_EWD },
  { mfr: 'Sennheiser', line: 'EW-DX', band: 'S4-10', fromMHz: 630, toMHz: 693.8, source: SRC_EWD },
  { mfr: 'Sennheiser', line: 'EW-DX', band: 'U1/5', fromMHz: 823.2, toMHz: 864.8, note: 'nur 823,2–831,8 / 863,2–864,8', source: SRC_EWD },
  { mfr: 'Sennheiser', line: 'EW-DX', band: 'V3-4', fromMHz: 925.2, toMHz: 951.8, note: 'nur 925,2–937,3 / 941,7–951,8', source: SRC_EWD },
  { mfr: 'Sennheiser', line: 'EW-DX', band: 'W5-6', fromMHz: 1240, toMHz: 1260, source: SRC_EWD },
  { mfr: 'Sennheiser', line: 'EW-DX', band: 'Y1-3', fromMHz: 1785.2, toMHz: 1799.8, source: SRC_EWD },
  // Sennheiser Digital 6000 (SKM 6000 Product Specification v11.0)
  { mfr: 'Sennheiser', line: 'Digital 6000', band: 'A1-A4', fromMHz: 470, toMHz: 558, source: SRC_D6000 },
  { mfr: 'Sennheiser', line: 'Digital 6000', band: 'A5-A8', fromMHz: 550, toMHz: 638, source: SRC_D6000 },
  { mfr: 'Sennheiser', line: 'Digital 6000', band: 'B1-B4', fromMHz: 630, toMHz: 718, source: SRC_D6000 },

  // ── Shure (Bandtabellen der Bedienungsanleitungen, pubs.shure.com) ───────
  { mfr: 'Shure', line: 'ULX-D', band: 'G50', fromMHz: 470, toMHz: 534, source: SRC_ULXD },
  { mfr: 'Shure', line: 'ULX-D', band: 'G51', fromMHz: 470, toMHz: 534, source: SRC_ULXD },
  { mfr: 'Shure', line: 'ULX-D', band: 'G52', fromMHz: 479, toMHz: 534, source: SRC_ULXD },
  { mfr: 'Shure', line: 'ULX-D', band: 'G53', fromMHz: 470, toMHz: 510, source: SRC_ULXD },
  { mfr: 'Shure', line: 'ULX-D', band: 'G56', fromMHz: 470, toMHz: 636, note: 'nur ULXD1/2/4D/4Q', source: SRC_ULXD },
  { mfr: 'Shure', line: 'ULX-D', band: 'G57', fromMHz: 470, toMHz: 608, note: 'nur ULXD1/2/4D/4Q', source: SRC_ULXD },
  { mfr: 'Shure', line: 'ULX-D', band: 'G62', fromMHz: 510, toMHz: 530, source: SRC_ULXD },
  { mfr: 'Shure', line: 'ULX-D', band: 'H50', fromMHz: 534, toMHz: 598, source: SRC_ULXD },
  { mfr: 'Shure', line: 'ULX-D', band: 'H51', fromMHz: 534, toMHz: 598, source: SRC_ULXD },
  { mfr: 'Shure', line: 'ULX-D', band: 'J50', fromMHz: 572, toMHz: 636, source: SRC_ULXD },
  { mfr: 'Shure', line: 'ULX-D', band: 'J51', fromMHz: 572, toMHz: 636, source: SRC_ULXD },
  { mfr: 'Shure', line: 'ULX-D', band: 'K51', fromMHz: 606, toMHz: 670, source: SRC_ULXD },
  { mfr: 'Shure', line: 'ULX-D', band: 'L50', fromMHz: 632, toMHz: 696, source: SRC_ULXD },
  { mfr: 'Shure', line: 'ULX-D', band: 'L53', fromMHz: 632, toMHz: 714, source: SRC_ULXD },
  { mfr: 'Shure', line: 'ULX-D', band: 'M19', fromMHz: 694, toMHz: 703, source: SRC_ULXD },
  { mfr: 'Shure', line: 'ULX-D', band: 'P51', fromMHz: 710, toMHz: 782, source: SRC_ULXD },
  { mfr: 'Shure', line: 'ULX-D', band: 'Q51', fromMHz: 794, toMHz: 806, source: SRC_ULXD },
  { mfr: 'Shure', line: 'ULX-D', band: 'V50', fromMHz: 174, toMHz: 216, source: SRC_ULXD },
  { mfr: 'Shure', line: 'ULX-D', band: 'X52', fromMHz: 902, toMHz: 928, source: SRC_ULXD },
  { mfr: 'Shure', line: 'ULX-D', band: 'Z16', fromMHz: 1240, toMHz: 1260, source: SRC_ULXD },
  { mfr: 'Shure', line: 'ULX-D', band: 'Z17', fromMHz: 1492, toMHz: 1525, source: SRC_ULXD },
  { mfr: 'Shure', line: 'ULX-D', band: 'Z18', fromMHz: 1785, toMHz: 1805, source: SRC_ULXD },
  { mfr: 'Shure', line: 'ULX-D', band: 'Z19', fromMHz: 1785, toMHz: 1800, source: SRC_ULXD },
  { mfr: 'Shure', line: 'ULX-D', band: 'Z20', fromMHz: 1790, toMHz: 1805, source: SRC_ULXD },
  { mfr: 'Shure', line: 'QLX-D', band: 'G51', fromMHz: 470, toMHz: 534, source: SRC_QLXD },
  { mfr: 'Shure', line: 'QLX-D', band: 'G53', fromMHz: 470, toMHz: 510, source: SRC_QLXD },
  { mfr: 'Shure', line: 'QLX-D', band: 'H51', fromMHz: 534, toMHz: 598, source: SRC_QLXD },
  { mfr: 'Shure', line: 'QLX-D', band: 'J51', fromMHz: 572, toMHz: 636, source: SRC_QLXD },
  { mfr: 'Shure', line: 'QLX-D', band: 'K51', fromMHz: 606, toMHz: 670, source: SRC_QLXD },
  { mfr: 'Shure', line: 'QLX-D', band: 'K52', fromMHz: 606, toMHz: 670, source: SRC_QLXD },
  { mfr: 'Shure', line: 'QLX-D', band: 'L52', fromMHz: 632, toMHz: 694, source: SRC_QLXD },
  { mfr: 'Shure', line: 'QLX-D', band: 'L53', fromMHz: 632, toMHz: 714, source: SRC_QLXD },
  { mfr: 'Shure', line: 'QLX-D', band: 'P51', fromMHz: 710, toMHz: 782, source: SRC_QLXD },
  { mfr: 'Shure', line: 'QLX-D', band: 'S50', fromMHz: 823, toMHz: 865, note: 'nur 823–832 / 863–865', source: SRC_QLXD },
  { mfr: 'Shure', line: 'QLX-D', band: 'V51', fromMHz: 174, toMHz: 216, source: SRC_QLXD },
  { mfr: 'Shure', line: 'QLX-D', band: 'X52', fromMHz: 902, toMHz: 928, source: SRC_QLXD },
  { mfr: 'Shure', line: 'QLX-D', band: 'Z18', fromMHz: 1785, toMHz: 1805, source: SRC_QLXD },
  { mfr: 'Shure', line: 'QLX-D', band: 'Z19', fromMHz: 1785, toMHz: 1800, source: SRC_QLXD },
  { mfr: 'Shure', line: 'SLX-D', band: 'G59', fromMHz: 470, toMHz: 514, source: SRC_SLXD },
  { mfr: 'Shure', line: 'SLX-D', band: 'G60', fromMHz: 470, toMHz: 510, source: SRC_SLXD },
  { mfr: 'Shure', line: 'SLX-D', band: 'G61', fromMHz: 479, toMHz: 523, source: SRC_SLXD },
  { mfr: 'Shure', line: 'SLX-D', band: 'H55', fromMHz: 514, toMHz: 558, source: SRC_SLXD },
  { mfr: 'Shure', line: 'SLX-D', band: 'H56', fromMHz: 518, toMHz: 562, source: SRC_SLXD },
  { mfr: 'Shure', line: 'SLX-D', band: 'H57', fromMHz: 520, toMHz: 564, source: SRC_SLXD },
  { mfr: 'Shure', line: 'SLX-D', band: 'J53', fromMHz: 562, toMHz: 606, source: SRC_SLXD },
  { mfr: 'Shure', line: 'SLX-D', band: 'K59', fromMHz: 606, toMHz: 650, source: SRC_SLXD },
  { mfr: 'Shure', line: 'SLX-D', band: 'L55', fromMHz: 646, toMHz: 690, source: SRC_SLXD },
  { mfr: 'Shure', line: 'SLX-D', band: 'L56', fromMHz: 650, toMHz: 694, source: SRC_SLXD },
  { mfr: 'Shure', line: 'SLX-D', band: 'L58', fromMHz: 630, toMHz: 674, source: SRC_SLXD },
  { mfr: 'Shure', line: 'SLX-D', band: 'M55', fromMHz: 694, toMHz: 758, note: 'nur 694–703 / 748–758', source: SRC_SLXD },
  { mfr: 'Shure', line: 'SLX-D', band: 'S50', fromMHz: 823, toMHz: 865, source: SRC_SLXD },
  { mfr: 'Shure', line: 'Axient Digital', band: 'G53', fromMHz: 470, toMHz: 510, source: SRC_AD },
  { mfr: 'Shure', line: 'Axient Digital', band: 'G54', fromMHz: 479, toMHz: 565, source: SRC_AD },
  { mfr: 'Shure', line: 'Axient Digital', band: 'G56', fromMHz: 470, toMHz: 636, source: SRC_AD },
  { mfr: 'Shure', line: 'Axient Digital', band: 'G57', fromMHz: 470, toMHz: 616, note: 'Lücke 608–614', source: SRC_AD },
  { mfr: 'Shure', line: 'Axient Digital', band: 'G62', fromMHz: 510, toMHz: 530, source: SRC_AD },
  { mfr: 'Shure', line: 'Axient Digital', band: 'H54', fromMHz: 520, toMHz: 636, source: SRC_AD },
  { mfr: 'Shure', line: 'Axient Digital', band: 'K53', fromMHz: 606, toMHz: 698, note: 'Lücke 608–614', source: SRC_AD },
  { mfr: 'Shure', line: 'Axient Digital', band: 'K55', fromMHz: 606, toMHz: 694, source: SRC_AD },
  { mfr: 'Shure', line: 'Axient Digital', band: 'K56', fromMHz: 606, toMHz: 714, source: SRC_AD },
  { mfr: 'Shure', line: 'Axient Digital', band: 'K57', fromMHz: 606, toMHz: 790, source: SRC_AD },
  { mfr: 'Shure', line: 'Axient Digital', band: 'K58', fromMHz: 622, toMHz: 698, source: SRC_AD },
  { mfr: 'Shure', line: 'Axient Digital', band: 'L54', fromMHz: 630, toMHz: 787, source: SRC_AD },
  { mfr: 'Shure', line: 'Axient Digital', band: 'P55', fromMHz: 694, toMHz: 806, note: 'nur 694–703 / 748–758 / 803–806', source: SRC_AD },
  { mfr: 'Shure', line: 'Axient Digital', band: 'X51', fromMHz: 925, toMHz: 937.5, source: SRC_AD },
  { mfr: 'Shure', line: 'Axient Digital', band: 'X55', fromMHz: 941, toMHz: 960, source: SRC_AD },
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

/** Stabiler Schluessel eines Bands (Hersteller|Serie|Band). */
export const bandId = (b: RfBand): string => `${b.mfr}|${b.line}|${b.band}`

/** #1002 — die im Dialog waehlbaren Baender: nur solche mit Herstellerquelle. */
export const selectableBands = (): RfBand[] => RF_BANDS.filter((b) => !!b.source)

export const bandById = (id: string | undefined): RfBand | undefined =>
  id ? RF_BANDS.find((b) => bandId(b) === id) : undefined
