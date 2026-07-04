// ───────────────────────────────────────────────────────────────────────────
// Zentrales Register der stabilen Geraetetyp-Identitaeten (GUID).
//
// GDTF/DIN-SPEC-15800-analog (FixtureTypeID): jede Katalog-Zeile traegt eine
// einmalig gemintete, versionsstabile GUID. Dieses Register loest eine solche
// ID autoritativ auf ihr Datenblatt-Template und — wo vorhanden — auf die
// Geraete-Rolle (ATEM/Videohub bzw. Switch/Router) auf. Damit ersetzt die
// ID-Aufloesung schrittweise die Namens-Heuristiken (deviceKind.ts): fuer
// Katalog-Geraete ist die Rolle eine Datenblatt-Tatsache, kein Regex-Treffer.
// Namens-Heuristik bleibt nur Fallback fuer Geraete OHNE deviceTypeId
// (manuell angelegt, Rentman/GraphML-Import ohne Katalog-Zuordnung).
// ───────────────────────────────────────────────────────────────────────────
import type { EquipmentTemplate } from '../types/equipment'
import { CAMERA_CATALOG } from './cameraCatalog'
import { BLACKMAGIC_CATALOG } from './blackmagicCatalog'
import { GREENGO_CATALOG } from './greengoCatalog'
import { MONITOR_CATALOG } from './monitorCatalog'
import { UBIQUITI_CATALOG } from './ubiquitiCatalog'
import { MISC_CATALOG } from './miscCatalog'

export interface DeviceTypeInfo {
  /** Datenblatt-Template (inkl. deviceTypeId). */
  template: EquipmentTemplate
  /** Autoritative Geraete-Rolle (Datenblatt), wenn eine spezialisierte UI existiert. */
  kind?: 'videohub' | 'atem' | 'multiviewer' | 'greengo'
  /** Autoritative Netzwerk-Rolle (Datenblatt). */
  networkKind?: 'switch' | 'router'
}

/** Lazy aufgebaut, damit der Modul-Import billig bleibt. */
let registry: Map<string, DeviceTypeInfo> | null = null

const buildRegistry = (): Map<string, DeviceTypeInfo> => {
  const map = new Map<string, DeviceTypeInfo>()
  const put = (id: string, info: DeviceTypeInfo) => {
    if (map.has(id)) {
      // Doppelte GUID waere ein Katalog-Pflegefehler — laut, nicht still.
      console.warn(`deviceTypeRegistry: doppelte deviceTypeId ${id}`)
      return
    }
    map.set(id, info)
  }
  for (const e of CAMERA_CATALOG) {
    put(e.deviceTypeId, { template: { ...e.template, deviceTypeId: e.deviceTypeId } })
  }
  for (const e of BLACKMAGIC_CATALOG) {
    put(e.deviceTypeId, {
      template: { ...e.template, deviceTypeId: e.deviceTypeId },
      kind: e.kind,
    })
  }
  for (const e of GREENGO_CATALOG) {
    // GreenGo-Katalog: die Rolle ist fuer alle Eintraege 'greengo' (Intercom).
    put(e.deviceTypeId, {
      template: { ...e.template, deviceTypeId: e.deviceTypeId },
      kind: 'greengo',
    })
  }
  for (const e of MONITOR_CATALOG) {
    put(e.deviceTypeId, { template: { ...e.template, deviceTypeId: e.deviceTypeId } })
  }
  for (const e of UBIQUITI_CATALOG) {
    put(e.deviceTypeId, {
      template: { ...e.template, deviceTypeId: e.deviceTypeId },
      networkKind: e.networkKind,
    })
  }
  for (const e of MISC_CATALOG) {
    put(e.deviceTypeId, { template: { ...e.template, deviceTypeId: e.deviceTypeId } })
  }
  return map
}

/**
 * Loest eine stabile Geraetetyp-ID autoritativ auf — oder null, wenn die ID
 * (noch) nicht in unseren Katalogen liegt. Kein Raten: null heisst unbekannt.
 */
export const resolveDeviceType = (deviceTypeId: string | undefined): DeviceTypeInfo | null => {
  if (!deviceTypeId) return null
  registry ??= buildRegistry()
  return registry.get(deviceTypeId) ?? null
}
