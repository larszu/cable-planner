// ───────────────────────────────────────────────────────────────────────────
// Anschluesse aus einem Foto der Geraeterueckseite (2026-09-28).
//
// Nutzer-Meldung: „kann man auch ne bilderkennung einfuegen, dass man ports
// von geraeten fotografiert und dann werden die korrekt erkannt und als
// geraet angelegt in dem neues geraet anlegen fenster".
//
// ─── WAS HIER ENTSTEHT UND WAS NICHT ───────────────────────────────────────
//
// Ein VORSCHLAG, keine Tatsache. Das Modell liest Beschriftungen und
// Buchsenformen; es verwechselt BNC mit HD-BNC, zaehlt eine Reihe falsch,
// haelt eine Blindkappe fuer eine Buchse. Deshalb:
//   - jede Zeile traegt `unsicher`, wenn das Modell es selbst sagt ODER der
//     Stecker nicht im Vokabular liegt ODER die Richtung nicht erkennbar war;
//   - unsichere Zeilen sind im Dialog abgewaehlt;
//   - nichts wird uebernommen, bevor der Nutzer „Uebernehmen" drueckt.
//
// Der Aufruf laeuft im Renderer ueber `completeWithAI` wie die uebrigen
// KI-Wege: dort liegen Anbieterwahl und Schluessel (Einstellungen → AI), und
// das Bild ist schon im Renderer. Ein Umweg ueber den Main-Prozess braechte
// keinen Schutz — derselbe Schluessel laege weiter im Renderer — aber einen
// zweiten Weg, der gepflegt werden will.
// ───────────────────────────────────────────────────────────────────────────
import { ALL_CONNECTOR_TYPES, type ConnectorType } from '../types/equipment'
import { ALL_SIGNAL_STANDARDS, type SignalStandard } from '../types/cableSpec'
import { completeWithAI } from './aiSuggestions'

export type ErkannteRichtung = 'in' | 'out' | 'bidirectional'

export interface ErkannterPort {
  direction: ErkannteRichtung
  count: number
  connectorType: ConnectorType
  label: string
  standard?: SignalStandard
  /** Das Modell war sich nicht sicher, oder die Abbildung auf unser Vokabular. */
  unsicher: boolean
  /** Was das Modell als Stecker schrieb, wenn es nicht im Vokabular lag. */
  connectorRoh?: string
}

export interface FotoErkennung {
  manufacturer?: string
  model?: string
  /** Hersteller/Modell nicht vom Typenschild gelesen, sondern vermutet. */
  modelUnsicher: boolean
  ports: ErkannterPort[]
}

export const fotoPrompt = (vokabular: readonly string[], name?: string) => `You are looking at photo(s) of the connector panel(s) of one piece of AV/broadcast equipment.
List every physical connector you can SEE. Read the printed labels next to the sockets.
Return STRICT JSON only (no prose, no markdown, no code fences).
${name ? `\nThe user calls the device: ${name}\n` : ''}
JSON schema:
{
  "manufacturer": <string or null, only if printed on the device or its rating plate>,
  "model": <string or null, only if printed on the device or its rating plate>,
  "modelSure": <true if manufacturer and model were READ from the device, false if guessed>,
  "ports": [
    {
      "direction": "in" | "out" | "bidirectional" | "unknown",
      "label": <printed label, short, e.g. "SDI IN 1", "REF", "LAN">,
      "count": <int, how many identical sockets in this row>,
      "connector": <one of: ${vokabular.join(', ')}>,
      "standard": <optional, one of: ${ALL_SIGNAL_STANDARDS.join(', ')}>,
      "sure": <true if clearly visible and readable, false otherwise>
    }
  ]
}

Rules:
- Group identical sockets with consecutive labels into ONE entry with count (e.g. "SDI IN 1-4" -> count 4).
- Ethernet, USB and similar two-way ports are "bidirectional". Power inlets are "in".
- If a connector does not match the list, use the closest one and set "sure": false.
- Do not invent ports that are not visible. Covered, blurry or cut-off sockets: "sure": false.
- No device visible: { "manufacturer": null, "model": null, "modelSure": false, "ports": [] }.`

/** Namen, unter denen Modelle Stecker nennen, die bei uns anders heissen. */
const STECKER_ALIAS: Record<string, ConnectorType> = {
  rj45: 'Ethernet/RJ45',
  ethernet: 'Ethernet/RJ45',
  lan: 'Ethernet/RJ45',
  '8p8c': 'Ethernet/RJ45',
  'hd bnc': 'HD-BNC',
  hdbnc: 'HD-BNC',
  'mini bnc': 'Mini-BNC',
  'micro bnc': 'Micro-BNC',
  'mini xlr': 'Mini-XLR',
  'xlr 3': 'XLR',
  'xlr 3 pin': 'XLR',
  'xlr3': 'XLR',
  'dmx 5 pin': 'DMX 5-pol (XLR)',
  'xlr 5': 'DMX 5-pol (XLR)',
  'xlr 5 pin': 'DMX 5-pol (XLR)',
  'usb a': 'USB',
  'usb b': 'USB',
  'usb type c': 'USB-C',
  'type c': 'USB-C',
  'iec': 'IEC 230V',
  'iec c13': 'IEC 230V',
  'iec c14': 'IEC 230V',
  'c14': 'IEC 230V',
  'powercon true1': 'PowerCON',
  'rca': 'Cinch/RCA',
  'cinch': 'Cinch/RCA',
  'sfp28': 'SFP+',
  'displayport': 'DisplayPort',
  'dp': 'DisplayPort',
  'd sub 9': 'DB9',
  'de 9': 'DB9',
  'rs 422': 'DB9',
  'd sub 25': 'DB25',
  '1 4 jack': 'Jack 6.35 mm',
  '6 3 mm jack': 'Jack 6.35 mm',
  '3 5 mm jack': 'Jack 3.5 mm',
  'minijack': 'Jack 3.5 mm',
  'bantam': 'TT/Bantam',
}

