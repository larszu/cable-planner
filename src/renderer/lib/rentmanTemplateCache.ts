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
  // ADR-002/ADR-005 — die Katalog-Identitaet muss die Rekonstruktion ueberleben.
  // Ohne sie kommt ein Geraet aus dem Cache ohne deviceTypeId zurueck, und der
  // Rentman-Import faellt auf die Namens-Heuristiken darunter zurueck: aus einer
  // Datenblatt-Tatsache wird wieder ein Regex-Treffer.
  deviceTypeId: item.deviceTypeId,
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
  // ADR-005 — Fortschreiben statt Ersetzen.
  //
  // Drei Funktionen bauen in dieser Codebase ein Template aus einem
  // EquipmentItem, und sie sind sich nicht einig, was dazugehoert:
  // `toTemplateFromEquipment` hier nennt 37 Felder, `templateFromEquipment`
  // im templateSlice 23, der Synthese-Zweig in `healRentmanLibraryFromProject`
  // 15. Die Feldmengen der beiden kleineren sind echte Teilmengen dieser hier
  // — keine von ihnen weiss etwas, das diese nicht auch weiss.
  //
  // Ein Ersetzen liess deshalb immer die aermste Rekonstruktion gewinnen, die
  // zuletzt vorbeikam: Rentman-Import schreibt Rack-Hoehe, Leistung, Gewicht
  // und Tiefe in den Eintrag, der Nutzer klickt auf einem so importierten
  // Geraet "Als Template speichern", und der 23-Feld-Nachbau ueberschrieb
  // alle vier — in einem Cache, der ausdruecklich projektuebergreifend ist.
  //
  // Ein Feld, ueber das die neue Fassung nichts sagt, ist keine Anweisung, den
  // alten Wert zu loeschen. Wer wirklich leeren will, schreibt den Schluessel
  // mit `undefined` — das ueberschreibt weiterhin, weil der Spread ihn traegt.
  cache[id] = {
    ...cache[id],
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
