import type { EquipmentItem, EquipmentTemplate } from '../types/equipment'
import { STORAGE_KEYS } from './storageKeys'

const RENTMAN_TEMPLATE_CACHE_KEY = STORAGE_KEYS.rentmanTemplateCacheV1

type RentmanTemplateCache = Record<string, EquipmentTemplate>

const readCache = (): RentmanTemplateCache => {
  try {
    const raw = localStorage.getItem(RENTMAN_TEMPLATE_CACHE_KEY)
    if (!raw) return {}
    const parsed = JSON.parse(raw) as RentmanTemplateCache
    if (!parsed || typeof parsed !== 'object') return {}
    return parsed
  } catch {
    return {}
  }
}

const writeCache = (cache: RentmanTemplateCache) => {
  try {
    localStorage.setItem(RENTMAN_TEMPLATE_CACHE_KEY, JSON.stringify(cache))
  } catch {
    /* ignore localStorage quota errors */
  }
}

const toTemplateFromEquipment = (item: EquipmentItem): EquipmentTemplate => ({
  name: item.name,
  category: item.category || 'Sonstiges',
  inputs: item.inputs,
  outputs: item.outputs,
  isRackDevice: item.isRackDevice,
  rackUnits: item.rackUnits,
  netboxPath: item.netboxPath,
  frontPanelImageUrl: item.frontPanelImageUrl,
  rearPanelImageUrl: item.rearPanelImageUrl,
  frontPanelCrop: item.frontPanelCrop,
  rearPanelCrop: item.rearPanelCrop,
  rentmanId: item.rentmanId,
  width: item.width,
  height: item.height,
  ipAddress: item.ipAddress,
  subnetMask: item.subnetMask,
  macAddress: item.macAddress,
  username: item.username,
  password: item.password,
  notes: item.notes,
  vlans: item.vlans,
  managementVlanId: item.managementVlanId,
  gateway: item.gateway,
  dnsServers: item.dnsServers,
  mgmtUrl: item.mgmtUrl,
  firmware: item.firmware,
  portVlans: item.portVlans,
  sdiCaps: item.sdiCaps,
  atemMvConfig: item.atemMvConfig,
  favorite: item.favorite,
  hidden: item.hidden,
  resolution: item.resolution,
  displaySizeInch: item.displaySizeInch,
  // v7.9.70 / #167 — Engineering-Daten aus dem Rentman-Katalog.
  powerWatts: item.powerWatts,
  weightKg: item.weightKg,
  depthMm: item.depthMm,
})

export const getCachedRentmanTemplate = (rentmanId: string): EquipmentTemplate | undefined => {
  const id = rentmanId.trim()
  if (!id) return undefined
  return readCache()[id]
}

export const upsertCachedRentmanTemplate = (template: EquipmentTemplate) => {
  const id = template.rentmanId?.trim()
  if (!id) return
  const cache = readCache()
  cache[id] = {
    ...template,
    rentmanId: id,
  }
  writeCache(cache)
}

export const upsertCachedRentmanTemplateFromEquipment = (item: EquipmentItem) => {
  const id = item.rentmanId?.trim()
  if (!id) return
  upsertCachedRentmanTemplate({
    ...toTemplateFromEquipment(item),
    rentmanId: id,
  })
}
