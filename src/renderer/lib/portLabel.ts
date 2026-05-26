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
