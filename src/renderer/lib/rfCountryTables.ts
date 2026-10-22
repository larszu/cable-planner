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
// Oesterreich: FSB-LT „Ton- und Bilduebertragung", Stand 16.04.2026
//  (Fernmeldebehoerde), nur Schnittstellen mit „Drahtlose Mikrophone".
// Schweiz: BAKOM RIR1009-xx (je Band ein Dokument, konzessionsfrei).
// Niederlande: RDI-Seite zu Funkmikrofonen (Leistung dort nicht genannt).
// Frankreich: Arcep-Uebersicht zu PMSE-Audio (Leistung steht in den
//  Entscheidungen, die nicht abrufbar waren — daher ohne maxPower).
// USA: 47 CFR § 15.236 (lizenzfrei; lizenzierter Part-74-Betrieb fehlt).
// UK fehlt: Ofcom IR 2030 war nicht abrufbar (HTTP 403).
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

const AT_FSB =
  'https://www.fb.gv.at/dam/jcr:9a57515a-40f5-4e40-bd52-3a796b8b594f/FSB-LT%20-%20Ton-%20und%20Bild%C3%BCbertragung%20Stand%2016%20April%202026.pdf'
const CH_RIR = (n: string) => `https://www.ofcomnet.ch/api/rir/1009/${n}`
const NL_RDI = 'https://www.rdi.nl/onderwerpen/public-events/wireless-microphones-and-frequencies'
const FR_ARCEP =
  'https://www.arcep.fr/la-regulation/grands-dossiers-reseaux-mobiles/les-frequences-pour-les-professionnels-de-laudiovisuel-et-du-spectacle/les-equipements-auxiliaires-sonores-de-conception-de-programmes-et-de-radiodiffusion.html'
const US_15236 = 'https://www.ecfr.gov/current/title-47/chapter-I/subchapter-A/part-15/subpart-C/section-15.236'

