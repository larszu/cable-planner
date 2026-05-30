// #414 — KI-Plan-Generierung aus Text-Prompt (erste Ausbaustufe).
//
// Nimmt eine Klartext-Beschreibung ("2 Kameras über SDI in einen Switcher,
// PGM-Out auf einen Recorder") und lässt das ausgewählte AI-Modell daraus
// Geräte + Verbindungen vorschlagen. Das Ergebnis wird NICHT direkt in den
// Store geschrieben — der Caller (Dialog) zeigt es zur Review und fügt es
// erst nach Bestätigung ein.
//
// Bewusst klein gehalten: ein flaches { devices, connections }-Schema,
// gemappt auf EquipmentItem + Cable. Reicher werdende Felder (Standards,
// Power, Racks) sind eine spätere Ausbaustufe von #414.

import { v4 as uuid } from 'uuid'
import { completeWithAI } from './aiSuggestions'
import { ALL_CONNECTOR_TYPES } from '../types/equipment'
import type { EquipmentItem, Port, ConnectorType } from '../types/equipment'
import type { Cable, CableType } from '../types/cable'

interface RawDevice {
  name?: unknown
  category?: unknown
  inputs?: unknown
  outputs?: unknown
}
interface RawConnection {
  from?: unknown
  fromPort?: unknown
  to?: unknown
  toPort?: unknown
  connector?: unknown
}

export interface GeneratedPlan {
  equipment: EquipmentItem[]
  cables: Cable[]
  /** Klartext-Warnungen (z.B. Verbindung auf unbekanntes Gerät verworfen). */
  warnings: string[]
}

const PROMPT = (description: string): string => `You are an AV systems engineer. Convert the
following plain-language system description into a JSON object describing the devices and
their cable connections. Respond with ONLY valid JSON, no prose, in exactly this shape:

{
  "devices": [
    { "name": "Camera 1", "category": "Kameras", "inputs": ["Power"], "outputs": ["SDI Out"] }
  ],
  "connections": [
    { "from": "Camera 1", "fromPort": "SDI Out", "to": "Switcher", "toPort": "SDI In 1", "connector": "BNC" }
  ]
}

Rules:
- Use connector values from this list only: ${ALL_CONNECTOR_TYPES.join(', ')}.
- Port names in "connections" should match port names you listed on the devices.
- Keep it minimal and correct; do not invent devices not implied by the description.
- Categories should be short German nouns (Kameras, Video, Audio, Netzwerk, Monitore, Strom, Sonstiges).

Description:
${description}`

/** Extrahiert das erste JSON-Objekt aus einer Modell-Antwort. */
const extractJson = (text: string): unknown => {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i)
  const body = fenced ? fenced[1] : text
  const start = body.indexOf('{')
  const end = body.lastIndexOf('}')
  if (start === -1 || end === -1 || end < start) {
    throw new Error('Keine JSON-Antwort vom Modell erhalten.')
  }
  return JSON.parse(body.slice(start, end + 1))
}

const asStringArray = (v: unknown): string[] =>
  Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string' && x.trim().length > 0) : []

const coerceConnector = (v: unknown): ConnectorType => {
  if (typeof v === 'string') {
    const hit = ALL_CONNECTOR_TYPES.find((c) => c.toLowerCase() === v.toLowerCase())
    if (hit) return hit
  }
  return 'Custom'
}

const makePort = (name: string, connector: ConnectorType): Port => ({
  id: uuid(),
  name,
  type: connector,
  connectorType: connector,
})

/**
 * Baut aus der Beschreibung einen reviewbaren Plan. Geräte werden in einem
 * einfachen Raster platziert; Verbindungen auf vorhandene Ports gemappt (oder
 * — wenn ein Port-Name nicht existiert — am passenden Gerät neu angelegt).
 */
export const generatePlanFromPrompt = async (description: string): Promise<GeneratedPlan> => {
  const text = await completeWithAI(PROMPT(description))
  const parsed = extractJson(text) as { devices?: unknown; connections?: unknown }
  const rawDevices = Array.isArray(parsed.devices) ? (parsed.devices as RawDevice[]) : []
  const rawConns = Array.isArray(parsed.connections) ? (parsed.connections as RawConnection[]) : []
  const warnings: string[] = []

  // Geräte im Raster anlegen (4 Spalten).
  const COL_W = 300
  const ROW_H = 180
  const COLS = 4
  const equipment: EquipmentItem[] = []
  const byName = new Map<string, EquipmentItem>()
  rawDevices.forEach((d, i) => {
    const name = typeof d.name === 'string' && d.name.trim() ? d.name.trim() : `Gerät ${i + 1}`
    const category = typeof d.category === 'string' && d.category.trim() ? d.category.trim() : 'Sonstiges'
    const inputs = asStringArray(d.inputs).map((n) => makePort(n, 'Custom'))
    const outputs = asStringArray(d.outputs).map((n) => makePort(n, 'Custom'))
    const item: EquipmentItem = {
      id: uuid(),
      name,
      category,
      inputs,
      outputs,
      x: (i % COLS) * COL_W + 80,
      y: Math.floor(i / COLS) * ROW_H + 80,
      width: 220,
      height: 60,
    }
    equipment.push(item)
    // Erstes Vorkommen eines Namens gewinnt.
    if (!byName.has(name)) byName.set(name, item)
  })

  // Verbindungen mappen.
  const cables: Cable[] = []
  const findOrAddPort = (
    item: EquipmentItem,
    portName: string,
    side: 'inputs' | 'outputs',
    connector: ConnectorType,
  ): Port => {
    const existing = [...item.inputs, ...item.outputs].find(
      (p) => p.name.toLowerCase() === portName.toLowerCase(),
    )
    if (existing) return existing
    const port = makePort(portName, connector)
    item[side].push(port)
    return port
  }

  for (const c of rawConns) {
    const fromName = typeof c.from === 'string' ? c.from.trim() : ''
    const toName = typeof c.to === 'string' ? c.to.trim() : ''
    const fromEq = byName.get(fromName)
    const toEq = byName.get(toName)
    if (!fromEq || !toEq) {
      warnings.push(`Verbindung ${fromName || '?'} → ${toName || '?'} übersprungen (Gerät unbekannt).`)
      continue
    }
    const connector = coerceConnector(c.connector)
    const fromPort = findOrAddPort(
      fromEq,
      typeof c.fromPort === 'string' && c.fromPort.trim() ? c.fromPort.trim() : 'Out',
      'outputs',
      connector,
    )
    const toPort = findOrAddPort(
      toEq,
      typeof c.toPort === 'string' && c.toPort.trim() ? c.toPort.trim() : 'In',
      'inputs',
      connector,
    )
    // CableType schließt DIN/DisplayPort/USB aus → auf 'Custom' abbilden.
    const cableType: CableType =
      connector === 'DIN' || connector === 'DisplayPort' || connector === 'USB'
        ? 'Custom'
        : connector
    cables.push({
      id: uuid(),
      name: `${fromEq.name} → ${toEq.name}`,
      type: cableType,
      length: 0,
      color: '#64748b',
      fromEquipmentId: fromEq.id,
      fromPortId: fromPort.id,
      toEquipmentId: toEq.id,
      toPortId: toPort.id,
      notes: '',
    })
  }

  return { equipment, cables, warnings }
}
