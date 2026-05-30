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

import type { EquipmentItem, EquipmentTemplate, GroupPreset } from '../types/equipment'
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

// ── Persisted Folder-Tracking ──────────────────────────────────────
// Wir merken uns welche Items wir schon mal im Folder gesehen / dort
// hingeschrieben haben. Damit erkennt der Startup-Scan welche Items
// vom User aus dem Folder gelöscht wurden (= im Tracking, aber nicht
// mehr im Scan-Ergebnis) und entfernt sie aus dem Store.
// Without persisting we hätten kein Way to distinguish "frisches
// localStorage-Item, das noch nie gesynced wurde" von "Item, das im
// Folder gelöscht wurde".

const FOLDER_TRACK_KEY = 'cable-planner:folderTrackedItems'

interface FolderTrackedItems {
  devices: string[]
  groups: string[]
}

const loadFolderTrackedItems = (): FolderTrackedItems => {
  try {
    const raw = localStorage.getItem(FOLDER_TRACK_KEY)
    if (!raw) return { devices: [], groups: [] }
    const parsed = JSON.parse(raw) as Partial<FolderTrackedItems>
    return {
      devices: Array.isArray(parsed.devices) ? parsed.devices : [],
      groups: Array.isArray(parsed.groups) ? parsed.groups : [],
    }
  } catch {
    return { devices: [], groups: [] }
  }
}

const folderTracked = loadFolderTrackedItems()

const persistFolderTracked = (): void => {
  try {
    localStorage.setItem(FOLDER_TRACK_KEY, JSON.stringify(folderTracked))
  } catch {
    /* ignore */
  }
}

const trackDevice = (name: string): void => {
  if (!folderTracked.devices.includes(name)) {
    folderTracked.devices.push(name)
    persistFolderTracked()
  }
}

const untrackDevice = (name: string): void => {
  const before = folderTracked.devices.length
  folderTracked.devices = folderTracked.devices.filter((n) => n !== name)
  if (folderTracked.devices.length !== before) persistFolderTracked()
}

const trackGroup = (name: string): void => {
  if (!folderTracked.groups.includes(name)) {
    folderTracked.groups.push(name)
    persistFolderTracked()
  }
}

const untrackGroup = (name: string): void => {
  const before = folderTracked.groups.length
  folderTracked.groups = folderTracked.groups.filter((n) => n !== name)
  if (folderTracked.groups.length !== before) persistFolderTracked()
}

/** After a startup scan, returns the names of items that were tracked
 *  in folder before but no longer exist (= deleted by user via OS).
 *  Caller should remove these from the store. */
export const detectFolderDeletions = (currentFolderItems: ScannedItem[]): {
  deletedDevices: string[]
  deletedGroups: string[]
} => {
  const currentDevices = new Set(
    currentFolderItems.filter((i) => i.kind === 'device').map((i) => i.template.name),
  )
  const currentGroups = new Set(
    currentFolderItems.filter((i) => i.kind === 'group').map((i) => i.preset.name),
  )
  return {
    deletedDevices: folderTracked.devices.filter((n) => !currentDevices.has(n)),
    deletedGroups: folderTracked.groups.filter((n) => !currentGroups.has(n)),
  }
}
// Damit "Mit Lib-Version X importiert"-Markierungen am platzierten
// Equipment stehen können (Phase 3). Map wird gefüllt von scan + write.

const deviceRefByName = new Map<string, LibraryRef>()
const groupRefByName = new Map<string, LibraryRef>()

export const getDeviceLibraryRef = (templateName: string): LibraryRef | undefined =>
  deviceRefByName.get(templateName)

export const getGroupLibraryRef = (presetName: string): LibraryRef | undefined =>
  groupRefByName.get(presetName)

/** Attach the current device libraryRef to a template before placement.
 *  Returns the original if no folder-tracked ref exists (e.g. on web,
 *  for built-in catalog items, or before the startup scan finished). */
export const stampDeviceLibraryRef = (template: EquipmentTemplate): EquipmentTemplate => {
  const ref = deviceRefByName.get(template.name)
  if (!ref) return template
  return {
    ...template,
    libraryRef: {
      kind: 'device',
      name: template.name,
      fileVersion: ref.fileVersion,
      modifiedAt: ref.modifiedAt,
    },
  }
}

/** Stamp every spawned equipment from a group placement with the group's
 *  libraryRef. Used by placeGroupPreset so the project can later check
 *  for group updates. */
export const stampGroupLibraryRef = (
  presetName: string,
): EquipmentItem['libraryRef'] | undefined => {
  const ref = groupRefByName.get(presetName)
  if (!ref) return undefined
  return {
    kind: 'group',
    name: presetName,
    fileVersion: ref.fileVersion,
    modifiedAt: ref.modifiedAt,
  }
}

/** Read every item file from the central library folder. Returns empty
 *  array in the web fallback / when the folder isn't accessible.
 *  Side-effect: aktualisiert die internen Refs-Maps damit nachfolgende
 *  Placements ihren libraryRef finden. */
