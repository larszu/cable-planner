import type { EquipmentItem } from '../types/equipment'

/**
 * Build the simple Videohub label-import .txt used by older tooling:
 *   Input, 1, 1 Cam 1
 *   Input, 2, 2 Cam 2
 *   ...
 *   Output, 1, 1 IMAG
 *
 * Port labels fall back to their port name. Empty/unused slots are still
 * emitted with just the channel number so the file has `totalInputs`/
 * `totalOutputs` rows (Videohub Control expects sequential numbering).
 */
export const buildVideohubLabelTxt = (
  device: Pick<EquipmentItem, 'inputs' | 'outputs'>,
  opts: { totalInputs?: number; totalOutputs?: number } = {},
): string => {
  const totalIn = opts.totalInputs ?? device.inputs.length
  const totalOut = opts.totalOutputs ?? device.outputs.length
  const lines: string[] = []
  for (let i = 0; i < totalIn; i++) {
    const port = device.inputs[i]
    const label = port?.name ? `${i + 1} ${port.name}`.trim() : `${i + 1}`
    lines.push(`Input, ${i + 1}, ${label}`)
  }
  for (let i = 0; i < totalOut; i++) {
    const port = device.outputs[i]
    const label = port?.name ? `${i + 1} ${port.name}`.trim() : `${i + 1}`
    lines.push(`Output, ${i + 1}, ${label}`)
  }
  return lines.join('\r\n') + '\r\n'
}

/**
 * Build a full Videohub protocol dump matching Blackmagic's telnet protocol 2.5.
 * This format is accepted by most Videohub control software via "Import routing".
 * Consists of sections: PROTOCOL PREAMBLE, VIDEOHUB DEVICE, INPUT LABELS,
 * OUTPUT LABELS, VIDEO OUTPUT LOCKS, VIDEO OUTPUT ROUTING.
 *
 * All outputs default to input 0 (slot 1) because the canvas has no routing
 * data yet; the user adjusts routes inside the hub after import.
 */
export const buildVideohubRoutingDump = (
  device: Pick<EquipmentItem, 'name' | 'inputs' | 'outputs'>,
  opts: {
    modelName?: string
    friendlyName?: string
    uniqueId?: string
    totalInputs?: number
    totalOutputs?: number
    /** output-index → input-index mapping; missing entries default to 0 */
    routing?: Record<number, number>
  } = {},
): string => {
  const totalIn = opts.totalInputs ?? device.inputs.length
  const totalOut = opts.totalOutputs ?? device.outputs.length
  const model = opts.modelName ?? 'Blackmagic Videohub'
  const friendly = opts.friendlyName ?? device.name ?? 'Videohub'
  const uid =
    opts.uniqueId ??
    // Pseudo-stable id derived from name (12 hex chars)
    Array.from(friendly)
      .reduce((h, c) => (h * 33 + c.charCodeAt(0)) >>> 0, 5381)
      .toString(16)
      .padStart(12, '0')
      .slice(-12)

  const out: string[] = []
  out.push('PROTOCOL PREAMBLE:')
  out.push('Version: 2.5')
  out.push('')
  out.push('VIDEOHUB DEVICE:')
  out.push('Device present: true')
  out.push(`Model name: ${model}`)
  out.push(`Friendly name: ${friendly}`)
  out.push(`Unique ID: ${uid}`)
  out.push(`Video inputs: ${totalIn}`)
  out.push('Video processing units: 0')
  out.push(`Video outputs: ${totalOut}`)
  out.push('Video monitoring outputs: 0')
  out.push('Serial ports: 0')
  out.push('')
  out.push('INPUT LABELS:')
  for (let i = 0; i < totalIn; i++) {
    const port = device.inputs[i]
    const label = port?.name ? `${i + 1} ${port.name}`.trim() : `${i + 1}`
    out.push(`${i} ${label}`)
  }
  out.push('')
  out.push('OUTPUT LABELS:')
  for (let i = 0; i < totalOut; i++) {
    const port = device.outputs[i]
    const label = port?.name ? `${i + 1} ${port.name}`.trim() : `${i + 1}`
    out.push(`${i} ${label}`)
  }
  out.push('')
  out.push('VIDEO OUTPUT LOCKS:')
  for (let i = 0; i < totalOut; i++) out.push(`${i} U`)
  out.push('')
  out.push('VIDEO OUTPUT ROUTING:')
  for (let i = 0; i < totalOut; i++) out.push(`${i} ${opts.routing?.[i] ?? 0}`)
  out.push('')
  return out.join('\r\n')
}

/**
 * Known Videohub model presets. Used by the export dialog to pre-fill the
 * model name field — user can still override.
 */
export const videohubPresets: {
  key: string
  model: string
  inputs: number
  outputs: number
}[] = [
  { key: 'compact-40x40', model: 'Blackmagic Compact Videohub', inputs: 40, outputs: 40 },
  { key: 'smart-40x40-12g', model: 'Blackmagic Smart Videohub 40x40 12G', inputs: 40, outputs: 40 },
  { key: 'smart-20x20', model: 'Blackmagic Smart Videohub 20x20', inputs: 20, outputs: 20 },
  { key: 'smart-12x12', model: 'Blackmagic Smart Videohub 12x12', inputs: 12, outputs: 12 },
  { key: 'universal-72x72', model: 'Blackmagic Videohub 72x72', inputs: 72, outputs: 72 },
  { key: 'universal-288x288', model: 'Blackmagic Universal Videohub 288', inputs: 288, outputs: 288 },
]