export const RF_COUNTRY_TABLES: RfCountryTable[] = [
  {
    code: 'DE',
    name: 'Germany',
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
  {
    code: 'AT',
    name: 'Austria',
    regulator: 'Fernmeldebehörde (BMF)',
    ranges: [
      { fromMHz: 174, toMHz: 216, maxPower: '100 mW EIRP', use: 'general', note: 'FSB-LT015; generelle Bewilligung', source: AT_FSB },
      { fromMHz: 230, toMHz: 250, maxPower: '50 mW ERP', use: 'general', note: 'FSB-LT001; generelle Bewilligung', source: AT_FSB },
      { fromMHz: 470, toMHz: 694, maxPower: '100 mW EIRP', use: 'general', note: 'FSB-LT009; generelle Bewilligung', source: AT_FSB },
      { fromMHz: 694, toMHz: 703, maxPower: '50 mW EIRP (100 mW am Körper)', use: 'general', note: 'FSB-LT016', source: AT_FSB },
      { fromMHz: 733, toMHz: 758, maxPower: '50 mW EIRP (100 mW am Körper)', use: 'general', note: 'FSB-LT016', source: AT_FSB },
      { fromMHz: 788, toMHz: 790, maxPower: '50 mW EIRP (100 mW am Körper)', use: 'general', note: 'FSB-LT016', source: AT_FSB },
      { fromMHz: 821.5, toMHz: 826, maxPower: '20 mW EIRP (100 mW am Körper)', use: 'general', note: 'FSB-LT017', source: AT_FSB },
      { fromMHz: 826, toMHz: 832, maxPower: '100 mW EIRP', use: 'general', note: 'FSB-LT018', source: AT_FSB },
      { fromMHz: 960, toMHz: 1164, maxPower: '100 mW EIRP', use: 'professional', note: 'FSB-LT022; individuelle Bewilligung', source: AT_FSB },
      { fromMHz: 1350, toMHz: 1400, maxPower: '20 mW EIRP (50 mW am Körper)', use: 'general', note: 'FSB-LT019', source: AT_FSB },
      { fromMHz: 1517, toMHz: 1525, maxPower: '50 mW EIRP', use: 'general', note: 'FSB-LT021; nur Innenbereich', source: AT_FSB },
      { fromMHz: 1785, toMHz: 1804.8, maxPower: '20 mW EIRP (50 mW am Körper)', use: 'general', note: 'FSB-LT004', source: AT_FSB },
    ],
  },
  {
    code: 'CH',
    name: 'Switzerland',
    regulator: 'BAKOM',
    ranges: [
      { fromMHz: 174, toMHz: 223, maxPower: '50 mW ERP', use: 'general', note: 'RIR1009-02; konzessionsfrei', source: CH_RIR('02') },
      { fromMHz: 470, toMHz: 694, maxPower: '50 mW ERP', use: 'general', note: 'RIR1009-10; 608–614 MHz nicht im Umkreis 10 km um Bleien', source: CH_RIR('10') },
      { fromMHz: 821.5, toMHz: 826, maxPower: '20 mW EIRP (100 mW am Körper)', use: 'general', note: 'RIR1009-18', source: CH_RIR('18') },
      { fromMHz: 826, toMHz: 832, maxPower: '100 mW EIRP', use: 'general', note: 'RIR1009-13', source: CH_RIR('13') },
      { fromMHz: 863, toMHz: 865, maxPower: '10 mW ERP', use: 'general', note: 'RIR1009-05', source: CH_RIR('05') },
      { fromMHz: 1350, toMHz: 1400, maxPower: '20 mW EIRP (50 mW am Körper/SSP)', use: 'general', note: 'RIR1009-20; nur in Gebäuden', source: CH_RIR('20') },
      { fromMHz: 1785, toMHz: 1805, maxPower: '20 mW EIRP (50 mW am Körper/SSP)', use: 'general', note: 'RIR1009-09', source: CH_RIR('09') },
    ],
  },
  {
    code: 'NL',
    name: 'Netherlands',
    regulator: 'Rijksinspectie Digitale Infrastructuur (RDI)',
    ranges: [
      ...([
        [470, 556], [558, 564], [566, 572], [574, 580], [582, 588], [590, 596], [598, 604], [614, 694],
      ] as const).map(([fromMHz, toMHz]) => ({
        fromMHz, toMHz, use: 'general' as const,
        note: 'vergunningvrij; regional eingeschränkt (DVB-T), Bedingungen laut Regeling 2015', source: NL_RDI,
      })),
    ],
  },
  {
    code: 'FR',
    name: 'France',
    regulator: 'Arcep / ANFR',
    ranges: [
      { fromMHz: 174, toMHz: 223, use: 'general', note: 'Arcep-Entscheidungen 2010-0849/0850', source: FR_ARCEP },
      { fromMHz: 470, toMHz: 694, use: 'general', note: 'Arcep-Entscheidungen 2015-0830/2016-0272', source: FR_ARCEP },
      { fromMHz: 823, toMHz: 832, use: 'general', note: 'Duplexlücke 800 MHz', source: FR_ARCEP },
      { fromMHz: 1785, toMHz: 1805, use: 'general', note: 'Duplexlücke 1800 MHz', source: FR_ARCEP },
    ],
  },
  {
    code: 'US',
    name: 'USA',
    regulator: 'FCC',
    ranges: [
      { fromMHz: 54, toMHz: 72, maxPower: '50 mW EIRP', use: 'general', note: '§ 15.236; nur zugewiesene TV-Kanäle, ≥ 4 km außerhalb der Gleichkanal-Versorgung', source: US_15236 },
      { fromMHz: 76, toMHz: 88, maxPower: '50 mW EIRP', use: 'general', note: '§ 15.236; nur zugewiesene TV-Kanäle, ≥ 4 km außerhalb der Gleichkanal-Versorgung', source: US_15236 },
      { fromMHz: 174, toMHz: 216, maxPower: '50 mW EIRP', use: 'general', note: '§ 15.236; nur zugewiesene TV-Kanäle, ≥ 4 km außerhalb der Gleichkanal-Versorgung', source: US_15236 },
      { fromMHz: 470, toMHz: 608, maxPower: '50 mW EIRP', use: 'general', note: '§ 15.236; nur zugewiesene TV-Kanäle, ≥ 4 km außerhalb der Gleichkanal-Versorgung; max. 200 kHz', source: US_15236 },
      { fromMHz: 614, toMHz: 616, maxPower: '20 mW EIRP', use: 'general', note: '§ 15.236; 600-MHz-Schutzband', source: US_15236 },
      { fromMHz: 657, toMHz: 663, maxPower: '20 mW EIRP', use: 'general', note: '§ 15.236; 600-MHz-Duplexlücke', source: US_15236 },
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
