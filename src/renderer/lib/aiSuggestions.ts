import { ALL_CONNECTOR_TYPES } from '../types/equipment'
import type { ConnectorType } from '../types/equipment'
import { ALL_SIGNAL_STANDARDS } from '../types/cableSpec'
import type { SignalStandard } from '../types/cableSpec'
import type { PortGroupHint } from './portSuggestions'

const API_KEY_STORAGE = 'cable-planner:geminiApiKey'

export const getGeminiApiKey = (): string => {
  try {
    return localStorage.getItem(API_KEY_STORAGE) ?? ''
  } catch {
    return ''
  }
}

export const setGeminiApiKey = (key: string): void => {
  try {
    if (key) localStorage.setItem(API_KEY_STORAGE, key)
    else localStorage.removeItem(API_KEY_STORAGE)
  } catch {
    /* ignore */
  }
}

const CONNECTOR_VALUES = ALL_CONNECTOR_TYPES
const STANDARD_VALUES = ALL_SIGNAL_STANDARDS

interface RawSuggestion {
  direction?: string
  type?: string
  label?: string
  count?: number
  connector?: string
  standard?: string
}

const PROMPT_TEMPLATE = (deviceName: string, category: string) => `You are helping populate a cable-planning tool.
For the device below, list the physical connectors typically found on it based on common datasheets.
Return STRICT JSON only (no prose, no markdown, no code fences).

Device name: ${deviceName}
Category: ${category}

JSON schema:
{
  "ports": [
    { "direction": "in" | "out", "label": "short label", "count": <int>, "connector": <one of: ${CONNECTOR_VALUES.join(', ')}>, "standard": <optional, one of: ${STANDARD_VALUES.join(', ')}> }
  ]
}

Rules:
- "in" for signal inputs/returns, "out" for signal outputs/sends. Power inputs use direction "in".
- Group identical ports (e.g. 4x BNC SDI inputs) into ONE entry with count=4.
- Include power connectors (Schuko 230V / PowerCON / IEC 230V) and network ports (Ethernet/RJ45) when typical.
- Do NOT include internal buses or non-user-facing connectors.
- If unknown or generic item, return { "ports": [] }.`

export const suggestFromAI = async (
  deviceName: string,
  category: string,
): Promise<PortGroupHint[]> => {
  const key = getGeminiApiKey()
  if (!key) {
    throw new Error('No Gemini API key configured. Click "AI settings" to set one.')
  }
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${encodeURIComponent(key)}`
  const body = {
    contents: [{ role: 'user', parts: [{ text: PROMPT_TEMPLATE(deviceName, category) }] }],
    generationConfig: {
      responseMimeType: 'application/json',
      temperature: 0.2,
    },
  }
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`Gemini API ${res.status}: ${text.slice(0, 200)}`)
  }
  const json = (await res.json()) as {
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>
  }
  const text = json.candidates?.[0]?.content?.parts?.[0]?.text ?? ''
  let parsed: { ports?: RawSuggestion[] }
  try {
    parsed = JSON.parse(text) as { ports?: RawSuggestion[] }
  } catch {
    throw new Error('Gemini returned invalid JSON')
  }
  const ports = Array.isArray(parsed.ports) ? parsed.ports : []
  return ports.map((p): PortGroupHint => {
    const dirRaw = (p.direction ?? p.type ?? '').toString().toLowerCase()
    const direction: 'in' | 'out' = dirRaw.startsWith('out') ? 'out' : 'in'
    const connector: ConnectorType = CONNECTOR_VALUES.includes(p.connector as ConnectorType)
      ? (p.connector as ConnectorType)
      : 'Custom'
    const count = Math.max(1, Math.min(64, Math.round(Number(p.count) || 1)))
    const label = (p.label ?? '').toString().slice(0, 40) || (direction === 'in' ? 'Input' : 'Output')
    return {
      direction,
      count,
      connectorType: connector,
      label,
    }
  })
}
