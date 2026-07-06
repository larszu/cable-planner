import type { EquipmentItem } from '../types/equipment'
import { portDisplayLabel } from './portLabel'

/**
 * #389 — Parse a Videohub Labels.txt file (the format Blackmagic's
 * Videohub Setup uses) back into `{inputs, outputs}` label arrays.
 *
 * Tolerant parser — accepts:
 *   "Input, 1, 1 Cam 1"
 *   "Input 1: Cam 1"
 *   "INPUT 1 Cam 1"
 * Strips a leading numeric prefix that matches the index (the
 * exporter writes "1 Cam 1" for slot 1 — the user shouldn't see
 * the double "1 1 Cam 1" after re-import).
 *
 * Returns sparse arrays — entries can be `undefined` when a slot
 * is missing from the file, so the caller can preserve the
 * existing port name for those slots.
 */
export interface ParsedVideohubLabels {
  inputs: (string | undefined)[]
  outputs: (string | undefined)[]
  warnings: string[]
}

export const parseVideohubLabelsTxt = (text: string): ParsedVideohubLabels => {
  const inputs: (string | undefined)[] = []
  const outputs: (string | undefined)[] = []
  const warnings: string[] = []
  const lineRegex = /^\s*(input|output)\s*[,\s:]\s*(\d+)\s*[,\s:]?\s*(.*?)\s*$/i
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim()
    if (!line || line.startsWith('#')) continue
    const m = lineRegex.exec(line)
    if (!m) {
      warnings.push(`Unrecognised: "${line.slice(0, 60)}"`)
      continue
    }
    const direction = m[1].toLowerCase() === 'input' ? 'inputs' : 'outputs'
    const idx = parseInt(m[2], 10)
    if (!Number.isFinite(idx) || idx < 1) continue
    let label = m[3] ?? ''
    // Strip leading "N " prefix when N matches the slot index (exporter
    // emits "1 Cam 1" — we don't want "1 1 Cam 1" on re-import).
    const prefixMatch = /^(\d+)\s+(.+)$/.exec(label)
    if (prefixMatch && parseInt(prefixMatch[1], 10) === idx) {
      label = prefixMatch[2]
    }
    const target = direction === 'inputs' ? inputs : outputs
    target[idx - 1] = label || undefined
  }
  return { inputs, outputs, warnings }
}

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
    // #286 — contentLabel ("PGM", "Cam1") gewinnt gegen port.name wenn gesetzt.
    const display = port ? portDisplayLabel(port) : ''
    const label = display ? `${i + 1} ${display}`.trim() : `${i + 1}`
    lines.push(`Input, ${i + 1}, ${label}`)
  }
  for (let i = 0; i < totalOut; i++) {
    const port = device.outputs[i]
    const display = port ? portDisplayLabel(port) : ''
    const label = display ? `${i + 1} ${display}`.trim() : `${i + 1}`
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
    // #286 — bevorzugt contentLabel (PGM/PVW) vor port.name.
    const display = port ? portDisplayLabel(port) : ''
    const label = display ? `${i + 1} ${display}`.trim() : `${i + 1}`
    out.push(`${i} ${label}`)
  }
  out.push('')
  out.push('OUTPUT LABELS:')
  for (let i = 0; i < totalOut; i++) {
    const port = device.outputs[i]
    const display = port ? portDisplayLabel(port) : ''
    const label = display ? `${i + 1} ${display}`.trim() : `${i + 1}`
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
 * Build just the VIDEO OUTPUT ROUTING command block to send to a real Videohub
 * via TCP. The hub expects this exact format — one block terminated by \n\n.
 *
 * Example output:
 *   VIDEO OUTPUT ROUTING:\n
 *   0 3\n
 *   1 0\n
 *   \n
 */
export const buildVideohubRoutingCommand = (
  routing: Record<number, number>,
  totalOutputs: number,
): string => {
  const lines = ['VIDEO OUTPUT ROUTING:']
  for (let i = 0; i < totalOutputs; i++) {
    lines.push(`${i} ${routing[i] ?? 0}`)
  }
  lines.push('')
  return lines.join('\n') + '\n'
}

/**
 * v7.9.128 — Build the INPUT LABELS / OUTPUT LABELS command blocks to
 * push to a Videohub via TCP. Pattern wie bei VIDEO OUTPUT ROUTING:
 * Header-Zeile, Datenzeilen, Leerzeile am Ende. Beide Blocks koennen
 * in einem einzigen Send konkateniert werden.
 *
 *   INPUT LABELS:\n
 *   0 SDI In 1\n
 *   1 Cam Stage\n
 *   \n
 *
 * Labels werden default-gefuellt mit "Input N" / "Output N" wenn der
 * Aufrufer fuer einen Slot keinen eigenen Eintrag liefert.
 */
export const buildVideohubInputLabelsCommand = (
  labels: string[],
  totalInputs: number,
): string => {
  const lines = ['INPUT LABELS:']
  for (let i = 0; i < totalInputs; i++) {
    const lbl = (labels[i] ?? '').trim() || `Input ${i + 1}`
    lines.push(`${i} ${lbl}`)
  }
  lines.push('')
  return lines.join('\n') + '\n'
}

export const buildVideohubOutputLabelsCommand = (
  labels: string[],
  totalOutputs: number,
): string => {
  const lines = ['OUTPUT LABELS:']
  for (let i = 0; i < totalOutputs; i++) {
    const lbl = (labels[i] ?? '').trim() || `Output ${i + 1}`
    lines.push(`${i} ${lbl}`)
  }
  lines.push('')
  return lines.join('\n') + '\n'
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
  { key: 'micro-16x16', model: 'Blackmagic Micro Videohub 16x16', inputs: 16, outputs: 16 },
  { key: 'smart-12x12', model: 'Blackmagic Smart Videohub 12x12', inputs: 12, outputs: 12 },
  { key: 'smart-12g-12x12', model: 'Blackmagic Smart Videohub 12G 12x12', inputs: 12, outputs: 12 },
  { key: 'smart-20x20', model: 'Blackmagic Smart Videohub 20x20', inputs: 20, outputs: 20 },
  { key: 'compact-40x40', model: 'Blackmagic Compact Videohub 40x40', inputs: 40, outputs: 40 },
  { key: 'smart-40x40', model: 'Blackmagic Smart Videohub 40x40', inputs: 40, outputs: 40 },
  { key: 'smart-40x40-12g', model: 'Blackmagic Smart Videohub 40x40 12G', inputs: 40, outputs: 40 },
  { key: 'cleanswitch-12x12', model: 'Blackmagic CleanSwitch 12x12', inputs: 12, outputs: 12 },
  { key: 'universal-72x72', model: 'Blackmagic Videohub 72x72', inputs: 72, outputs: 72 },
  { key: 'universal-master-80x80', model: 'Blackmagic Universal Videohub 80', inputs: 80, outputs: 80 },
  { key: 'universal-master-120x120', model: 'Blackmagic Universal Videohub 120', inputs: 120, outputs: 120 },
  { key: 'universal-master-160x160', model: 'Blackmagic Universal Videohub 160', inputs: 160, outputs: 160 },
  { key: 'universal-master-288x288', model: 'Blackmagic Universal Videohub 288', inputs: 288, outputs: 288 },
  // #387 — Custom: User legt Inputs/Outputs selber fest. Wird im Dialog ueber
  // zwei zusaetzliche Zahlen-Inputs (sichtbar wenn presetKey==='custom')
  // eingegeben. Defaults sind 16/16 — der User kann beliebig erhoehen.
  { key: 'custom', model: 'Custom (eigene Größe)', inputs: 16, outputs: 16 },
]
