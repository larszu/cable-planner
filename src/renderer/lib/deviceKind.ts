import type { EquipmentItem } from '../types/equipment'

export type DeviceKind = 'videohub' | 'atem' | 'multiviewer' | null

export type NetworkDeviceKind = 'switch' | 'router' | null

/**
 * Guess whether the given device is a managed network switch or router.
 * Used to show VLAN / management config fields in the properties panel.
 */
export const detectNetworkDevice = (device: EquipmentItem): NetworkDeviceKind => {
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
 * Guess whether the given device is a Videohub / ATEM / multiviewer, based on
 * its name and port layout. Used to surface specialised export buttons in the
 * properties panel.
 */
export const detectDeviceKind = (device: EquipmentItem): DeviceKind => {
  const name = device.name.toLowerCase()

  // Don't mis-detect IP routers / switches as video routers.
  if (detectNetworkDevice(device) !== null) return null

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
