import type { EquipmentItem } from '../types/equipment'
import { resolveDeviceType } from './deviceTypeRegistry'

/**
 * Derive a default icon glyph for an equipment item from its category, name,
 * and port layout. Used by EquipmentNode when item.icon is undefined (#46).
 * Returning empty string means "no icon".
 */
export const defaultIconForEquipment = (device: {
  category?: string
  name?: string
  inputs?: Array<{ connectorType?: string }>
  outputs?: Array<{ connectorType?: string }>
}): string => {
  const cat = (device.category ?? '').toLowerCase()
  const name = (device.name ?? '').toLowerCase()
  if (cat === 'kameras' || /\bcam(era)?\b|ursa|alexa|venice|fx\d/.test(name)) return '📷'
  if (cat === 'monitore' || /monitor|display|ozone|tvlogic/.test(name)) return '🖥'
  if (cat === 'pc' || /\bpc\b|workstation|laptop|mac\s?(book|pro|mini)|minisforum/.test(name)) return '💻'
  if (cat === 'audio' || /\bmic|microphone|mixer|audio|fairlight|wing\b/.test(name)) return '🎙'
  if (cat === 'licht' || /\blight|skypanel|aputure|ledpanel/.test(name)) return '💡'
  if (cat === 'netzwerk' || /switch|router|firewall|access point|edgerouter/.test(name)) return '🌐'
  if (cat === 'strom' || /\bpower\b|psu|ups|distro/.test(name)) return '⚡'
  if (cat === 'video' || /converter|teranex|mini.?converter|hyperdeck|atem|videohub/.test(name)) return '📺'
  if (cat === 'kabel') return '🔌'
  if (cat === 'rigging') return '🔧'
  return ''
}

export type DeviceKind = 'videohub' | 'atem' | 'multiviewer' | 'greengo' | null

export type NetworkDeviceKind = 'switch' | 'router' | null

/**
 * Detect whether the given device is a managed network switch or router.
 * Used to show VLAN / management config fields in the properties panel.
 *
 * Aufloesungs-Reihenfolge: (1) stabile Geraetetyp-ID → autoritative Rolle aus
 * dem Katalog (Datenblatt-Tatsache, kein Raten); (2) Namens-/Struktur-Heuristik
 * als Fallback fuer Geraete ohne ID. Die Heuristik schreibt keine Daten ins
 * Modell — sie blendet nur optionale UI ein.
 */
export const detectNetworkDevice = (device: EquipmentItem): NetworkDeviceKind => {
  const resolved = resolveDeviceType(device.deviceTypeId)
  if (resolved) return resolved.networkKind ?? null

  const name = device.name.toLowerCase()
  if (/edgerouter|er-\d|dream machine|udm\b|udm-|mikrotik.*router|router\b.*(cisco|juniper|mikrotik|ubnt|ubiquiti)/.test(name)) {
    return 'router'
  }
  if (/edgeswitch|unifi switch|usw[- ]|es-\d|switch\b|sfp\+|cisco catalyst|netgear gs|netgear ms/.test(name)) {
    return 'switch'
  }
  // Structural fallback: many RJ45 ports and no BNC/XLR → likely a switch.
  const rj45 = [...device.inputs, ...device.outputs].filter(
    (p) => p.connectorType === 'Ethernet/RJ45' || p.connectorType === 'Fiber' || p.connectorType === 'SFP' || p.connectorType === 'SFP+',
  ).length
  const bnc = [...device.inputs, ...device.outputs].filter((p) => p.connectorType === 'BNC').length
  if (rj45 >= 8 && bnc === 0 && device.category.toLowerCase().includes('netzwerk')) {
    return 'switch'
  }
  return null
}

/**
 * Detect whether the given device is a Videohub / ATEM / multiviewer / GreenGo.
 * Used to surface specialised export buttons in the properties panel.
 *
 * Aufloesungs-Reihenfolge: (1) stabile Geraetetyp-ID → autoritative Rolle aus
 * dem Katalog (Datenblatt-Tatsache — auch das autoritative "keine Spezial-
 * Rolle", z.B. Kamera/Monitor/Konverter); (2) Namens-/Struktur-Heuristik als
 * Fallback fuer Geraete ohne ID.
 */
export const detectDeviceKind = (device: EquipmentItem): DeviceKind => {
  const resolved = resolveDeviceType(device.deviceTypeId)
  if (resolved) return resolved.kind ?? null

  const name = device.name.toLowerCase()

  // Don't mis-detect IP routers / switches as video routers.
  if (detectNetworkDevice(device) !== null) return null

  if (/greengo|green-go|gg5|\bxtbb\b|\bxtbd\b|\bbpxsp\b|\bwbpx\b|\bmcx\b.*intercom|intercom.*\bmcx\b/.test(name)) {
    return 'greengo'
  }

  if (/videohub|crosspoint|crossbar|video router|smart videohub|universal videohub/.test(name)) {
    return 'videohub'
  }

  if (/multiview|multi-view|mv\b/.test(name)) return 'multiviewer'

  if (/\batem\b/.test(name) || /constellation/.test(name)) {
    return 'atem'
  }

  // Structural fallback: a lot of SDI/BNC inputs with a matching number of
  // outputs and no mic inputs usually means a router/videohub.
  const bncIns = device.inputs.filter((p) => p.connectorType === 'BNC').length
  const bncOuts = device.outputs.filter((p) => p.connectorType === 'BNC').length
  if (bncIns >= 8 && bncOuts >= 8 && Math.abs(bncIns - bncOuts) <= 2) {
    return 'videohub'
  }

  return null
}

/**
 * Given an equipment item, guess the Videohub preset key (see
 * `exportVideohub.ts` → `videohubPresets`) that best matches the port count.
 */
export const guessVideohubPresetKey = (device: EquipmentItem): string => {
  const ins = device.inputs.filter((p) => p.connectorType === 'BNC').length
  const name = device.name.toLowerCase()
  if (/12g/.test(name) && ins >= 40) return 'smart-40x40-12g'
  if (ins >= 288) return 'universal-288x288'
  if (ins >= 72) return 'universal-72x72'
  if (ins >= 40) return 'smart-40x40'
  if (ins >= 20) return 'smart-20x20'
  if (ins >= 12) return 'smart-12x12'
  return 'smart-40x40-12g'
}
