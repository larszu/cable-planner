/**
 * #1203 — Logische Topologie auf dem physischen Plan.
 *
 * Die Kabel SIND die physische Topologie. Die logische (welches VLAN laeuft
 * worueber) stand bisher nur an den Schnittstellen und in Netzwerk >
 * Segmente. Dieser Rechner leitet sie fuer ein Kabel aus dem ab, was an
 * seinen beiden Enden eingetragen ist — kein neues Feld am Kabel, sonst
 * gaebe es zwei Wahrheiten.
 *
 *   access — genau ein VLAN, untagged (Switch-Port) oder an der Schnittstelle
 *   trunk  — tagged VLANs am Switch-Port, oder die Enden nennen verschiedene
 *   null   — nichts eingetragen: das Kabel hat (noch) keine logische Angabe
 */
import type { Cable } from '../types/cable'
import type { EquipmentItem } from '../types/equipment'
import type { NetworkSegment } from '../types/networkSegment'
import { deviceInterfaces } from './networkInterfaces'

export type CableVlan = { kind: 'access'; vlanId: number } | { kind: 'trunk'; vlanIds: number[] } | null

const parseTagged = (s: string | undefined): number[] =>
  (s ?? '')
    .split(/[\s,;]+/)
    .map((x) => Number(x))
    .filter((n) => Number.isInteger(n) && n > 0)

/** Was ein Ende sagt: VLAN-Ids und ob dort getaggt wird. */
const endVlans = (e: EquipmentItem | undefined, portId: string): { ids: number[]; tagged: boolean } => {
  if (!e) return { ids: [], tagged: false }
  const pv = e.portVlans?.[portId]
  if (pv) {
    const tagged = parseTagged(pv.tagged)
    const ids = [...(pv.untagged !== undefined ? [pv.untagged] : []), ...tagged]
    if (ids.length) return { ids, tagged: tagged.length > 0 }
  }
  const nic = deviceInterfaces(e).find((n) => n.portId === portId && typeof n.vlanId === 'number')
  return nic ? { ids: [nic.vlanId as number], tagged: false } : { ids: [], tagged: false }
}

export function cableVlan(
  cable: Pick<Cable, 'fromEquipmentId' | 'fromPortId' | 'toEquipmentId' | 'toPortId'>,
  byId: ReadonlyMap<string, EquipmentItem>,
): CableVlan {
  const a = endVlans(byId.get(cable.fromEquipmentId), cable.fromPortId)
  const b = endVlans(byId.get(cable.toEquipmentId), cable.toPortId)
  const ids = [...new Set([...a.ids, ...b.ids])].sort((x, y) => x - y)
  if (ids.length === 0) return null
  if (ids.length === 1 && !a.tagged && !b.tagged) return { kind: 'access', vlanId: ids[0] }
  return { kind: 'trunk', vlanIds: ids }
}

/** Feste Farbe je VLAN-Id (goldener Winkel): dieselbe Id hat auf jedem Plan
 *  dieselbe Farbe, benachbarte Ids liegen weit auseinander. */
export const vlanColor = (vlanId: number): string => `hsl(${Math.round((vlanId * 137.508) % 360)} 70% 55%)`

export const VLAN_TRUNK_COLOR = '#94a3b8'
export const VLAN_NONE_COLOR = '#64748b'

/** Kurztext fuer das Kabel-Label: „VLAN 20 Dante" oder „Trunk 10/20". */
export function cableVlanLabel(v: CableVlan, segments: readonly NetworkSegment[] | undefined): string {
  if (!v) return ''
  if (v.kind === 'trunk') return `Trunk ${v.vlanIds.join('/')}`
  const name = segments?.find((s) => s.vlanId === v.vlanId)?.name?.trim()
  return name ? `VLAN ${v.vlanId} ${name}` : `VLAN ${v.vlanId}`
}