export const scanLibraryFolder = async (): Promise<ScannedItem[]> => {
  if (!hasDesktopBridge) return []
  try {
    const raw = await cablePlannerApi.library.scan()
    const result: ScannedItem[] = []
    for (const entry of raw) {
      const ref: LibraryRef = {
        fileName: entry.fileName,
        fileVersion: entry.fileVersion,
        modifiedAt: entry.modifiedAt,
      }
      if (entry.kind === 'device' && isTemplate(entry.payload)) {
        deviceRefByName.set(entry.payload.name, ref)
        trackDevice(entry.payload.name)
        result.push({
          kind: 'device',
          fileName: entry.fileName,
          fileVersion: entry.fileVersion,
          modifiedAt: entry.modifiedAt,
          template: entry.payload,
        })
      } else if (entry.kind === 'group' && isPreset(entry.payload)) {
        groupRefByName.set(entry.payload.name, ref)
        trackGroup(entry.payload.name)
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
    deviceRefByName.set(template.name, res)
    trackDevice(template.name)
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
    groupRefByName.set(preset.name, res)
    trackGroup(preset.name)
    return res
  } catch {
    return null
  }
}

export const deleteDeviceFromFolder = async (templateName: string): Promise<void> => {
  deviceRefByName.delete(templateName)
  untrackDevice(templateName)
  if (!hasDesktopBridge) return
  try {
    await cablePlannerApi.library.deleteItem({ kind: 'device', name: templateName })
  } catch {
    /* ignore */
  }
}

export const deleteGroupFromFolder = async (presetName: string): Promise<void> => {
  groupRefByName.delete(presetName)
  untrackGroup(presetName)
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

/** v7.9.38 — First-Install-Sync. Schreibt alle Items aus dem Store
 *  in den zentralen Ordner, die dort noch nicht liegen (d.h. nicht
 *  in deviceRefByName / groupRefByName nach dem Scan). Damit landen
 *  die Built-in-Templates und alle bisher nur in localStorage
 *  gespeicherten User-Items auch wirklich als Dateien im Ordner —
 *  vorher waren sie zwar im seedLibrarySyncCache als "synchron"
 *  markiert, aber tatsächlich nie geschrieben worden, weil das nur
 *  bei Mutationen passiert ist. */
export const pushMissingItemsToFolder = async (
  devices: ReadonlyArray<EquipmentTemplate>,
  groups: ReadonlyArray<GroupPreset>,
): Promise<{ devicesWritten: number; groupsWritten: number }> => {
  if (!hasDesktopBridge) return { devicesWritten: 0, groupsWritten: 0 }
  let dw = 0
  let gw = 0
  for (const t of devices) {
    if (!deviceRefByName.has(t.name)) {
      const res = await writeDeviceToFolder(t)
      if (res) dw += 1
    }
  }
  for (const p of groups) {
    if (!groupRefByName.has(p.name)) {
      const res = await writeGroupToFolder(p)
      if (res) gw += 1
    }
  }
  return { devicesWritten: dw, groupsWritten: gw }
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

// ── Update-Check (Phase 3) ─────────────────────────────────────────
// Beim Projekt-Öffnen vergleicht der Renderer jedes Equipment mit
// libraryRef gegen den aktuellen Folder-Stand. Items, deren Folder-
// Datei einen höheren fileVersion-Wert hat, gelten als "outdated"
// und werden dem User zur Aktualisierung angeboten.

export interface OutdatedLibraryItem {
  equipmentId: string
  equipmentName: string
  refKind: 'device' | 'group'
  refName: string
  storedFileVersion: number
  storedModifiedAt: string
  currentFileVersion: number
  currentModifiedAt: string
}

export const findOutdatedEquipment = (
  equipment: ReadonlyArray<EquipmentItem>,
): OutdatedLibraryItem[] => {
  const out: OutdatedLibraryItem[] = []
  for (const eq of equipment) {
    if (!eq.libraryRef) continue
    const ref = eq.libraryRef
    const current =
      ref.kind === 'device' ? deviceRefByName.get(ref.name) : groupRefByName.get(ref.name)
    if (!current) continue // library file deleted/renamed → keine Aktualisierung möglich
    if (current.fileVersion > ref.fileVersion) {
      out.push({
        equipmentId: eq.id,
        equipmentName: eq.name,
        refKind: ref.kind,
        refName: ref.name,
        storedFileVersion: ref.fileVersion,
        storedModifiedAt: ref.modifiedAt,
        currentFileVersion: current.fileVersion,
        currentModifiedAt: current.modifiedAt,
      })
    }
  }
  return out
}

/** Apply a fresh device template to an existing placed equipment, while
 *  preserving its identity (id, x, y) and re-stamping the libraryRef
 *  to the new fileVersion. Cables connected via port-id may become
 *  dangling if v2 of the template changed port IDs — the user is
 *  responsible for that (rare in practice because templates rarely
 *  recycle IDs). */
export const applyDeviceTemplateUpdate = (
  oldEq: EquipmentItem,
  newTemplate: EquipmentTemplate,
): EquipmentItem => {
  const stamped = stampDeviceLibraryRef(newTemplate)
  return {
    ...stamped,
    id: oldEq.id,
    x: oldEq.x,
    y: oldEq.y,
    // Preserve user-local Edits am Equipment — Notizen + ggf. Rename
    // sind nicht Teil des Library-Templates, der Update soll sie nicht
    // wegwerfen.
    name: oldEq.name,
    notes: oldEq.notes,
  }
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
