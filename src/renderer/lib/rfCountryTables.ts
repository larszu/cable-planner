// ───────────────────────────────────────────────────────────────────────────
// #1002 — Laenderspezifische Frequenztabellen fuer Funkmikrofone/IEM.
//
// Grundsatz „nichts erfinden": jede Zeile stammt aus einer amtlichen Quelle,
// die URL steht an der Tabelle. Ein Land ohne gepruefte Quelle steht hier
// nicht — lieber keine Tabelle als eine geratene.
//
// Deutschland:
//  - Vfg. 37/2026 (Amtsblatt Nr. 7/2026 vom 15.04.2026), Allgemeinzuteilung
//    von Frequenzen fuer Funkmikrofone, Tabelle 1 (Baender 1–7).
//  - SRD-Allgemeinzuteilung Vfg. 91/2025, auf der PMSE-Seite der
//    BNetzA zusammengefasst (821,5–832 / 863–865 / 1785–1805 MHz).
// ───────────────────────────────────────────────────────────────────────────

export interface RfCountryRange {
  fromMHz: number
  toMHz: number
  /** Maximale Strahlungsleistung, wie in der Quelle angegeben. */
  maxPower?: string
  /** Wer darf: Allgemeinheit oder nur professionelle Produktion. */
  use: 'general' | 'professional'
  /** Bedingungen aus der Quelle (Befristung, indoor, Raster …). */
  note?: string
  source: string
}

export interface RfCountryTable {
  /** ISO-3166-1 alpha-2. */
  code: string
  name: string
  regulator: string
  ranges: RfCountryRange[]
}

const DE_VFG37 =
  'https://www.bundesnetzagentur.de/DE/Fachthemen/Telekommunikation/Frequenzen/Allgemeinzuteilungen/_DL/Mikrofone/vfg37_2026.pdf'
const DE_SRD = 'https://www.bundesnetzagentur.de/864864'

export const RF_COUNTRY_TABLES: RfCountryTable[] = [
  {
    code: 'DE',
    name: 'Deutschland',
    regulator: 'Bundesnetzagentur',
    ranges: [
      { fromMHz: 32.475, toMHz: 34.325, maxPower: '10 mW ERP', use: 'general', note: 'bis 31.03.2036', source: DE_VFG37 },
      { fromMHz: 34.53, toMHz: 34.95, maxPower: '10 mW ERP', use: 'general', note: 'bis 31.03.2036', source: DE_VFG37 },
      { fromMHz: 36.61, toMHz: 38.125, maxPower: '10 mW ERP', use: 'general', note: 'bis 31.03.2036', source: DE_VFG37 },
      { fromMHz: 174, toMHz: 230, maxPower: '50 mW ERP', use: 'general', note: 'DAB+-Beeinträchtigungen möglich; bis 31.03.2036', source: DE_VFG37 },
      { fromMHz: 470, toMHz: 608, maxPower: '50 mW ERP', use: 'professional', note: 'nur professionelle Produktion; Raster 25 kHz; bis 31.12.2030', source: DE_VFG37 },
      { fromMHz: 614, toMHz: 698, maxPower: '50 mW ERP', use: 'professional', note: 'nur professionelle Produktion; Raster 25 kHz; bis 31.12.2030', source: DE_VFG37 },
      { fromMHz: 736, toMHz: 753, maxPower: '50 mW ERP', use: 'general', note: 'bis 31.03.2036', source: DE_VFG37 },
      { fromMHz: 821.5, toMHz: 832, use: 'general', note: 'SRD, Bedingungen laut Vfg. 91/2025', source: DE_SRD },
      { fromMHz: 863, toMHz: 865, use: 'general', note: 'SRD, Bedingungen laut Vfg. 91/2025', source: DE_SRD },
      { fromMHz: 1350, toMHz: 1400, maxPower: '50 mW EIRP', use: 'general', note: 'nur in geschlossenen Gebäuden; bis 31.03.2036', source: DE_VFG37 },
      { fromMHz: 1785, toMHz: 1805, use: 'general', note: 'SRD, Bedingungen laut Vfg. 91/2025', source: DE_SRD },
    ],
  },
]

export const countryTable = (code: string | undefined): RfCountryTable | undefined =>
  code ? RF_COUNTRY_TABLES.find((t) => t.code === code) : undefined

/**
 * Liegt der GANZE belegte Kanal (Mitte ± halbe Bandbreite) in einem Bereich
 * der Tabelle? `undefined`, wenn keine Frequenz oder kein Land gesetzt ist.
 */
export const rangeForChannel = (
  table: RfCountryTable | undefined,
  mhz: number | undefined,
  bandwidthKhz?: number,
): RfCountryRange | null | undefined => {
  if (!table || mhz == null || !(mhz > 0)) return undefined
  const half = (bandwidthKhz ?? 0) / 2000
  return table.ranges.find((r) => mhz - half >= r.fromMHz && mhz + half <= r.toMHz) ?? null
}
