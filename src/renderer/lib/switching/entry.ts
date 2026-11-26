// Wann ein Geraet eine Innenansicht hat (#1240, Stufe 2). REIN.
import type { EquipmentItem } from '../../types/equipment'
import { detectDeviceKind } from '../deviceKind'
import { switchingProfileFor } from './state'
import type { SwitchingRole } from './types'

const MISCHER = /\b(video\s*mixer|switcher|bildmischer|mischer)\b/i
const KREUZSCHIENE = /\b(video\s*router|router|kreuzschiene|matrix)\b/i

/** Mischer oder Kreuzschiene — mit Profil oder nach Rolle bzw. Kategorie. */
export const innenansichtRolle = (device: EquipmentItem): SwitchingRole | null => {
  const p = switchingProfileFor(device)
  if (p) return p.role
  const kind = detectDeviceKind(device)
  if (kind === 'videohub') return 'router'
  if (kind === 'atem') return 'mixer'
  const cat = device.category ?? ''
  if (MISCHER.test(cat)) return 'mixer'
  if (/video/i.test(cat) && KREUZSCHIENE.test(cat)) return 'router'
  return null
}

export const hatInnenansicht = (device: EquipmentItem): boolean => innenansichtRolle(device) !== null