// Ohne Leerzeichen: "RJ-45", "RJ 45" und "rj45" sind derselbe Stecker.
const schluessel = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '')

const ALIAS_NACH_SCHLUESSEL = new Map<string, ConnectorType>(
  Object.entries(STECKER_ALIAS).map(([k, v]) => [schluessel(k), v]),
)

/**
 * Den Stecker des Modells auf unser Vokabular abbilden. `sicher` heisst: die
 * Angabe lag woertlich (bis auf Schreibweise) im Vokabular oder in der
 * Alias-Tabelle. Alles andere wird `Custom` und unsicher.
 */
export const steckerAbbilden = (
  roh: string | undefined,
  vokabular: readonly string[] = ALL_CONNECTOR_TYPES,
): { connectorType: ConnectorType; sicher: boolean } => {
  const k = schluessel(roh ?? '')
  if (!k) return { connectorType: 'Custom', sicher: false }
  const direkt = vokabular.find((v) => schluessel(v) === k)
  if (direkt) return { connectorType: direkt as ConnectorType, sicher: direkt !== 'Custom' }
  const alias = ALIAS_NACH_SCHLUESSEL.get(k)
  if (alias && vokabular.includes(alias)) return { connectorType: alias, sicher: true }
  return { connectorType: 'Custom', sicher: false }
}

interface RohPort {
  direction?: unknown
  label?: unknown
  count?: unknown
  connector?: unknown
  standard?: unknown
  sure?: unknown
}

const text = (v: unknown): string | undefined => {
  if (typeof v !== 'string') return undefined
  const t = v.trim()
  return t && t.toLowerCase() !== 'null' ? t : undefined
}

/** Die Antwort des Modells lesen. Wirft nur bei unlesbarem JSON. */
export const leseFotoAntwort = (
  antwort: string,
  vokabular: readonly string[] = ALL_CONNECTOR_TYPES,
): FotoErkennung => {
  const ohneZaun = antwort.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '')
  let roh: { manufacturer?: unknown; model?: unknown; modelSure?: unknown; ports?: unknown }
  try {
    roh = JSON.parse(ohneZaun)
  } catch {
    throw new Error('AI provider returned invalid JSON')
  }
  const ports = (Array.isArray(roh.ports) ? (roh.ports as RohPort[]) : []).map((p): ErkannterPort => {
    const r = (text(p.direction) ?? '').toLowerCase()
    const direction: ErkannteRichtung | undefined = r.startsWith('bi')
      ? 'bidirectional'
      : r.startsWith('out')
        ? 'out'
        : r.startsWith('in')
          ? 'in'
          : undefined
    const connectorRoh = text(p.connector)
    const { connectorType, sicher } = steckerAbbilden(connectorRoh, vokabular)
    const standardRoh = text(p.standard)
    const standard = ALL_SIGNAL_STANDARDS.find((s) => s === standardRoh)
    const count = Math.max(1, Math.min(64, Math.round(Number(p.count) || 1)))
    const label = (text(p.label) ?? '').slice(0, 40)
    return {
      direction: direction ?? 'in',
      count,
      connectorType,
      label: label || (direction === 'out' ? 'Output' : 'Input'),
      ...(standard ? { standard } : {}),
      unsicher: p.sure !== true || !sicher || !direction,
      ...(!sicher && connectorRoh ? { connectorRoh } : {}),
    }
  })
  const manufacturer = text(roh.manufacturer)
  const model = text(roh.model)
  return {
    ...(manufacturer ? { manufacturer } : {}),
    ...(model ? { model } : {}),
    modelUnsicher: roh.modelSure !== true,
    ports,
  }
}

/** Fotos (Data-URIs, schon verkleinert) an den gewaehlten Anbieter geben. */
export const erkennePortsAusFotos = async (
  fotos: readonly string[],
  opts: { vokabular?: readonly string[]; name?: string } = {},
): Promise<FotoErkennung> => {
  const vokabular = opts.vokabular ?? ALL_CONNECTOR_TYPES
  const antwort = await completeWithAI(fotoPrompt(vokabular, opts.name), [...fotos])
  return leseFotoAntwort(antwort, vokabular)
}
