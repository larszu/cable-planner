/**
 * Mains-/Netz-Standards für die Strom-Planung. Der Cable Planner deckt mehr
 * als Video ab — Strompläne brauchen je nach Region eine andere Netzspannung
 * (230 V EU, 120 V Nordamerika, 100 V Japan …). Der projektweite Standard
 * steuert die Spannung, mit der der Stromrechner Watt ↔ Ampere umrechnet.
 *
 * `voltage` = Außenleiter→Neutral (einphasig genutzt für P = U·I bzw. die
 * Last je Phase bei Drehstrom P = 3·U_LN·I). `lineVoltage` = Außenleiter→
 * Außenleiter (nur informativ für Drehstrom, z. B. 400 V / 208 V).
 */
export type PowerStandardId =
  | 'eu-230-1ph'
  | 'eu-400-3ph'
  | 'uk-230-1ph'
  | 'na-120-1ph'
  | 'na-208-3ph'
  | 'na-240-split'
  | 'jp-100-1ph'
  | 'au-230-1ph'

/** Steckverbinder-Region — steuert den Anschluss-Katalog im Stromrechner. */
export type PowerRegion = 'eu' | 'uk' | 'na' | 'jp' | 'au'

export interface PowerStandard {
  id: PowerStandardId
  /** Anzeigename (Region + Spannung/Frequenz). */
  label: string
  /** Nennspannung Außenleiter→Neutral in Volt (Basis der Watt↔Ampere-Rechnung). */
  voltage: number
  /** Netzfrequenz in Hz. */
  frequency: number
  /** 1 = einphasig, 3 = Drehstrom. */
  phases: 1 | 3
  /** Außenleiter→Außenleiter (nur Drehstrom/Split-Phase), informativ. */
  lineVoltage?: number
  /** Steckverbinder-Region für den passenden Anschluss-Katalog. */
  region: PowerRegion
}

export const POWER_STANDARDS: PowerStandard[] = [
  { id: 'eu-230-1ph', label: 'Europe / IEC — 230 V AC, 50 Hz (1-phase)', voltage: 230, frequency: 50, phases: 1, region: 'eu' },
  { id: 'eu-400-3ph', label: 'Europe — 400 V, 50 Hz (3-phase, 230 V L-N)', voltage: 230, lineVoltage: 400, frequency: 50, phases: 3, region: 'eu' },
  { id: 'uk-230-1ph', label: 'UK — 230 V AC, 50 Hz (BS 1363)', voltage: 230, frequency: 50, phases: 1, region: 'uk' },
  { id: 'na-120-1ph', label: 'North America — 120 V AC, 60 Hz (1-phase)', voltage: 120, frequency: 60, phases: 1, region: 'na' },
  { id: 'na-208-3ph', label: 'North America — 208 V, 60 Hz (3-phase, 120 V L-N)', voltage: 120, lineVoltage: 208, frequency: 60, phases: 3, region: 'na' },
  { id: 'na-240-split', label: 'North America — 240 V split-phase, 60 Hz (120 V L-N)', voltage: 120, lineVoltage: 240, frequency: 60, phases: 1, region: 'na' },
  { id: 'jp-100-1ph', label: 'Japan — 100 V AC, 50/60 Hz (1-phase)', voltage: 100, frequency: 50, phases: 1, region: 'jp' },
  { id: 'au-230-1ph', label: 'Australia / NZ — 230 V AC, 50 Hz (1-phase)', voltage: 230, frequency: 50, phases: 1, region: 'au' },
]

/** Netzanschluss-Preset (Steckverbinder) je Region. `voltage` wird zur
 *  Laufzeit aus dem Projekt-Standard überschrieben (Watt↔Ampere). */
export interface PowerSupplyPreset {
  id: string
  label: string
  phases: 1 | 3
  /** Nennstrom je Außenleiter (A). */
  perPhaseAmps: number
}

/**
 * Regionale Anschluss-Kataloge für die Stromplanung. EU/Event-Touring
 * (Schuko/CEE/Powerlock), UK (BS 1363 + CEEform), Nordamerika (Edison/
 * NEMA Twist-Lock/Cam-Lok), Japan (JIS), Australien (AS/NZS).
 */
