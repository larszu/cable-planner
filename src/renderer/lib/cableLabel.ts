/**
 * Festinstallation — Kabel-Label im AVIXA-F501.01-Stil (Quelle → Ziel).
 *
 * F501.01 verlangt am Kabel ein druckbares Label, das hierarchisch sagt, WO das
 * Kabel angeschlossen ist (Beispiel der Norm: "VDA2 Out 3 to PROJ Input A").
 * Diese reine Funktion baut genau diesen String aus den beiden Endpunkten des
 * Kabels — Gerät (Kurzname) + Port (Content-Label/Name) je Ende.
 */
import type { Cable } from '../types/cable'
import type { EquipmentItem } from '../types/equipment'
import { generateShortName } from './shortName'
import { portDisplayLabel } from './portLabel'

const deviceShort = (eq?: EquipmentItem): string => {
  if (!eq) return '?'
  return eq.shortName?.trim() || generateShortName(eq.name) || eq.name || '?'
}

const portText = (eq: EquipmentItem | undefined, portId: string): string => {
  if (!eq) return ''
  const p = eq.outputs.find((x) => x.id === portId) ?? eq.inputs.find((x) => x.id === portId)
  return p ? portDisplayLabel(p) : ''
}

/**
 * Baut das Quelle→Ziel-Label. `separator` ist per Default ein Pfeil (kompakt für
 * Etiketten); für norm-näheres Wording kann " to " übergeben werden.
 */
export const sourceDestLabel = (
  cable: Cable,
  eqById: Map<string, EquipmentItem>,
  opts: { separator?: string } = {},
): string => {
  const sep = opts.separator ?? '→'
  const from = eqById.get(cable.fromEquipmentId)
  const to = eqById.get(cable.toEquipmentId)
  const src = [deviceShort(from), portText(from, cable.fromPortId)].filter(Boolean).join(' ')
  const dst = [deviceShort(to), portText(to, cable.toPortId)].filter(Boolean).join(' ')
  return `${src} ${sep} ${dst}`.trim()
}
