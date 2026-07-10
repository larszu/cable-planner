// ───────────────────────────────────────────────────────────────────────────
// Wireless-Rig — Ableitungen: Kompatibilitäts-Check + RF-Konflikte + Summary.
//
// Liest die echten Fachdaten aus dem Wireless-Katalog (Fassung/Steckverbinder)
// und meldet inkompatible Body↔Mic-Zuordnungen ehrlich — kein Raten. Frequenz-
// Konflikte über rfCoordination.
// ───────────────────────────────────────────────────────────────────────────
import type { WirelessRigPlan, WirelessChannel } from '../types/wirelessRig'
import { wirelessById } from './wirelessCatalog'
import { isCapsuleCompatible, isBodypackMicCompatible } from './wirelessCompat'
import { computeRfConflicts, DEFAULT_RF_OPTIONS, type RfConflict, type RfCoordinationOptions } from './rfCoordination'

/** Kompatibilitäts-Status einer Body↔Mic-Zuordnung. */
export type ChannelCompat = 'ok' | 'incompatible' | 'unknown' | 'empty'

export interface ChannelDerivation {
  channel: WirelessChannel
  bodyName: string
  micName: string
  compat: ChannelCompat
}

export interface RigDerivation {
  rows: ChannelDerivation[]
  channelCount: number
  /** Kanäle mit inkompatibler Body↔Mic-Kombination. */
  incompatibleCount: number
  /** Kanäle ohne (auflösbaren) Body oder Mic. */
  unknownCount: number
  /** Kanäle mit belegter Frequenz. */
  frequencyCount: number
  rfConflicts: RfConflict[]
}

/** Prüft eine einzelne Body↔Mic-Zuordnung. */
export const channelCompat = (channel: WirelessChannel): ChannelCompat => {
  const body = channel.bodyDeviceTypeId ? wirelessById(channel.bodyDeviceTypeId) : undefined
  const mic = channel.micDeviceTypeId ? wirelessById(channel.micDeviceTypeId) : undefined
  if (!body || !mic) return 'empty'
  // Body kann Hand- oder Taschensender sein; passenden Check wählen.
  if (body.role === 'handheldBody') return isCapsuleCompatible(body, mic) ? 'ok' : 'incompatible'
  if (body.role === 'bodypackBody') return isBodypackMicCompatible(body, mic) ? 'ok' : 'incompatible'
  return 'unknown'
}

/**
 * Leitet den Gesamtstatus des Rigs ab: Zuordnungs-Kompatibilität je Kanal +
 * RF-Konflikte über alle belegten Frequenzen.
 */
export const deriveRig = (
  plan: WirelessRigPlan,
  rfOptions: RfCoordinationOptions = DEFAULT_RF_OPTIONS,
): RigDerivation => {
  const rows: ChannelDerivation[] = []
  let incompatibleCount = 0
  let unknownCount = 0
  let frequencyCount = 0

  for (const channel of plan.channels) {
    const body = channel.bodyDeviceTypeId ? wirelessById(channel.bodyDeviceTypeId) : undefined
    const mic = channel.micDeviceTypeId ? wirelessById(channel.micDeviceTypeId) : undefined
    const compat = channelCompat(channel)
    if (compat === 'incompatible') incompatibleCount += 1
    if (compat === 'empty' || compat === 'unknown') unknownCount += 1
    if (typeof channel.frequencyMhz === 'number' && channel.frequencyMhz > 0) frequencyCount += 1
    rows.push({
      channel,
      bodyName: body?.name ?? '—',
      micName: mic?.name ?? '—',
      compat,
    })
  }

  const rfConflicts = computeRfConflicts(
    plan.channels
      .filter((c) => typeof c.frequencyMhz === 'number' && c.frequencyMhz! > 0)
      .map((c) => ({ id: c.id, label: c.label || 'Kanal', mhz: c.frequencyMhz! })),
    rfOptions,
  )

  return {
    rows,
    channelCount: plan.channels.length,
    incompatibleCount,
    unknownCount,
    frequencyCount,
    rfConflicts,
  }
}

/** Frischer, leerer Rig-Plan. */
export const emptyWirelessRig = (): WirelessRigPlan => ({ channels: [] })
