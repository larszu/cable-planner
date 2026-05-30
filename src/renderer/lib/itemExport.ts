// v7.9.31 — Einzelne Library-Items als portable Dateien.
//
// Anders als der Library-Bulk-Export (Settings → Library Export/Import)
// schreibt das hier *ein* Gerät oder *eine* Gruppe pro Datei. Use-Case:
// einzelne Geräte/Racks/Gruppen per USB-Stick / E-Mail / Filesharing
// auf ein anderes System kopieren.
//
// Dateiformate (self-describing JSON):
//   .cpdevice  → ein EquipmentTemplate
//   .cpgroup   → ein GroupPreset (inkl. interne Kabel; Racks via
//                preset.rack-Feld)
//
// GroupPreset.cables referenzieren Ports per `itemIndex:portName`, nicht
// per UUID — d.h. die Datei ist auf jedem Zielsystem direkt instanziierbar
// ohne ID-Mapping.

import type { EquipmentTemplate, GroupPreset } from '../types/equipment'
import { downloadBlob } from './downloadBlob'

export const DEVICE_FILE_EXT = '.cpdevice'
export const GROUP_FILE_EXT = '.cpgroup'

export const DEVICE_FILE_TYPE = 'cable-planner-device'
export const GROUP_FILE_TYPE = 'cable-planner-group'

export interface DeviceFileV1 {
  type: typeof DEVICE_FILE_TYPE
  version: 1
  exportedAt: string
  template: EquipmentTemplate
}

export interface GroupFileV1 {
  type: typeof GROUP_FILE_TYPE
  version: 1
  exportedAt: string
  preset: GroupPreset
}

const sanitizeFileBase = (raw: string): string => {
  const cleaned = (raw || '').trim().replace(/[<>:"/\\|?*\p{Cc}]/gu, '_').replace(/\.+$/, '')
  return cleaned || 'export'
}

export const exportTemplateToFile = (template: EquipmentTemplate): void => {
  const payload: DeviceFileV1 = {
    type: DEVICE_FILE_TYPE,
    version: 1,
    exportedAt: new Date().toISOString(),
    template,
  }
  const fileName = `${sanitizeFileBase(template.name)}${DEVICE_FILE_EXT}`
  downloadBlob(fileName, JSON.stringify(payload, null, 2), 'application/json')
}

export const exportPresetToFile = (preset: GroupPreset): void => {
  const payload: GroupFileV1 = {
    type: GROUP_FILE_TYPE,
    version: 1,
    exportedAt: new Date().toISOString(),
    preset,
  }
  const fileName = `${sanitizeFileBase(preset.name)}${GROUP_FILE_EXT}`
  downloadBlob(fileName, JSON.stringify(payload, null, 2), 'application/json')
}

export type ParsedImport =
  | { kind: 'device'; template: EquipmentTemplate }
  | { kind: 'group'; preset: GroupPreset }

/** Parse a `.cpdevice` or `.cpgroup` file. Returns null if the content
 *  isn't a valid single-item export. Bulk-library files (`type:
 *  cable-planner-library`) are intentionally rejected here — those go
 *  through Settings → Library Import. */
export const parseLibraryItemFile = (text: string): ParsedImport | null => {
  let data: unknown
  try {
    data = JSON.parse(text)
  } catch {
    return null
  }
  if (!data || typeof data !== 'object') return null
  const record = data as Record<string, unknown>
  if (record.type === DEVICE_FILE_TYPE && record.version === 1) {
    const template = record.template
    if (template && typeof template === 'object') {
      return { kind: 'device', template: template as EquipmentTemplate }
    }
  }
  if (record.type === GROUP_FILE_TYPE && record.version === 1) {
    const preset = record.preset
    if (preset && typeof preset === 'object') {
      return { kind: 'group', preset: preset as GroupPreset }
    }
  }
  return null
}
