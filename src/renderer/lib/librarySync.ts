// v7.9.33 — Zentraler Library-Ordner: Sync + Version-Refs.
//
// Architekturüberblick:
//  - Geräte und Gruppen leben als Einzeldateien in
//    userData/library/devices/*.cpdevice + userData/library/groups/*.cpgroup
//  - Beim App-Start scannt der Renderer den Ordner und merged neue Items
//    ins localStorage-basierte Store-Backing.
//  - Bei jedem Library-CRUD im Store wird die zentrale Datei
//    automatisch mitgepflegt (fire-and-forget, blockt UI nicht).
//  - Jedes ins Projekt platzierte Gerät kriegt einen `libraryRef`
//    {fileName, fileVersion, modifiedAt} — beim Öffnen prüft der
//    Renderer ob neuere Versionen im Library-Ordner liegen.
//
// Web-Fallback: bridge.library.* gibt no-op-Werte zurück, alles
// passiert nur über localStorage wie vorher.

import type { EquipmentTemplate, GroupPreset } from '../types/equipment'
import { cablePlannerApi, hasDesktopBridge } from './bridge'

export interface LibraryRef {
  /** Sanitized file-name (without extension), used to look up the file
   *  in the central folder. */
  fileName: string
  fileVersion: number
  modifiedAt: string
}

export interface ScannedDevice {
  kind: 'device'
  fileName: string
  fileVersion: number
  modifiedAt: string
  template: EquipmentTemplate
}

export interface ScannedGroup {
  kind: 'group'
  fileName: string
  fileVersion: number
  modifiedAt: string
  preset: GroupPreset
}

export type ScannedItem = ScannedDevice | ScannedGroup

const isTemplate = (x: unknown): x is EquipmentTemplate =>
  !!x && typeof x === 'object' && typeof (x as EquipmentTemplate).name === 'string'

const isPreset = (x: unknown): x is GroupPreset =>
  !!x &&
  typeof x === 'object' &&
  typeof (x as GroupPreset).name === 'string' &&
  Array.isArray((x as GroupPreset).items)

/** Read every item file from the central library folder. Returns empty
 *  array in the web fallback / when the folder isn't accessible. */
export const scanLibraryFolder = async (): Promise<ScannedItem[]> => {
  if (!hasDesktopBridge) return []
  try {
    const raw = await cablePlannerApi.library.scan()
    const result: ScannedItem[] = []
    for (const entry of raw) {
      if (entry.kind === 'device' && isTemplate(entry.payload)) {
        result.push({
          kind: 'device',
          fileName: entry.fileName,
          fileVersion: entry.fileVersion,
          modifiedAt: entry.modifiedAt,
          template: entry.payload,
        })
      } else if (entry.kind === 'group' && isPreset(entry.payload)) {
        result.push({
          kind: 'group',
          fileName: entry.fileName,
          fileVersion: entry.fileVersion,
          modifiedAt: entry.modifiedAt,
          preset: entry.payload,
        })
      }
    }
    return result
  } catch {
    return []
  }
}

/** Write a device template to the central folder. The returned ref can
 *  be stored on placed equipment so the project knows which library
 *  version is in use. Fire-and-forget — caller can ignore the promise.
 *  Returns null on web-fallback / write failure. */
export const writeDeviceToFolder = async (
  template: EquipmentTemplate,
): Promise<LibraryRef | null> => {
  if (!hasDesktopBridge) return null
  try {
    const res = await cablePlannerApi.library.write({
      kind: 'device',
      name: template.name,
      payload: template,
    })
    return res
  } catch {
    return null
  }
}

export const writeGroupToFolder = async (preset: GroupPreset): Promise<LibraryRef | null> => {
  if (!hasDesktopBridge) return null
  try {
    const res = await cablePlannerApi.library.write({
      kind: 'group',
      name: preset.name,
      payload: preset,
    })
    return res
  } catch {
    return null
  }
}

export const deleteDeviceFromFolder = async (templateName: string): Promise<void> => {
  if (!hasDesktopBridge) return
  try {
    await cablePlannerApi.library.deleteItem({ kind: 'device', name: templateName })
  } catch {
    /* ignore */
  }
}

export const deleteGroupFromFolder = async (presetName: string): Promise<void> => {
  if (!hasDesktopBridge) return
  try {
    await cablePlannerApi.library.deleteItem({ kind: 'group', name: presetName })
  } catch {
    /* ignore */
  }
}

/** Open the library folder in the user's OS file manager. */
export const openLibraryFolder = async (): Promise<void> => {
  if (!hasDesktopBridge) return
  try {
    await cablePlannerApi.library.revealFolder()
  } catch {
    /* ignore */
  }
}

export const getLibraryFolderPath = async (): Promise<string> => {
  if (!hasDesktopBridge) return ''
  try {
    return await cablePlannerApi.library.getFolderPath()
  } catch {
    return ''
  }
}

// ── Diff-Sync gegen den zentralen Ordner ───────────────────────────
// Der projectStore ruft syncDevicesToFolder/syncPresetsToFolder bei
// jedem persist auf; wir vergleichen gegen das letzte gesehene Set und
// schreiben/löschen nur tatsächlich geänderte Items. Verhindert
// unnötige fileVersion-Bumps bei harmlosen Re-Persists.

let lastSyncedDevices = new Map<string, EquipmentTemplate>()
let lastSyncedGroups = new Map<string, GroupPreset>()

/** Seed the diff cache without triggering folder writes. Used on app
 *  startup to record the localStorage-loaded state as "already synced"
 *  so the next user mutation only writes the actual delta. */
export const seedLibrarySyncCache = (
  devices: EquipmentTemplate[],
  groups: GroupPreset[],
): void => {
  lastSyncedDevices = new Map(devices.map((t) => [t.name, t]))
  lastSyncedGroups = new Map(groups.map((p) => [p.name, p]))
}

/** Mark a folder-sourced item as "already synced" so the merge-into-
 *  store step doesn't trigger a write-back. */
export const markDeviceSynced = (template: EquipmentTemplate): void => {
  lastSyncedDevices.set(template.name, template)
}

export const markGroupSynced = (preset: GroupPreset): void => {
  lastSyncedGroups.set(preset.name, preset)
}

export const syncDevicesToFolder = (items: EquipmentTemplate[]): void => {
  const next = new Map(items.map((t) => [t.name, t]))
  for (const oldName of lastSyncedDevices.keys()) {
    if (!next.has(oldName)) void deleteDeviceFromFolder(oldName)
  }
  for (const [name, item] of next) {
    const prev = lastSyncedDevices.get(name)
    if (!prev || JSON.stringify(prev) !== JSON.stringify(item)) {
      void writeDeviceToFolder(item)
    }
  }
  lastSyncedDevices = next
}

export const syncPresetsToFolder = (presets: GroupPreset[]): void => {
  const next = new Map(presets.map((p) => [p.name, p]))
  for (const oldName of lastSyncedGroups.keys()) {
    if (!next.has(oldName)) void deleteGroupFromFolder(oldName)
  }
  for (const [name, preset] of next) {
    const prev = lastSyncedGroups.get(name)
    if (!prev || JSON.stringify(prev) !== JSON.stringify(preset)) {
      void writeGroupToFolder(preset)
    }
  }
  lastSyncedGroups = next
}
