// Ein Planzeichen aus einer Beschreibung erzeugen — ueber den Anbieter, der
// unter Einstellungen → AI hinterlegt ist (`aiSuggestions.completeWithAI`).
// Ohne hinterlegten Schluessel bietet die Oberflaeche den Knopf nicht an.

import { completeWithAI } from '../aiSuggestions'
import { svgAusText, svgBereinigen } from './svg'

export const kiSymbolPrompt = (beschreibung: string): string =>
  [
    'Draw ONE technical plan symbol as SVG, in the style of German installation and',
    'building-services drawings (DIN EN 60617, DIN 14034-6).',
    `The symbol: ${beschreibung}`,
    '',
    'Rules:',
    '- viewBox="0 0 48 48", no width/height attributes',
    '- monochrome line art: stroke="#111", stroke-width="2", fill="none" (fill="#111" only where the symbol needs a solid area)',
    '- no <script>, no <foreignObject>, no external references, no raster images',
    '- text only if the symbol is conventionally an abbreviation in a box; then Arial, bold, centred',
    '- keep it simple enough to read at 24 px',
    '',
    'Answer with JSON only: {"name": "<short English name>", "svg": "<svg ...>...</svg>"}',
  ].join('\n')

export interface KiSymbolAntwort {
  name: string
  svg: string
}

/** Liest die Modellantwort. `null`, wenn kein brauchbares SVG darin steht. */
export const kiSymbolLesen = (text: string, beschreibung: string): KiSymbolAntwort | null => {
  let name = beschreibung
  let roh: string | null = null
  try {
    const start = text.indexOf('{')
    const ende = text.lastIndexOf('}')
    const obj = JSON.parse(start >= 0 && ende > start ? text.slice(start, ende + 1) : text) as { name?: unknown; svg?: unknown }
    if (typeof obj.svg === 'string') roh = obj.svg
    if (typeof obj.name === 'string' && obj.name.trim()) name = obj.name.trim()
  } catch {
    roh = svgAusText(text)
  }
  const svg = roh ? svgBereinigen(roh) : null
  return svg ? { name: name.slice(0, 80), svg } : null
}

export const kiSymbolErzeugen = async (beschreibung: string): Promise<KiSymbolAntwort | null> =>
  kiSymbolLesen(await completeWithAI(kiSymbolPrompt(beschreibung)), beschreibung)
