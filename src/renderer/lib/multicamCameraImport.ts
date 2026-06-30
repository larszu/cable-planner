// ───────────────────────────────────────────────────────────────────────────
// Import von MultiCam-Planner-Kameras als Equipment (`camera-list` v1)
//
// Der MultiCam-Planner exportiert seine platzierten Kameras als neutrale
// Kamera-Liste (Modell, Hersteller, Venue-Position). Hier werden sie zu
// EquipmentItems der Kategorie "Kameras": passt ein Modell zum CAMERA_CATALOG,
// erbt es dessen echte Port-Belegung (SDI/HDMI/XLR…), sonst bekommt es einen
// generischen SDI-Ausgang. So kann man in MultiCam platzierte Kameras hier
// direkt verkabeln. Gegenstueck: multicam-planner src/utils/cameraExport.ts.
// ───────────────────────────────────────────────────────────────────────────
import type { EquipmentItem, Port } from '../types/equipment'
import { CAMERA_CATALOG } from './cameraCatalog'

export const CAMERA_LIST_KIND = 'camera-list' as const
export const CAMERA_LIST_VERSION = 1 as const

export interface CameraListEntry {
  id: string
  label: string
  manufacturer?: string
  model?: string
  x?: number // Meter im Venue
  y?: number
}
export interface CameraListExchange {
  kind: typeof CAMERA_LIST_KIND
  formatVersion: typeof CAMERA_LIST_VERSION
  app: string
  appVersion: string
  exportedAt: string
  cameras: CameraListEntry[]
}

export function parseCameraList(text: string): CameraListExchange {
  const data = JSON.parse(text) as Partial<CameraListExchange>
  if (!data || data.kind !== CAMERA_LIST_KIND) {
    throw new Error('Keine gueltige Kamera-Liste (kind != camera-list).')
  }
  if (data.formatVersion !== CAMERA_LIST_VERSION) {
    throw new Error(`Nicht unterstuetzte Kamera-Listen-Version: ${data.formatVersion}`)
  }
  if (!Array.isArray(data.cameras)) throw new Error('Kamera-Liste ohne cameras-Array.')
  return data as CameraListExchange
}

// Venue-Meter → Canvas-Pixel (grobe Platzierung; der User ordnet danach an).
const PX_PER_METER = 120

const clonePort = (p: Port): Port => ({ ...p, id: '' })

function matchTemplate(entry: CameraListEntry) {
  const hay = `${entry.manufacturer ?? ''} ${entry.model ?? ''}`.toLowerCase().trim()
  if (!hay) return undefined
  for (const c of CAMERA_CATALOG) {
    if (c.match.some((m) => hay.includes(m.toLowerCase()))) return c.template
  }
  return undefined
}

/** Neutrale Kamera-Liste → Equipment-Nodes (Kategorie "Kameras"). */
export function cameraListToEquipment(ex: CameraListExchange): EquipmentItem[] {
  const fallbackOut: Port[] = [{ id: '', name: 'SDI Out', type: 'BNC', connectorType: 'BNC' }]
  return ex.cameras.map((c, i) => {
    const tmpl = matchTemplate(c)
    const outputs: Port[] = (tmpl?.outputs ?? fallbackOut).map(clonePort)
    const inputs: Port[] = (tmpl?.inputs ?? []).map(clonePort)
    return {
      id: c.id || '',
      name: c.label || tmpl?.name || 'Kamera',
      category: 'Kameras',
      inputs,
      outputs,
      width: tmpl?.width ?? 240,
      height: tmpl?.height ?? 200,
      x: Math.round((c.x ?? i * 2) * PX_PER_METER),
      y: Math.round((c.y ?? 0) * PX_PER_METER),
    }
  })
}
