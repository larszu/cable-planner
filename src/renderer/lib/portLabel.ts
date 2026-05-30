import type { Port } from '../types/equipment'

/**
 * #286 — Display-Label fuer einen Port auf dem Canvas und in Exports.
 *
 * Trennt das *inhaltliche* Signal-Label (PGM, PVW, MV1, Cam1) vom
 * *Hauptnamen* des Ports. Wenn der User in den Properties einen
 * `contentLabel` gesetzt hat, gewinnt der gegen den oft technischer
 * formulierten `port.name` ("1 SDI 3G PGM (1080p50/60)" → "PGM").
 *
 * Reihenfolge:
 *   1. `port.contentLabel` wenn gesetzt
 *   2. `port.name` als Fallback
 *   3. Leerer String wenn beides leer (sollte nicht passieren; UI
 *      faellt dann auf port.id zurueck, der Caller entscheidet).
 */
export const portDisplayLabel = (port: Pick<Port, 'name' | 'contentLabel'>): string => {
  const content = port.contentLabel?.trim()
  if (content) return content
  return port.name ?? ''
}

/**
 * #410 — Kompaktes Symbol fuer das Steckverbinder-Geschlecht. Leerer
 * String wenn nicht gesetzt, damit Caller bedingungslos anhaengen koennen.
 */
export const genderSymbol = (gender?: Port['gender']): string => {
  if (gender === 'male') return '♂'
  if (gender === 'female') return '♀'
  return ''
}

/**
 * Zwei-Zeilen-Variante fuer Stellen die sowohl die Funktion als auch den
 * traditionellen Port-Namen zeigen wollen (Patchliste, Device-PDF).
 * Liefert beide Strings; falls `contentLabel` leer ist, ist `subline`
 * undefined und der Caller rendert nur `main`.
 */
export const portLabelPair = (
  port: Pick<Port, 'name' | 'contentLabel'>,
): { main: string; subline?: string } => {
  const content = port.contentLabel?.trim()
  const name = port.name?.trim() ?? ''
  if (content && name && content !== name) {
    return { main: content, subline: name }
  }
  return { main: content || name }
}

/**
 * #302 — Stripping fuer ATEM-Labels. ATEM Long-Name ist 20 Chars, Short
 * 4. Canvas-Port-Namen sind oft viel laenger und voller fuer ATEM
 * redundanter Infos: Stecker-Typ ("SDI"), Signal-Standard ("3G", "12G"),
 * Format ("(1080p50/60)"), fuehrende Port-Nummern ("1 ", "2 ").
 *
 * Macht aus "1 SDI 3G PGM (1080p50/60)" -> "PGM" was deutlich nuetzlicher
 * in der ATEM-UI angezeigt wird. War vorher private in AtemDialog.tsx;
 * jetzt zentralisiert weil die Pipeline-Konsumenten (AtemDialog,
 * VideohubExport) die gleiche Aufbereitung brauchen koennen.
 */
export const shortenForAtem = (raw: string): string => {
  let out = raw.trim()
  // Fuehrende Port-Nummer mit Leerzeichen ("1 ", "12 ").
  out = out.replace(/^\d+\s+/, '')
  // Format-Suffix in Klammern: (1080p50/60), (4Kp50) etc.
  out = out.replace(/\s*\(\d{2,4}[pi]\d{2,3}(?:\/\d{2,3})?\)/gi, '')
  // Stecker-Token (SDI/HDMI/BNC/XLR) wenn die Restzeichenkette laenger
  // als ein Wort ist — sonst wuerde "SDI 1" zu "1" verstuemmelt.
  const tokens = out.split(/\s+/)
  if (tokens.length > 1) {
    const stripKeywords = /^(SDI|HDMI|BNC|XLR|RJ45|Fiber|SFP\+?|DIN|USB|USB-C|3G|6G|12G)$/i
    while (tokens.length > 1 && stripKeywords.test(tokens[0])) {
      tokens.shift()
    }
    out = tokens.join(' ').trim()
  }
  return out || raw.trim()
}
