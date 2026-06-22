// #151 — Export einzelner Racks/Gruppen als eigenständige PDF.
//
// Einzel-Geräte konnten schon immer als Patch-Sheet exportiert werden
// (exportDevicePdf.ts, #74). Racks und Gruppen — gespeichert als
// GroupPreset im projectStore (Rack-Presets tragen `.rack`-Metadaten) —
// hatten bisher keinen eigenständigen PDF-Export.
//
// Dieser Helper rekonstruiert aus einem GroupPreset die enthaltenen
// Geräte (inkl. Ports) und ihre interne Verkabelung und erzeugt daraus
// ein Sammel-Patch-Sheet (eine Seite pro Gerät) — dieselbe bewährte
// Layout-Pipeline wie beim Einzel-Geräte-Export.

import type { Cable, CableType } from '../types/cable'
import type { EquipmentItem, GroupPreset } from '../types/equipment'
import {
  exportDevicesPatchSheetsBatch,
  buildDevicesPatchSheetsBatchBlob,
} from './exportDevicePdf'
import { buildExportFilenameWithSuffix } from './exportFilename'

/** Baut aus einem GroupPreset die (synthetischen) Geräte + Kabel auf,
 *  mit denen die Patch-Sheet-Pipeline arbeiten kann. */
const reconstructFromPreset = (
  preset: GroupPreset,
): { devices: EquipmentItem[]; cables: Cable[] } => {
  const devices: EquipmentItem[] = preset.items.map((tpl, i) => ({
    ...tpl,
    id: `grp-${preset.id}-${i}`,
    x: 0,
    y: 0,
  }))

  const cables: Cable[] = []
  preset.cables.forEach((c, ci) => {
    const fromDev = devices[c.fromItemIndex]
    const toDev = devices[c.toItemIndex]
    if (!fromDev || !toDev) return
    const fromPort =
      fromDev.outputs.find((p) => p.name === c.fromPortName) ??
      fromDev.inputs.find((p) => p.name === c.fromPortName)
    const toPort =
      toDev.inputs.find((p) => p.name === c.toPortName) ??
      toDev.outputs.find((p) => p.name === c.toPortName)
    if (!fromPort || !toPort) return
    cables.push({
      id: `grpc-${preset.id}-${ci}`,
      name: c.name,
      type: (c.type as CableType) ?? 'Custom',
      length: c.length,
      color: c.color ?? '#64748b',
      fromEquipmentId: fromDev.id,
      fromPortId: fromPort.id,
      toEquipmentId: toDev.id,
      toPortId: toPort.id,
      notes: '',
    })
  })

  return { devices, cables }
}

/** Lädt ein Rack/eine Gruppe als Sammel-Patch-PDF herunter. */
export const exportGroupAsPatchPdf = async (
  preset: GroupPreset,
  options?: { format?: 'a4' | 'a3' },
): Promise<void> => {
  const { devices, cables } = reconstructFromPreset(preset)
  if (devices.length === 0) return
  const suffix = preset.rack ? 'rack' : 'gruppe'
  await exportDevicesPatchSheetsBatch(devices, devices, cables, {
    format: options?.format ?? 'a4',
    fileName: buildExportFilenameWithSuffix(preset.name || suffix, suffix, 'pdf'),
  })
}

/** Wie oben, aber als Blob für den OS-Druckdialog. */
export const buildGroupPatchPdfBlob = (
  preset: GroupPreset,
  options?: { format?: 'a4' | 'a3' },
): Blob | null => {
  const { devices, cables } = reconstructFromPreset(preset)
  if (devices.length === 0) return null
  return buildDevicesPatchSheetsBatchBlob(devices, devices, cables, {
    format: options?.format ?? 'a4',
  })
}
