// #946 — „VLAN ID muss auch neben IP Adresse sichtbar sein."
//
// Eine Schreibweise fuer alle Listen und Blaetter. Ohne Eintrag steht NICHTS
// da — kein „VLAN —": eine Fuellung neben jeder IP saehe aus wie eine Angabe.
//
// REIN: keine Uhr, kein Store, kein IO.
import type { EquipmentItem } from '../types/equipment'

export const vlanTag = (vlanId: number | undefined | null): string =>
  typeof vlanId === 'number' && Number.isInteger(vlanId) ? `VLAN ${vlanId}` : ''

/** „10.0.0.5 · VLAN 20", „10.0.0.5" oder „". */
export const ipWithVlan = (ip: string | undefined, vlanId: number | undefined | null): string => {
  const a = ip?.trim() ?? ''
  if (!a) return ''
  const v = vlanTag(vlanId)
  return v ? `${a} · ${v}` : a
}

/**
 * Die VLAN-Id der Alt-Felder (Schnittstelle 0) ist `managementVlanId` —
 * dieselbe Zuordnung wie in `deviceInterfaces`, keine zweite.
 */
export const primaryVlanId = (e: Pick<EquipmentItem, 'managementVlanId'>): number | undefined =>
  typeof e.managementVlanId === 'number' ? e.managementVlanId : undefined
