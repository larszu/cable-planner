// ───────────────────────────────────────────────────────────────────────────
// Die Port-Frage an ein Sprachmodell — Wortlaut und Auswertung.
//
// Eigene Datei (2026-11-05), damit `scripts/ki-bench` GENAU diese Frage
// stellt und GENAU diese Auswertung benutzt, ohne Store, Speicher und
// Anbieter-Schluessel mitzuladen. Eine Messung mit einer Kopie des Prompts
// misst die Kopie.
// ───────────────────────────────────────────────────────────────────────────
import { ALL_CONNECTOR_TYPES } from '../types/equipment'
import type { ConnectorType } from '../types/equipment'
import { ALL_SIGNAL_STANDARDS } from '../types/cableSpec'
import type { PortGroupHint } from './portSuggestions'

const CONNECTOR_VALUES = ALL_CONNECTOR_TYPES
const STANDARD_VALUES = ALL_SIGNAL_STANDARDS

// ─── Gemeinsamer Prompt ────────────────────────────────────────────────

/**
 * Der unveraenderliche Teil der Port-Frage: Auftrag, Schema, Vokabeln, Regeln.
 *
 * Getrennt vom Geraetenamen, weil er bei jedem Geraet Wort fuer Wort derselbe
 * ist — rund 1500 Token aus den beiden Vokabellisten. Als `system` darf
 * Claude ihn zwischenspeichern; beim zweiten Geraet derselben Sitzung kostet
 * er statt des vollen Eingabepreises ein Zehntel.
 */
export const PORT_ANLEITUNG = `You are helping populate a cable-planning tool.
For the device named by the user, list the physical connectors typically found on it based on
common datasheets.
Return STRICT JSON only (no prose, no markdown, no code fences).

JSON schema:
{
  "ports": [
    { "direction": "in" | "out", "label": "short label", "count": <int>, "connector": <one of: ${CONNECTOR_VALUES.join(', ')}>, "standard": <optional, one of: ${STANDARD_VALUES.join(', ')}> }
  ]
}

Rules:
- Describe THIS exact model, not the product family. Encoder/decoder, transmitter/receiver and
  variants with a suffix (C, D, E, -IOAV …) differ in their connectors — check which one is meant.
- If you can search the web, look up the manufacturer datasheet or product page first and list
  only what it documents.
- "in" for signal inputs/returns, "out" for signal outputs/sends. Power inputs use direction "in".
- Group identical ports (e.g. 4x BNC SDI inputs) into ONE entry with count=4.
- Power: list a mains connector only if the datasheet shows one on the unit. Devices powered via
  PoE or an external power pack have no mains connector — PoE goes into the Ethernet label.
- Leave out service-only ports (console/micro-USB for setup) and internal buses.
- Do not add connectors because they are "typical" for the category. Omit what you cannot confirm.
- If the model is unknown to you and cannot be found, return { "ports": [] }.
- Reply with the JSON object only.`

/** Der veraenderliche Teil — nur er wandert in die Nutzer-Nachricht. */
export const PORT_FRAGE = (deviceName: string, category: string) =>
  `Device name: ${deviceName}\nCategory: ${category}`

export interface RawSuggestion {
  direction?: string
  type?: string
  label?: string
  count?: number
  connector?: string
  standard?: string
}

export const parseJsonResponse = (text: string): RawSuggestion[] => {
  // Manche Provider rahmen JSON in ```json ... ``` ein trotz strict-JSON-
  // Prompt. Strip vor dem Parse.
  const stripped = text
    .trim()
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/, '')
  // Nach einer Websuche schreibt das Modell manchmal einen Satz vor das JSON.
  const start = stripped.indexOf('{')
  const end = stripped.lastIndexOf('}')
  const kern = start >= 0 && end > start ? stripped.slice(start, end + 1) : stripped
  let parsed: { ports?: RawSuggestion[] }
  try {
    parsed = JSON.parse(kern) as { ports?: RawSuggestion[] }
  } catch {
    throw new Error('AI provider returned invalid JSON')
  }
  return Array.isArray(parsed.ports) ? parsed.ports : []
}

export const normalizeHints = (ports: RawSuggestion[]): PortGroupHint[] =>
  ports.map((p): PortGroupHint => {
    const dirRaw = (p.direction ?? p.type ?? '').toString().toLowerCase()
    const direction: 'in' | 'out' = dirRaw.startsWith('out') ? 'out' : 'in'
    const connector: ConnectorType = CONNECTOR_VALUES.includes(p.connector as ConnectorType)
      ? (p.connector as ConnectorType)
      : 'Custom'
    const count = Math.max(1, Math.min(64, Math.round(Number(p.count) || 1)))
    const label = (p.label ?? '').toString().slice(0, 40) || (direction === 'in' ? 'Input' : 'Output')
    return { direction, count, connectorType: connector, label }
  })
