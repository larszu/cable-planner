// Inference of cable-planner ConnectorType from yEd port labels and from
// edge-level CableType strings. The yEd files we tested against use a
// mixed German/English vocabulary, plus several common shorthand spellings
// the operators put on their connector shapes ("HD-SDI", "LWL (OM2)",
// "Coax-75"). The map below is intentionally tolerant — only the leading
// token before any " (… )" / " - " / number suffix is matched after we
// uppercase-normalise.

import type { ConnectorType } from '../../types/equipment'

/** Heuristic: a list of regex patterns (case-insensitive, on a trimmed
 *  upper-cased haystack) for each ConnectorType. The first hit wins. */
const PATTERNS: Array<{ type: ConnectorType; rx: RegExp }> = [
  // Audio
  { type: 'XLR', rx: /\bXLR\b|\bAES\b|\bMIC\b/i },
  // Video — coax / BNC family
  { type: 'BNC', rx: /\bBNC\b|\bSDI\b|\bHD[-\s]?SDI\b|\b3G[-\s]?SDI\b|\b6G[-\s]?SDI\b|\b12G[-\s]?SDI\b|\bCOAX|\bKOAX/i },
  // #376 — Reihenfolge: spezifische Triax-Subtypes + SMPTE 304M zuerst,
  // damit z.B. "TRIAX FISCHER" nicht auf den generischen Triax-Pattern matched.
  { type: 'Triax (Damar & Hagen)', rx: /\bTRIAX[-\s]+(D[&\s]?H|DAMAR)\b|\bD[&\s]?H[-\s]+TRIAX\b/i },
  { type: 'Triax (Fischer)', rx: /\bTRIAX[-\s]+FISCHER\b|\bFISCHER[-\s]+TRIAX\b/i },
  { type: 'LEMO 3K.93C (SMPTE 304M)', rx: /\bLEMO[-\s]?3K\.93C\b|\bLEMO\s+311\b|\b3K\.93C\b/i },
  { type: 'Neutrik Dragonfly (SMPTE 304M)', rx: /\bDRAGONFLY\b|\bOPTICAL[-\s]?CON\s+DRAGONFLY\b/i },
  { type: 'Triax', rx: /\bTRIAX\b/i },
  // Video — digital
  { type: 'HDMI', rx: /\bHDMI\b/i },
  { type: 'DisplayPort', rx: /\bDISPLAYPORT\b|\bDP\b/i },
  // Network / IP
  { type: 'Ethernet/RJ45', rx: /\bETHERNET\b|\bLAN\b|\bRJ[-\s]?45\b|\bCAT\s?[5-8]\b|\bNETZWERK\b|\bNETWORK\b|\bDANTE\b|\bAVB\b|\bAES67\b|\bNDI\b|\bMADI[-\s]?ETH/i },
  // Fibre — pick SFP+ for marked "+" or 10G/25G refs, otherwise default Fiber.
  { type: 'SFP+', rx: /\bSFP\+\b|\b10G[-\s]?SR\b|\b10G[-\s]?LR\b|\b25G/i },
  { type: 'SFP', rx: /\bSFP\b|\b1G[-\s]?LX\b|\b1G[-\s]?SX\b/i },
  { type: 'Fiber', rx: /\bLWL\b|\bFIBER\b|\bFASER\b|\bOM[1-5]\b|\bOS[12]\b|\bMM\b|\bSM\b/i },
  // USB
  { type: 'USB-C', rx: /\bUSB[-\s]?C\b|\bTHUNDERBOLT\b|\bTB[34]\b/i },
  { type: 'USB', rx: /\bUSB\b/i },
  // DIN audio / midi
  { type: 'DIN', rx: /\bDIN\b|\bMIDI\b/i },
  // Wireless
  { type: 'Wireless/RF', rx: /\bWIRELESS\b|\bFUNK\b|\bWLAN\b|\bWIFI\b|\bWI[-\s]?FI\b|\bANTENNA\b|\bANTENNE\b|\bRF\b|\b(?:UHF|VHF)\b/i },
  // Power — German venue wiring is usually one of these four.
  { type: 'PowerCON', rx: /\bPOWERCON\b|\bPOWER\s?CON\b|\bP\.CON\b/i },
  { type: 'Schuko 230V', rx: /\bSCHUKO\b|\bSHUKO\b/i },
  { type: 'C7 Eurostecker', rx: /\bC7\b|\bEUROSTECKER\b/i },
  { type: 'IEC 230V', rx: /\bIEC\b|\bC13\b|\bC14\b|\bKALTGER(?:Ä|AE)TE/i },
]

/** Soft-clean a label so abbreviations and minor spacing differences
 *  don't break matching. Keeps the original casing for display. */
const normaliseHaystack = (s: string) =>
  s
    .replace(/­/g, '') // soft hyphen
    .replace(/\s+/g, ' ')
    .trim()

export interface ConnectorMatch {
  type: ConnectorType
  /** Confidence 0–1 — currently 0.9 for vocabulary hits, 0.4 for the
   *  fallback so the UI can still flag uncertain matches. */
  confidence: number
  /** Which input string actually triggered the match. */
  source: string
}

/** Try to classify the connector type from a port label or from a
 *  cable-planner CableType value sitting on an edge. Both share the same
 *  vocabulary (a CableType of "HDMI" or "OS2" should map to the right
 *  ConnectorType for visualisation). */
export const inferConnectorType = (
  ...candidates: Array<string | null | undefined>
): ConnectorMatch => {
  for (const raw of candidates) {
    if (!raw) continue
    const haystack = normaliseHaystack(raw)
    if (!haystack) continue
    for (const { type, rx } of PATTERNS) {
      if (rx.test(haystack)) {
        return { type, confidence: 0.9, source: raw }
      }
    }
  }
  return { type: 'Custom', confidence: 0.4, source: candidates.find(Boolean) ?? '' }
}

/** Decide whether a port is an INPUT or OUTPUT given its label and the
 *  edges incident on it. Direction text wins; otherwise we infer from
 *  which side of every incident edge this port sits on (source = output,
 *  target = input). When the evidence is mixed we fall back to
 *  'bidirectional' which the EquipmentNode renders with a purple handle. */
export type ResolvedDirection = 'in' | 'out' | 'bidirectional'

const DIRECTION_PATTERNS: Array<{ rx: RegExp; dir: ResolvedDirection }> = [
  { rx: /\b(OUT|OUTPUT|TX|SEND|AUSGANG)\b/i, dir: 'out' },
  { rx: /\b(IN|INPUT|RX|RETURN|EINGANG)\b/i, dir: 'in' },
]

export const inferDirection = (
  label: string,
  hint: { asSource: number; asTarget: number } | null,
): ResolvedDirection => {
  for (const { rx, dir } of DIRECTION_PATTERNS) {
    if (rx.test(label)) return dir
  }
  if (hint) {
    if (hint.asSource > 0 && hint.asTarget === 0) return 'out'
    if (hint.asTarget > 0 && hint.asSource === 0) return 'in'
    if (hint.asSource > 0 && hint.asTarget > 0) return 'bidirectional'
  }
  return 'bidirectional'
}
