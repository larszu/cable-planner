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
import { AJA_CATALOG } from './ajaCatalog'
import { ROSS_CATALOG } from './rossCatalog'
import { LYNX_CATALOG } from './lynxCatalog'
import { SWITCHER_CATALOG } from './switcherCatalog'
import { AVNETWORK_CATALOG } from './avNetworkCatalog'
import { BROADCAST_TOOLS_CATALOG } from './broadcastToolsCatalog'
import { AUDIO_CATALOG } from './audioCatalog'
import { WIRELESS_AUDIO_CATALOG } from './wirelessAudioCatalog'
import { MIC_CATALOG } from './micCatalog'

export interface DeviceTypeInfo {
  /** Datenblatt-Template (inkl. deviceTypeId). */
  template: EquipmentTemplate
  /** Autoritative Geraete-Rolle (Datenblatt), wenn eine spezialisierte UI existiert. */
  kind?: 'videohub' | 'atem' | 'multiviewer' | 'greengo'
  /** Autoritative Netzwerk-Rolle (Datenblatt). */
  networkKind?: 'switch' | 'router'
  /** Videohubs: expliziter Export-Preset-Key (Datenblatt-Fakt). */
  videohubPresetKey?: string
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
      videohubPresetKey: e.videohubPresetKey,
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
  // AJA/Ross/Lynx/Switcher: KEIN kind 'videohub' fuer fremde Router (KUMO,
  // Ultrix, NK) — der Videohub-Export spricht das Blackmagic-Protokoll
  // (Port 9990), das diese Geraete nicht verstehen. Rolle bleibt null.
  for (const e of AJA_CATALOG) {
    put(e.deviceTypeId, { template: { ...e.template, deviceTypeId: e.deviceTypeId } })
  }
  for (const e of ROSS_CATALOG) {
    put(e.deviceTypeId, { template: { ...e.template, deviceTypeId: e.deviceTypeId } })
  }
  for (const e of LYNX_CATALOG) {
    put(e.deviceTypeId, { template: { ...e.template, deviceTypeId: e.deviceTypeId } })
  }
  for (const e of SWITCHER_CATALOG) {
    put(e.deviceTypeId, { template: { ...e.template, deviceTypeId: e.deviceTypeId } })
  }
  for (const e of BROADCAST_TOOLS_CATALOG) {
    put(e.deviceTypeId, { template: { ...e.template, deviceTypeId: e.deviceTypeId } })
  }
  for (const e of AUDIO_CATALOG) {
    put(e.deviceTypeId, { template: { ...e.template, deviceTypeId: e.deviceTypeId } })
  }
  for (const e of WIRELESS_AUDIO_CATALOG) {
    put(e.deviceTypeId, { template: { ...e.template, deviceTypeId: e.deviceTypeId } })
  }
  for (const e of MIC_CATALOG) {
    put(e.deviceTypeId, { template: { ...e.template, deviceTypeId: e.deviceTypeId } })
  }
  for (const e of AVNETWORK_CATALOG) {
    put(e.deviceTypeId, {
      template: { ...e.template, deviceTypeId: e.deviceTypeId },
      networkKind: e.networkKind,
    })
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
