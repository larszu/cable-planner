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
}

export const POWER_STANDARDS: PowerStandard[] = [
  { id: 'eu-230-1ph', label: 'Europe / IEC — 230 V AC, 50 Hz (1-phase)', voltage: 230, frequency: 50, phases: 1 },
  { id: 'eu-400-3ph', label: 'Europe — 400 V, 50 Hz (3-phase, 230 V L-N)', voltage: 230, lineVoltage: 400, frequency: 50, phases: 3 },
  { id: 'uk-230-1ph', label: 'UK — 230 V AC, 50 Hz (BS 1363)', voltage: 230, frequency: 50, phases: 1 },
  { id: 'na-120-1ph', label: 'North America — 120 V AC, 60 Hz (1-phase)', voltage: 120, frequency: 60, phases: 1 },
  { id: 'na-208-3ph', label: 'North America — 208 V, 60 Hz (3-phase, 120 V L-N)', voltage: 120, lineVoltage: 208, frequency: 60, phases: 3 },
  { id: 'na-240-split', label: 'North America — 240 V split-phase, 60 Hz (120 V L-N)', voltage: 120, lineVoltage: 240, frequency: 60, phases: 1 },
  { id: 'jp-100-1ph', label: 'Japan — 100 V AC, 50/60 Hz (1-phase)', voltage: 100, frequency: 50, phases: 1 },
  { id: 'au-230-1ph', label: 'Australia / NZ — 230 V AC, 50 Hz (1-phase)', voltage: 230, frequency: 50, phases: 1 },
]

export const DEFAULT_POWER_STANDARD: PowerStandardId = 'eu-230-1ph'

export const powerStandardById = (id: PowerStandardId | undefined): PowerStandard | undefined =>
  POWER_STANDARDS.find((s) => s.id === id)