export const POWER_SUPPLY_PRESETS: Record<PowerRegion, PowerSupplyPreset[]> = {
  eu: [
    { id: 'schuko', label: 'Schuko / 1-phase (16 A)', phases: 1, perPhaseAmps: 16 },
    { id: 'cee16', label: 'CEE 16 A (3-phase, red)', phases: 3, perPhaseAmps: 16 },
    { id: 'cee32', label: 'CEE 32 A (3-phase, red)', phases: 3, perPhaseAmps: 32 },
    { id: 'cee63', label: 'CEE 63 A (3-phase, red)', phases: 3, perPhaseAmps: 63 },
    { id: 'cee125', label: 'CEE 125 A (3-phase)', phases: 3, perPhaseAmps: 125 },
    { id: 'powerlock-200', label: 'Powerlock 200 A (3-phase)', phases: 3, perPhaseAmps: 200 },
    { id: 'powerlock-400', label: 'Powerlock 400 A (3-phase)', phases: 3, perPhaseAmps: 400 },
    { id: 'powerlock-660', label: 'Powerlock 660 A (3-phase)', phases: 3, perPhaseAmps: 660 },
  ],
  uk: [
    { id: 'bs1363', label: 'BS 1363 plug / 1-phase (13 A)', phases: 1, perPhaseAmps: 13 },
    { id: 'ceeform-16', label: 'CEEform 16 A (1-phase, blue)', phases: 1, perPhaseAmps: 16 },
    { id: 'ceeform-32', label: 'CEEform 32 A (1-phase, blue)', phases: 1, perPhaseAmps: 32 },
    { id: 'cee63-3', label: 'CEE 63 A (3-phase, red)', phases: 3, perPhaseAmps: 63 },
    { id: 'cee125-3', label: 'CEE 125 A (3-phase, red)', phases: 3, perPhaseAmps: 125 },
    { id: 'powerlock-400', label: 'Powerlock 400 A (3-phase)', phases: 3, perPhaseAmps: 400 },
  ],
  na: [
    { id: 'edison-15', label: 'Edison 5-15 / 1-phase (15 A)', phases: 1, perPhaseAmps: 15 },
    { id: 'edison-20', label: 'Edison 5-20 / 1-phase (20 A)', phases: 1, perPhaseAmps: 20 },
    { id: 'l5-30', label: 'NEMA L5-30 twist-lock (30 A)', phases: 1, perPhaseAmps: 30 },
    { id: 'l6-20', label: 'NEMA L6-20 (240 V, 20 A)', phases: 1, perPhaseAmps: 20 },
    { id: 'l21-30', label: 'NEMA L21-30 (3-phase, 30 A)', phases: 3, perPhaseAmps: 30 },
    { id: 'cs6369', label: 'CS6369 Bates / 1-phase (50 A)', phases: 1, perPhaseAmps: 50 },
    { id: 'camlock-400', label: 'Cam-Lok 400 A (3-phase)', phases: 3, perPhaseAmps: 400 },
    { id: 'camlock-600', label: 'Cam-Lok 600 A (3-phase)', phases: 3, perPhaseAmps: 600 },
  ],
  jp: [
    { id: 'jis-15', label: 'JIS C 8303 / 1-phase (15 A)', phases: 1, perPhaseAmps: 15 },
    { id: 'jis-20', label: 'JIS 20 A / 1-phase', phases: 1, perPhaseAmps: 20 },
    { id: 'l6-30', label: 'NEMA L6-30 (200 V, 30 A)', phases: 1, perPhaseAmps: 30 },
    { id: 'camlock-400', label: 'Cam-Lok 400 A (3-phase)', phases: 3, perPhaseAmps: 400 },
  ],
  au: [
    { id: 'as3112', label: 'AS/NZS 3112 / 1-phase (10 A)', phases: 1, perPhaseAmps: 10 },
    { id: 'as3123-15', label: 'AS/NZS 3123 15 A / 1-phase', phases: 1, perPhaseAmps: 15 },
    { id: 'cee32', label: 'CEE 32 A (3-phase, red)', phases: 3, perPhaseAmps: 32 },
    { id: 'cee63', label: 'CEE 63 A (3-phase, red)', phases: 3, perPhaseAmps: 63 },
    { id: 'powerlock-400', label: 'Powerlock 400 A (3-phase)', phases: 3, perPhaseAmps: 400 },
  ],
}

export const DEFAULT_POWER_STANDARD: PowerStandardId = 'eu-230-1ph'

export const powerStandardById = (id: PowerStandardId | undefined): PowerStandard | undefined =>
  POWER_STANDARDS.find((s) => s.id === id)
